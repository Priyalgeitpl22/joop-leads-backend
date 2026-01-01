/**
 * Standalone Reply Poller Runner
 * 
 * Run with: npx ts-node src/jobs/runReplyPoller.ts
 * Or via PM2: pm2 start dist/jobs/runReplyPoller.js --name reply-poller
 */

import dotenv from "dotenv";
const env = process.env.NODE_ENV || 'development';

dotenv.config({
  path: `.env.${env}`,
});

import { startReplyPolling } from "./replyPoller";

// Default: poll every 1 minute
const intervalMinutes = parseInt(process.env.REPLY_POLL_INTERVAL || "1", 10);

console.log(`[ReplyPoller] Starting standalone reply poller...`);
console.log(`[ReplyPoller] Polling interval: ${intervalMinutes} minutes`);
console.log(`[ReplyPoller] Environment: ${env}`);

startReplyPolling(intervalMinutes);

