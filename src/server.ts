import dotenv from "dotenv";

const env = process.env.NODE_ENV || "development";

dotenv.config({
  path: `.env.${env}`,
});

import http from "http";
import app from "./app";

const server = http.createServer(app);
const PORT = Number(process.env.PORT) || 5003;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running in ${env} mode on port ${PORT}`);
});


server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.syscall !== "listen") {
    throw error;
  }

  switch (error.code) {
    case "EACCES":
      console.error(`❌ Port ${PORT} requires elevated privileges`);
      process.exit(1);
      break;
    case "EADDRINUSE":
      console.error(`❌ Port ${PORT} is already in use`);
      process.exit(1);
      break;
    default:
      throw error;
  }
});