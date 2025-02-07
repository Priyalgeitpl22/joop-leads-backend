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

    socket.on('sendMessage', async (data) => {
      try {
        await prisma.message.create({
          data: { content: data.message, sender: data.sender }
        });
        const response = await getAIResponse(data.message, '123');

        if (response.answer) {
          await prisma.message.create({
            data: { content: response?.answer, sender: 'Bot' }
          });
        }
        socket.emit('receiveMessage', response);
      } catch (error) {
        console.error('Error handling sendMessage:', error);
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
