import { Server as IOServer } from "socket.io";
import type { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const JWT_USER_SEC = process.env.SECRET_KEY || "YOUR_SECRET_FOR_TESTING";

export function initSocket(server: HttpServer) {
  const io = new IOServer(server, {
    cors: {
      origin: ["http://127.0.0.1:5500", "http://localhost:3000"],
      credentials: true,
    },
  });

  // --- auth middleware for sockets ----
  io.use(async (socket, next) => {
    try {
      // Postman may send token in socket.handshake.auth.token or as a query param
      const token =
        socket.handshake.auth?.token ||
        (socket.handshake.query && (socket.handshake.query.token as string));

      if (!token) return next(new Error("auth-error: token missing"));

      const decoded = jwt.verify(token, JWT_USER_SEC) as { id: string };
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, firstname: true, lastname: true, email: true },
      });
      if (!user) return next(new Error("auth-error: user not found"));

      // also fetch profile id and store on socket.data
      const profile = await prisma.profile.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });
      if (!profile) return next(new Error("auth-error: profile not found"));

      socket.data.user = user;
      socket.data.profileId = profile.id;
      next();
    } catch (err) {
      console.log("socket auth failed:", err);
      next(new Error("auth-error"));
    }
  });

  io.on("connection", (socket) => {
    console.log(
      `✅ Socket connected: ${socket.id}  (user: ${socket.data.user?.id})`
    );
    // add inside io.on("connection", socket => { ... })
    socket.on("join-group", async (payload, ack) => {
      try {
        // Accept either a string groupId or { groupId: "..." }
        const groupId =
          typeof payload === "string" ? payload : payload?.groupId;
        if (!groupId)
          return ack?.({ success: false, message: "groupId missing" });

        // verify membership
        const member = await prisma.groupMember.findUnique({
          where: {
            groupId_profileId: {
              groupId,
              profileId: socket.data.profileId,
            },
          },
        });
        if (!member) {
          return ack?.({
            success: false,
            message: "You are not a member of this group",
          });
        }

        socket.join(groupId);
        console.log(`🟢 ${socket.data.user.id} joined group ${groupId}`);
        ack?.({ success: true, message: "joined" });
      } catch (err) {
        console.log("join-group error", err);
        ack?.({ success: false, message: "server error" });
      }
    });
  });

  return io;
}
