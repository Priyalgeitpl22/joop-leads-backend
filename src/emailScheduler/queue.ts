import { Queue } from "bullmq";
import IORedis from "ioredis";

const REDIS_URL = process.env.REDIS_URL!;
export const redis = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

export const emailQueue = new Queue("email-send", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 60_000 },
    removeOnComplete: true,
  },
});
