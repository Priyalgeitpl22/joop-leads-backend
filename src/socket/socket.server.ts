import { Server } from "socket.io";
import http from "http";

let io: Server;

export function initSocket(server: http.Server) {
  console.log("🚀 Initializing Socket.IO (No Redis)...");

  io = new Server(server, {
    cors: {
      origin: ["http://localhost:5173"],
      methods: ["GET", "POST","PUT","PATCH"],
    },
  });

  io.on("connection", (socket) => {
    console.log("🔌 Client connected:", socket.id);
    console.log("👥 Total clients:", io.engine.clientsCount);

    // Join campaign room
    socket.on("joinCampaign", (campaignId: string) => {
      const room = `campaign:${campaignId}`;
      socket.join(room);
    
      console.log(`🏷 ${socket.id} joined ${room}`);
      console.log("Current rooms:", Array.from(socket.rooms));
    });

    // Test event (client → server)
    socket.on("test:event", (data) => {
      console.log("📨 Test event received:", data);

      socket.emit("test:response", {
        message: "Server received your message ✅",
        receivedData: data,
      });
    });

    socket.on("disconnect", () => {
      console.log("❌ Client disconnected:", socket.id);
      console.log("👥 Total clients:", io.engine.clientsCount);
    });
  });

  console.log("✅ Socket.IO initialized (No Redis)");
}

export function getIO(): Server {
  if (!io) {
    throw new Error("Socket.IO not initialized");
  }
  return io;
}