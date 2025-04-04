import http from "http";
import app from "./app";

const server = http.createServer(app);

const PORT = process.env.PORT || 5003;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
