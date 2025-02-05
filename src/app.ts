import express from "express";
import routes from "./routes"; // Import base routes

const app = express();

app.use(express.json());

// Use the centralized routes
app.use("/api", routes);

app.get("/", (req, res) => {
  res.send("Welcome to the API!");
});

export default app;
