import { Server as IOServer } from "socket.io";
import type { Server } from "http";

export const initSocket = (server: Server) => {
  const io = new IOServer(server, {
    cors: {
      origin: ["http://127.0.0.1:5500", "http://localhost:3000"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("✅ Client connected:", socket.id);

    socket.on("ping-test", () => {
      console.log("📩 got ping-test from", socket.id);
      socket.emit("pong-test", { message: "pong back from server" });
    });

    socket.onAny((event, ...args) => {
      console.log("🛰 Received event:", event, "with data:", args);
    });
  });

  return io;
};
