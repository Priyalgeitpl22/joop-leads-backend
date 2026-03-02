import cron from "node-cron";
import { runSubscriptionExpiryReminders } from "./subcription.reminder.job";

const SCHEDULE = process.env.REMINDER_CRON_SCHEDULE || "0 8 * * *";
const TIMEZONE = process.env.REMINDER_CRON_TIMEZONE || "UTC";

export function startSubscriptionReminderCron(): void {
  if (!cron.validate(SCHEDULE)) {
    console.error(
      `[SubscriptionReminderCron] ❌ Invalid cron schedule: "${SCHEDULE}". Job NOT started.`
    );
    return;
  }

  console.log(
    `[SubscriptionReminderCron] ⏰ Scheduling subscription reminder job — schedule: "${SCHEDULE}", timezone: "${TIMEZONE}"`
  );

  cron.schedule(
    SCHEDULE,
    async () => {
      console.log(`[SubscriptionReminderCron] 🕗 Triggered at ${new Date().toISOString()}`);
      try {
        await runSubscriptionExpiryReminders();
      } catch (err: any) {
        console.error(
          "[SubscriptionReminderCron] ❌ Unhandled error in reminder job:",
          err?.message || err
        );
      }
    },
    {
      scheduled: true,
      timezone: TIMEZONE,
    }
  );

  console.log("[SubscriptionReminderCron] ✅ Subscription reminder cron job started.");
}