import { dayjs } from "../utils/date";

export function dayKeyInTz(timezone: string) {
  return dayjs().tz(timezone).format("YYYY-MM-DD");
}

export function isWithinSchedule(opts: {
  timezone: string;
  sendDays: string[];
  windowStart: string; // "08:00"
  windowEnd: string;   // "11:55"
}) {
  const now = dayjs().tz(opts.timezone);
  const currentTime = now.format("HH:mm:ss");
  const day = now.format("ddd"); // Mon, Tue...

  console.log(`[Schedule] Current time in ${opts.timezone}: ${currentTime} (${day})`);
  console.log(`[Schedule] Window: ${opts.windowStart} - ${opts.windowEnd}`);
  console.log(`[Schedule] Allowed days: ${opts.sendDays.join(", ")}`);

  // Check day first
  if (opts.sendDays?.length && !opts.sendDays.includes(day)) {
    console.log(`[Schedule] ❌ Day ${day} not in allowed days`);
    return false;
  }

  const [sh, sm] = opts.windowStart.split(":").map(Number);
  const [eh, em] = opts.windowEnd.split(":").map(Number);

  const start = now.clone().hour(sh).minute(sm).second(0);
  const end = now.clone().hour(eh).minute(em).second(0);

  const isAfterStart = now.isSameOrAfter(start);
  const isBeforeEnd = now.isSameOrBefore(end);

  console.log(`[Schedule] Start: ${start.format("HH:mm:ss")}, End: ${end.format("HH:mm:ss")}`);
  console.log(`[Schedule] isAfterStart: ${isAfterStart}, isBeforeEnd: ${isBeforeEnd}`);

  const withinWindow = isAfterStart && isBeforeEnd;
  
  if (!withinWindow) {
    console.log(`[Schedule] ❌ Outside time window (current: ${currentTime})`);
  } else {
    console.log(`[Schedule] ✅ Within schedule window`);
  }

  return withinWindow;
}
