import http from "http";
import app from "./app";
import { connectRabbitMQ } from "./utils/rabbitmq";

const server = http.createServer(app);

const PORT = process.env.PORT || 5003;

// Connecting to rabbitMq
connectRabbitMQ();

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
