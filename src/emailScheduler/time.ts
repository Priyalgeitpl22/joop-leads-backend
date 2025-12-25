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
  const day = now.format("ddd"); // Mon, Tue...

  console.log(`[Schedule] Current time in ${opts.timezone}: ${now.format("HH:mm:ss")} (${day})`);
  console.log(`[Schedule] Window: ${opts.windowStart} - ${opts.windowEnd}`);
  console.log(`[Schedule] Allowed days: ${opts.sendDays.join(", ")}`);

  // Check
  if (opts.sendDays?.length && !opts.sendDays.includes(day)) {
    console.log(`[Schedule] ❌ Day ${day} not in allowed days`);
    return false;
  }

  const [sh, sm] = opts.windowStart.split(":").map(Number);
  const [eh, em] = opts.windowEnd.split(":").map(Number);

  let start = now.clone().hour(sh).minute(sm).second(0);
  let end = now.clone().hour(eh).minute(em).second(0);

  if (start.isAfter(end)) {
    if (now.isBefore(end)) {
      start = start.subtract(1, "day");
    } else {
      end = end.add(1, "day");
    }
  }

  const withinWindow =
    now.isSameOrAfter(start) && now.isSameOrBefore(end);

  console.log(`[Schedule] Start: ${start.format()}, End: ${end.format()}`);
  console.log(`[Schedule] withinWindow: ${withinWindow}`);

  return withinWindow;
}
