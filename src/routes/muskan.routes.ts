import { Router } from "express";
import { getIO } from "../socket/socket.server";

const router = Router();

router.get("/", (req, res) => {
  const io = getIO();

  io.emit("backend:test", {
    message: "Hello from backend 🚀",
    timestamp: new Date(),
  });

  console.log("📡 backend:test emitted");

  res.json({ success: true });
});

export default router;