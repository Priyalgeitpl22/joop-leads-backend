import dotenv from "dotenv";
const env = process.env.NODE_ENV || 'development';

dotenv.config({
  path: `.env.${env}`,
});

import { schedulerTick } from "./scheduler";
import { pollForReplies } from "../jobs/replyPoller";

const INTERVAL_MINUTES = 1;
const INTERVAL_MS = INTERVAL_MINUTES * 60 * 1000;

const startAlignedScheduler = () => {
  const now = new Date();

  const nextRun = new Date(now);
  nextRun.setSeconds(0, 0);

  const minutes = nextRun.getMinutes();
  const remainder = minutes % INTERVAL_MINUTES;

  if (remainder !== 0) {
    nextRun.setMinutes(minutes + (INTERVAL_MINUTES - remainder));
  }

  const delay = nextRun.getTime() - now.getTime();

  setTimeout(() => {
    runScheduler();
    setInterval(runScheduler, INTERVAL_MS);
  }, delay);
};

const runScheduler = async () => {
  try {
    await schedulerTick();
  } catch (e) {
    console.error("schedulerTick error", e);
  }
};

startAlignedScheduler();

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