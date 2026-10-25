export const TIMESTAMP_FORMATS = ['separated', 'compact'] as const;

/**
 * - `separated`: `2024-01-31t13-45-00`
 * - `compact`: `20240131134500`, the format used by sequelize-cli v6
 */
export type TimestampFormat = (typeof TIMESTAMP_FORMATS)[number];

export function getTimestamp(format: TimestampFormat, date: Date = new Date()): string {
  const datePart = [
    date.getUTCFullYear(),
    padNumber(date.getUTCMonth() + 1, 2),
    padNumber(date.getUTCDate(), 2),
  ];
  const timePart = [
    padNumber(date.getUTCHours(), 2),
    padNumber(date.getUTCMinutes(), 2),
    padNumber(date.getUTCSeconds(), 2),
  ];

  if (format === 'compact') {
    return `${datePart.join('')}${timePart.join('')}`;
  }

  return `${datePart.join('-')}t${timePart.join('-')}`;
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
