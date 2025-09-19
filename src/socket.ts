// src/socket.ts
import http from "http";
import jwt from "jsonwebtoken";
import { Server as IOServer } from "socket.io";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const JWT_USER_SEC = process.env.SECRET_KEY || ""; // same env key you already use

export default function initSocket(server: http.Server) {
  const io = new IOServer(server, {
    cors: {
      origin: ["http://127.0.0.1:5500", "http://localhost:3001"], // add your frontend origins
      credentials: true,
    },
  });

  // Authenticate socket connection using token sent in handshake.auth.token
  io.use(async (socket, next) => {
    try {
      const token =
        // prefer .auth token (browser client sets this) but fallback to headers if present
        (socket.handshake as any).auth?.token ||
        socket.handshake.headers["authorization"];
      if (!token) return next(new Error("Authentication token missing"));

      const decoded = jwt.verify(token, JWT_USER_SEC) as { id: string };
      if (!decoded?.id) return next(new Error("Invalid token"));

      // ensure user exists
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true },
      });
      if (!user) return next(new Error("User not found"));

      // attach userId & profileId to socket.data for later use
      socket.data.userId = user.id;
      const profile = await prisma.profile.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });
      socket.data.profileId = profile?.id ?? null;

      return next();
    } catch (err) {
      console.error("Socket auth error:", err);
      return next(new Error("Authentication error"));
    }
  });

  io.on("connection", (socket) => {
    console.log("socket connected:", socket.id, "user:", socket.data.userId);

    // join a group room (only allowed if profile is a member)
    socket.on(
      "join-group",
      async (groupId: string, cb?: (res: any) => void) => {
        try {
          const profileId = socket.data.profileId;
          if (!profileId)
            return cb?.({ success: false, message: "Profile not found" });

          const member = await prisma.groupMember.findUnique({
            where: { groupId_profileId: { groupId, profileId } },
          });
          if (!member)
            return cb?.({
              success: false,
              message: "You are not a member of this group",
            });

          socket.join(groupId);
          return cb?.({ success: true, message: "Joined group" });
        } catch (err) {
          console.error(err);
          return cb?.({ success: false, message: "Server error" });
        }
      }
    );

    // leave group
    socket.on("leave-group", (groupId: string, cb?: (res: any) => void) => {
      try {
        socket.leave(groupId);
        return cb?.({ success: true });
      } catch (err) {
        console.error(err);
        return cb?.({ success: false });
      }
    });

    /**
     * send-group-message
     * payload: {
     *   groupId: string,
     *   message: string,
     *   attachments?: [{ url: string, type: "IMAGE"|"VIDEO"|"AUDIO"|"FILE" }]
     * }
     *
     * The server:
     *  - validates membership
     *  - creates message + attachments inside a transaction
     *  - fetches message with sender and attachments and emits to the group room
     */
    socket.on(
      "send-group-message",
      async (payload: any, cb?: (res: any) => void) => {
        try {
          const userId = socket.data.userId as string;
          const profileId = socket.data.profileId as string | null;
          if (!userId || !profileId)
            return cb?.({ success: false, message: "Unauthorized" });

          const { groupId, message, attachments } = payload || {};
          if (!groupId || typeof message !== "string")
            return cb?.({ success: false, message: "Invalid payload" });

          // check membership
          const member = await prisma.groupMember.findUnique({
            where: { groupId_profileId: { groupId, profileId } },
          });
          if (!member)
            return cb?.({
              success: false,
              message: "You are not a member of this group",
            });

          // use transaction to create message and attachments
          const createdMessage = await prisma.$transaction(async (tx) => {
            const m = await tx.message.create({
              data: {
                groupId,
                senderId: userId,
                message,
              },
            });

            if (
              attachments &&
              Array.isArray(attachments) &&
              attachments.length
            ) {
              // create attachments one-by-one (so we have full control)
              for (const a of attachments) {
                // a = { url: string, type: "IMAGE"|"VIDEO"|"AUDIO"|"FILE" }
                await tx.messageAttachment.create({
                  data: {
                    messageId: m.id,
                    url: a.url,
                    // Prisma enum expects a specific enum value; sending the string should work
                    type: a.type,
                  },
                });
              }
            }
            return m;
          });

          // fetch full message with sender info and attachments
          const fullMessage = await prisma.message.findUnique({
            where: { id: createdMessage.id },
            include: {
              attachments: true,
              sender: {
                select: {
                  id: true,
                  firstname: true,
                  lastname: true,
                  profilepic: true,
                },
              },
            },
          });

          // emit to all sockets in the group room (only members who joined the room will receive)
          io.to(groupId).emit("group-message", fullMessage);

          // optional: send success ack to sender
          return cb?.({ success: true, message: fullMessage });
        } catch (err) {
          console.error("send-group-message error:", err);
          return cb?.({ success: false, message: "Server error" });
        }
      }
    );

    // fetch recent history for a group (you must be member)
    socket.on(
      "get-history",
      async (opts: any = {}, cb?: (res: any) => void) => {
        try {
          const { groupId, limit = 50 } = opts;
          const profileId = socket.data.profileId;
          if (!groupId)
            return cb?.({ success: false, message: "groupId required" });
          if (!profileId)
            return cb?.({ success: false, message: "Profile not found" });

          const member = await prisma.groupMember.findUnique({
            where: { groupId_profileId: { groupId, profileId } },
          });
          if (!member)
            return cb?.({
              success: false,
              message: "You are not a member of this group",
            });

          const messages = await prisma.message.findMany({
            where: { groupId },
            include: {
              attachments: true,
              sender: {
                select: {
                  id: true,
                  firstname: true,
                  lastname: true,
                  profilepic: true,
                },
              },
            },
            orderBy: { createdAt: "desc" },
            take: limit,
          });

          // return in chronological order
          return cb?.({ success: true, messages: messages.reverse() });
        } catch (err) {
          console.error("get-history error:", err);
          return cb?.({ success: false, message: "Server error" });
        }
      }
    );

    socket.on("disconnect", (reason) => {
      console.log("socket disconnected:", socket.id, reason);
    });
  });

  return io;
}
