import express from "express";
import routes from "./routes";
import cors from "cors";
import "./jobs/emailCron"; // Import the cron job

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));
app.use("/api", routes);

app.get("/", (req, res) => {
  res.send("Welcome to Jooper leads!");
});

export default app;
