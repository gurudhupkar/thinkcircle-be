import { Server } from "socket.io";
import type { Server as HttpServer } from "http";

export function initSocket(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: "*", // allow all origins for testing
      methods: ["GET", "POST"],
    },
  });

  // connection event
  io.on("connection", (socket) => {
    console.log("✅ New client connected:", socket.id);

    // simple test event
    socket.on("ping", (msg) => {
        console.log(msg)
      console.log("📩 Received from client:", msg);
      socket.emit("pong", "Hello from server 👋");
    });

    // disconnection
    socket.on("disconnect", () => {
      console.log("❌ Client disconnected:", socket.id);
    });
  });

  return io;
}
