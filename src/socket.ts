// import { Server as IOServer } from "socket.io";
// import type { Server as HttpServer } from "http";
// import jwt from "jsonwebtoken";
// import { PrismaClient } from "@prisma/client";
// import { success } from "zod";
// import { id } from "zod/v4/locales/index.cjs";

// const prisma = new PrismaClient();
// const JWT_USER_SEC = process.env.SECRET_KEY || "YOUR_SECRET_FOR_TESTING";

// export let io: IOServer;
// export function initSocket(server: HttpServer) {
//   const io = new IOServer(server, {
//     cors: {
//       origin: ["http://127.0.0.1:5500", "http://localhost:3000"],
//       credentials: true,
//     },
//   });

//   io.use(async (socket, next) => {
//     try {
//       const token =
//         socket.handshake.auth?.token ||
//         (socket.handshake.query && (socket.handshake.query.token as string));

//       if (!token) return next(new Error("auth-error: token missing"));

//       const decoded = jwt.verify(token, JWT_USER_SEC) as { id: string };
//       const user = await prisma.user.findUnique({
//         where: { id: decoded.id },
//         select: { id: true, firstname: true, lastname: true, email: true },
//       });
//       if (!user) return next(new Error("auth-error: user not found"));

//       const profile = await prisma.profile.findUnique({
//         where: { userId: user.id },
//         select: { id: true },
//       });
//       if (!profile) return next(new Error("auth-error: profile not found"));

//       socket.data.user = user;
//       socket.data.profileId = profile.id;
//       next();
//     } catch (err) {
//       console.log("socket auth failed:", err);
//       next(new Error("auth-error"));
//     }
//   });

//   io.on("connection", (socket) => {
//     console.log(
//       ` Socket connected: ${socket.id}  (user: ${socket.data.user?.id})`
//     );

//     socket.on("join-group", async (payload, ack) => {
//       try {
//         const groupId =
//           typeof payload === "string" ? payload : payload?.groupId;
//         if (!groupId)
//           return ack?.({ success: false, message: "groupId missing" });

//         // verify membership
//         const member = await prisma.groupMember.findUnique({
//           where: {
//             groupId_profileId: {
//               groupId,
//               profileId: socket.data.profileId,
//             },
//           },
//         });
//         if (!member) {
//           return ack?.({
//             success: false,
//             message: "You are not a member of this group",
//           });
//         }

//         socket.join(groupId);
//         console.log(` ${socket.data.user.id} joined group ${groupId}`);
//         ack?.({ success: true, message: "joined" });
//       } catch (err) {
//         console.log("join-group error", err);
//         ack?.({ success: false, message: "server error" });
//       }
//     });

//     socket.on("send-message", async (payload, ack, attachments) => {
//       try {
//         const { groupId, message, attachments } =
//           typeof payload === "string" ? JSON.parse(payload) : payload || {};
//         if (!groupId || !message)
//           return ack?.({
//             success: false,
//             message: "GourpId or message is missing",
//           });
//         // console.log(
//         //   `✉️ User ${socket.data.user.id} sending message to group ${groupId}:`,
//         //   message
//         // );

//         const member = await prisma.groupMember.findUnique({
//           where: {
//             groupId_profileId: {
//               groupId,
//               profileId: socket.data.profileId,
//             },
//           },
//         });
//         if (!member)
//           return ack({
//             success: false,
//             message: "Not the member of this group ",
//           });

//         const created = await prisma.message.create({
//           data: {
//             groupId,
//             message,
//             senderId: socket.data.user.id,
//             attachments: attachments
//               ? {
//                   create: attachments.map((att: any) => ({
//                     url: att.url,
//                     type: att.type,
//                   })),
//                 }
//               : undefined,
//           },
//           include: {
//             sender: {
//               select: {
//                 id: true,
//                 firstname: true,
//                 lastname: true,
//                 profilepic: true,
//               },
//             },
//             attachments: true,
//           },
//         });

//         io.to(groupId).emit("new-message", {
//           id: created.id,
//           groupId: created.groupId,
//           message: created.message,
//           sender: created.sender,
//           attachments: created.attachments,
//           createdAt: created.createdAt,
//         });

//         ack({ success: true, message: "sent" });
//       } catch (err: any) {
//         console.log("send message error", err),
//           ack({ success: false, message: "server error" });
//       }
//     });

//     socket.on("leave-group", async (payload, ack) => {
//       try {
//         const groupId =
//           typeof payload === "string" ? payload : payload?.groupId;
//         if (!groupId) {
//           return ack({ success: false, message: "groupId missing" });
//         }
//         socket.leave(groupId);

//         console.log(`${socket.data.user.id} left the ${groupId}`);
//         ack({ success: true, message: "left" });
//       } catch (err) {
//         console.log("leave-group error", err);
//         ack?.({ success: false, message: "server error" });
//       }
//     });
//   });

//   return io;
// }

import { Server as IOServer } from "socket.io";
import type { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const JWT_USER_SEC = process.env.SECRET_KEY || "YOUR_SECRET_FOR_TESTING";

export let io: IOServer;

export function initSocket(server: HttpServer) {
  const io = new IOServer(server, {
    cors: {
      origin: ["http://127.0.0.1:5500", "http://localhost:3000"],
      credentials: true,
    },
  });

  // 🔹 Helper for uniform acks
  function sendAck(
    ack: any,
    success: boolean,
    message: string,
    data: any = null
  ) {
    if (typeof ack === "function") {
      ack({ success, message, data });
    }
  }

  // 🔹 In-memory structures
  const onlineUsers: Record<string, Set<string>> = {}; // groupId → Set(userId)
  const messageTimestamps = new Map<string, number>(); // userId → last message timestamp

  // 🔹 Auth middleware
  io.use(async (socket, next) => {
    try {
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
      `✅ Socket connected: ${socket.id} (user: ${socket.data.user?.id})`
    );

    // 🟢 Join Group
    socket.on("join-group", async (payload, ack) => {
      try {
        const groupId =
          typeof payload === "string" ? payload : payload?.groupId;
        if (!groupId) return sendAck(ack, false, "groupId missing");

        const member = await prisma.groupMember.findUnique({
          where: {
            groupId_profileId: {
              groupId,
              profileId: socket.data.profileId,
            },
          },
        });
        if (!member)
          return sendAck(ack, false, "You are not a member of this group");

        socket.join(groupId);
        console.log(`👤 ${socket.data.user.id} joined group ${groupId}`);

        // Update online users
        if (!onlineUsers[groupId]) onlineUsers[groupId] = new Set();
        onlineUsers[groupId].add(socket.data.user.id);

        io.to(groupId).emit(
          "group-online-users",
          Array.from(onlineUsers[groupId])
        );

        sendAck(ack, true, "joined");
      } catch (err) {
        console.log("join-group error", err);
        sendAck(ack, false, "server error");
      }
    });

    // ✉️ Send Message with Rate Limiting
    socket.on("send-message", async (payload, ack) => {
      try {
        const { groupId, message, attachments } =
          typeof payload === "string" ? JSON.parse(payload) : payload || {};
        if (!groupId || !message)
          return sendAck(ack, false, "GroupId or message is missing");

        // Rate limiting
        const now = Date.now();
        const last = messageTimestamps.get(socket.data.user.id) || 0;
        if (now - last < 1000)
          return sendAck(ack, false, "You're sending messages too fast!");
        messageTimestamps.set(socket.data.user.id, now);

        // Verify membership
        const member = await prisma.groupMember.findUnique({
          where: {
            groupId_profileId: {
              groupId,
              profileId: socket.data.profileId,
            },
          },
        });
        if (!member) return sendAck(ack, false, "Not a member of this group");

        const created = await prisma.message.create({
          data: {
            groupId,
            message,
            senderId: socket.data.user.id,
            attachments: attachments
              ? {
                  create: attachments.map((att: any) => ({
                    url: att.url,
                    type: att.type,
                  })),
                }
              : undefined,
          },
          include: {
            sender: {
              select: {
                id: true,
                firstname: true,
                lastname: true,
                profilepic: true,
              },
            },
            attachments: true,
          },
        });

        io.to(groupId).emit("new-message", {
          id: created.id,
          groupId: created.groupId,
          message: created.message,
          sender: created.sender,
          attachments: created.attachments,
          createdAt: created.createdAt,
        });

        sendAck(ack, true, "sent");
      } catch (err) {
        console.log("send-message error", err);
        sendAck(ack, false, "server error");
      }
    });

    socket.on("typing", ({ groupId }) => {
      if (!groupId) return;
      socket.to(groupId).emit("user-typing", { userId: socket.data.user.id });
    });

    // 🟠 Message Read Receipts
    socket.on("read-messages", async ({ groupId, messageIds }, ack) => {
      try {
        if (!groupId || !Array.isArray(messageIds)) {
          return sendAck(ack, false, "Invalid data");
        }

        await prisma.messageRead.createMany({
          data: messageIds.map((id: string) => ({
            messageId: id,
            userId: socket.data.user.id,
          })),
          skipDuplicates: true,
        });

        io.to(groupId).emit("messages-read", {
          userId: socket.data.user.id,
          messageIds,
        });

        sendAck(ack, true, "marked as read");
      } catch (err) {
        console.log("read-messages error", err);
        sendAck(ack, false, "server error");
      }
    });

    socket.on("leave-group", async (payload, ack) => {
      try {
        const groupId =
          typeof payload === "string" ? payload : payload?.groupId;
        if (!groupId) return sendAck(ack, false, "groupId missing");

        socket.leave(groupId);
        if (onlineUsers[groupId]) {
          onlineUsers[groupId].delete(socket.data.user.id);
          io.to(groupId).emit(
            "group-online-users",
            Array.from(onlineUsers[groupId])
          );
        }

        console.log(`🚪 ${socket.data.user.id} left ${groupId}`);
        sendAck(ack, true, "left");
      } catch (err) {
        console.log("leave-group error", err);
        sendAck(ack, false, "server error");
      }
    });

    // 🔻 Disconnect
    socket.on("disconnect", () => {
      console.log(`❌ ${socket.data.user.id} disconnected`);
      for (const [groupId, users] of Object.entries(onlineUsers)) {
        if (users.has(socket.data.user.id)) {
          users.delete(socket.data.user.id);
          io.to(groupId).emit("group-online-users", Array.from(users));
        }
      }
    });
  });

  return io;
}
