import { Server } from "socket.io";
import { PrismaClient } from "@prisma/client";
import { getAIResponse } from "../middlewares/botMiddleware";

const prisma = new PrismaClient();

export const socketSetup = (server: any) => {
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type'],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    console.log('a user connected');

    socket.on("sendMessage", async (data) => {
      try {
        if (!data.threadId) {
          return socket.emit("error", { message: "Thread ID is required" });
        }

        await prisma.message.create({
          data: { content: data.message, sender: data.sender, threadId: data.threadId },
        });

        const response = await getAIResponse(data.message, data.threadId);

        if (response.answer) {
          await prisma.message.create({
            data: { content: response.answer, sender: "Bot", threadId: data.threadId },
          });
        }

        socket.emit("receiveMessage", {...response, threadId: data.threadId});
      } catch (error) {
        console.error("Error handling sendMessage:", error);
      }
    });

    socket.on("startChat", async (data) => {
      try {
        const thread = await prisma.thread.create({
          data: { user: data.sender },
        });

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

    socket.on('recover', () => {
      console.log('Socket connection recovered');
    });

    socket.on('disconnect', () => {
      console.log('user disconnected');
    });
  });
};
