import dotenv from "dotenv";

const env = process.env.NODE_ENV || "development";

dotenv.config({
  path: `.env.${env}`,
});

import http from "http";
import app from "./app";

const server = http.createServer(app);
const PORT = process.env.PORT || 5004;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} (${env})`);
});
