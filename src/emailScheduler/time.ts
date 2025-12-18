import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import tz from "dayjs/plugin/timezone";
dayjs.extend(utc); dayjs.extend(tz);

export function dayKeyInTz(timezone: string) {
  return dayjs().tz(timezone).format("YYYY-MM-DD");
}

export function isWithinSchedule(opts: {
  timezone: string;
  sendDays: string[];
  windowStart: string; // "10:00"
  windowEnd: string;   // "18:00"
}) {
  const now = dayjs().tz(opts.timezone);

  const day = now.format("ddd"); // Mon/Tue...
  if (opts.sendDays?.length && !opts.sendDays.includes(day)) return false;

  const [sh, sm] = opts.windowStart.split(":").map(Number);
  const [eh, em] = opts.windowEnd.split(":").map(Number);

  const start = now.hour(sh).minute(sm).second(0);
  const end = now.hour(eh).minute(em).second(0);

  return now.isAfter(start) && now.isBefore(end);
}