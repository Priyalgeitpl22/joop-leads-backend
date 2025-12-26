import dotenv from "dotenv";
const env = process.env.NODE_ENV || 'development';

dotenv.config({
  path: `.env.${env}`,
});

import { schedulerTick } from "./scheduler";
import { pollForReplies } from "../jobs/replyPoller";

setInterval(async () => {
  try {
    await schedulerTick();
  } catch (e) {
    console.error("schedulerTick error", e);
  }
}, 60_000);

// Run reply polling every 5 minutes
const REPLY_POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Initial poll after 30 seconds
setTimeout(() => {
  pollForReplies().catch(e => console.error("Initial reply poll error", e));
}, 30_000);

// Then poll every 5 minutes
setInterval(async () => {
  try {
    await pollForReplies();
  } catch (e) {
    console.error("pollForReplies error", e);
  }
}, REPLY_POLL_INTERVAL);

console.log(`[Scheduler] Started - email scheduler (1 min) + reply polling (5 min)`);