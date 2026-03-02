import dotenv from "dotenv";
import http from "http";
import app from "./app";
import { initSocket } from "./socket/socket.server";

const env = process.env.NODE_ENV || "development";

dotenv.config({
  path: `.env.${env}`,
});

const server = http.createServer(app);

async function bootstrap() {
  initSocket(server);

  const PORT = process.env.PORT || 5003;

  server.listen(PORT, () => {
    console.log(`🚀 Server running in ${env} mode on port ${PORT}`);
  });
}

bootstrap();