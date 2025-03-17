import express from "express";
import fs from "fs";
import path from "path";

const app = express();

// 683c0b4a-8772-44d8-95b9-4b26d2756058_priyal@goldeneagle.ai_1742229123098
app.get("/track-email/:trackingId", (req, res) => {
  const trackingId = req.params.trackingId;
  console.log(`📩 Email opened! Tracking ID: ${trackingId}`);

  // Save to database or log file
  fs.appendFileSync("email_tracking.log", `Opened: ${trackingId}\n`);

  // Return a transparent 1x1 pixel image
  res.sendFile(path.join(__dirname, "transparent.png"));
});

app.listen(3000, () => console.log("📡 Tracking server running on port 3000"));
