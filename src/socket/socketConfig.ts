import { Server } from "socket.io";
import { PrismaClient } from "@prisma/client";
import { getAIResponse } from "../middlewares/botMiddleware";
import { UserRoles } from "../enums";

const prisma = new PrismaClient();
const onlineAgents = new Set();

export const socketSetup = (server: any) => {
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type'],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("a user connected");

    socket.on("agentOnline", async (agentData) => {
      onlineAgents.add(agentData.id);
      if (agentData.online) {
        console.log(`Agent ${agentData.name} is online`);
      }
      else {
        console.log(`Agent ${agentData.name} is offline`);
      }

      const agentId = agentData.id
      // Update in DB (optional)
      // await prisma.user.update({
      //   where: { id: agentId , role: UserRoles.AGENT},
      //   data: { status: "online" },
      // });

      // Notify all clients
      io.emit("agentStatusUpdate", { agentId, status: "online" });
    });

    socket.on("joinThread", (threadId) => {
      socket.join(threadId);
      console.log(`User joined thread: ${threadId}`);
    });

    socket.on("sendMessage", async (data) => {
      try {
        if (!data.threadId) {
          return socket.emit("error", { message: "Thread ID is required" });
        }

        await prisma.message.create({
          data: { content: data.content, sender: data.sender, threadId: data.threadId },
        });

        const response = await getAIResponse(data.content, data.aiOrgId);

        if (response.answer) {
          await prisma.message.create({
            data: { content: response.answer, sender: "Bot", threadId: data.threadId },
          });

          io.emit("receiveMessage", {
            id: Date.now().toString(),
            sender: "Bot",
            status: 200,
            answer: response.answer,
            threadId: data.threadId,
            question: response.question,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (error) {
        console.error("Error handling sendMessage:", error);
      }
    });

    socket.on("updateDashboard", (data) => {
      console.log("📩 Received updateDashboard event from widget:", data);
      io.emit("updateDashboard", data);
    });

    socket.on("startChat", async (data) => {
      try {
        const thread = await prisma.thread.create({
          data: { user: data.sender },
        });

        socket.join(thread.id);
        socket.emit("chatStarted", { threadId: thread.id });
      } catch (error) {
        console.error("Error starting chat:", error);
      }
    });

    socket.on("fetchMessages", async (data) => {
      try {
        const messages = await prisma.message.findMany({
          where: { threadId: data.threadId },
          orderBy: { createdAt: "asc" },
        });

        socket.emit("previousMessages", { threadId: data.threadId, messages });
      } catch (error) {
        console.error("Error fetching messages:", error);
      }
    });

    socket.on("recover", () => {
      console.log("Socket connection recovered");
    });

    socket.on("disconnect", async () => {
      console.log("A user disconnected");

      for (let agentId of onlineAgents) {
        // Remove from online list
        onlineAgents.delete(agentId);
        console.log(`Agent ${agentId} is offline`);

        // Update in DB (optional)
        // await prisma.user.update({
        //   where: { id: agentId, role: UserRoles.AGENT },
        //   data: { status: "offline" },
        // });

        // Notify all clients
        io.emit("agentStatusUpdate", { agentId, status: "offline" });
      }
    });
  });
};
