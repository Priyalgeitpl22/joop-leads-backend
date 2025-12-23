import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

export function convertUtcToTimezone(
    utcDate: string | Date,
    timezone: string,
    format: string = "YYYY-MM-DD HH:mm:ss"
) {
    return dayjs.utc(utcDate).tz(timezone).format(format);
}

export { dayjs };