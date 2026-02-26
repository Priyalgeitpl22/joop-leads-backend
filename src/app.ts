import express from "express";
import routes from "./routes";
import cors from "cors";
import { startSubscriptionReminderCron } from "./jobs/cron";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));
app.use("/api", routes);
startSubscriptionReminderCron();
app.get("/", (req, res) => {
  res.json({ message: "Welcome to Jooper AI Email Campaign Service" });
});

export default app;
