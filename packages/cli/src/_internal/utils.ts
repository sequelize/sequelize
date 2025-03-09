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
