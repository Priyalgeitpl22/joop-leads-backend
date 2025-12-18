import { schedulerTick } from "./scheduler";

setInterval(async () => {
  try {
    await schedulerTick();
  } catch (e) {
    console.error("schedulerTick error", e);
  }
}, 60_000);