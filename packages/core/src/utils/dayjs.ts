import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);

const history = new Map<string, boolean>();

export function timeZoneToOffsetString(timeZone: string) {
  if (isValidTimeZone(timeZone)) {
    return dayjs().tz(timeZone).format('Z');
  }

  throw new Error(`Invalid time zone: ${timeZone}`);
}

export function isValidTimeZone(tz: string) {
  if (history.has(tz)) {
    return history.get(tz);
  }

  let status: boolean;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });

    status = true;
  } catch {
    status = false;
  }

  history.set(tz, status);

  return status;
}
