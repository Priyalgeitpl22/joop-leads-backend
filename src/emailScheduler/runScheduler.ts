import dotenv from "dotenv";
const env = process.env.NODE_ENV || 'development';

dotenv.config({
  path: `.env.${env}`,
});

import { schedulerTick } from "./scheduler";

setInterval(async () => {
  try {
    await schedulerTick();
  } catch (e) {
    console.error("schedulerTick error", e);
  }
}, 60_000);