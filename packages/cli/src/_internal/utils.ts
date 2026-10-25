import { basicComparator } from '@sequelize/utils';

export function getCurrentYYYYMMDDHHmms() {
  const date = new Date();

  return `${date.getUTCFullYear()}-${padNumber(date.getUTCMonth() + 1, 2)}-${padNumber(
    date.getUTCDate(),
    2,
  )}t${padNumber(date.getUTCHours(), 2)}-${padNumber(date.getUTCMinutes(), 2)}-${padNumber(
    date.getUTCSeconds(),
    2,
  )}`;
}

export function padNumber(value: number, length: number): string {
  return String(value).padStart(length, '0');
}

export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .replaceAll(/[\s.]+/g, '-') // Replace spaces & dots with -
    .replaceAll(/[^\w-]+/g, '') // Remove all non-word chars
    .replaceAll(/--+/g, '-') // Replace multiple - with single -
    .replace(/^-+/, '') // Trim - from start of text
    .replace(/-+$/, ''); // Trim - from end of text
}

// Checked in order: the compact (`20240101000000`) and separated (`2024-01-01t00-00-00`)
// timestamp formats, then date-only prefixes (`20240101`, `2024-01-01`).
const TIMESTAMP_PREFIXES = [
  /^(?<year>\d{4})(?<month>\d{2})(?<day>\d{2})(?<hours>\d{2})(?<minutes>\d{2})(?<seconds>\d{2})/,
  /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})t(?<hours>\d{2})-(?<minutes>\d{2})-(?<seconds>\d{2})/i,
  /^(?<year>\d{4})(?<month>\d{2})(?<day>\d{2})/,
  /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/,
];

function getTimestampSortKey(name: string): string | undefined {
  for (const pattern of TIMESTAMP_PREFIXES) {
    const groups = pattern.exec(name)?.groups;
    if (groups) {
      const { year, month, day, hours = '00', minutes = '00', seconds = '00' } = groups;

      return `${year}${month}${day}${hours}${minutes}${seconds}`;
    }
  }

  return undefined;
}

const compareStrings = basicComparator<string>();

/**
 * Sorts migration names chronologically, regardless of which timestamp format they use.
 * Names without a timestamp prefix are sorted after the ones with a timestamp.
 *
 * @param a
 * @param b
 */
export function compareMigrationNames(a: string, b: string): number {
  const aKey = getTimestampSortKey(a);
  const bKey = getTimestampSortKey(b);

  if (aKey !== bKey) {
    if (aKey === undefined) {
      return 1;
    }

    if (bKey === undefined) {
      return -1;
    }

    return compareStrings(aKey, bKey);
  }

  return compareStrings(a, b);
}
