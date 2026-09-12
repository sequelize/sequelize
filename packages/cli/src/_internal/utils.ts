import * as path from 'node:path';

/**
 * Resolves a folder configured by the user against the project root, and asserts that the result
 * stays inside that project root.
 *
 * Folder options are always interpreted as project-relative, including when they start with a
 * separator (the documented default values are `/migrations` and `/seeds`). `path.join` is
 * therefore used instead of `path.resolve`, which would discard the project root for such values.
 *
 * @param projectRoot The directory the config file was found in (or the cwd if there is none).
 * @param folder The folder as configured by the user.
 * @returns The resolved absolute path, or `null` if it points outside of `projectRoot`.
 */
export function resolveProjectFolder(projectRoot: string, folder: string): string | null {
  const root = path.resolve(projectRoot);
  // path.join normalizes, but a value such as "../../etc" can still climb out of the project.
  const resolved = path.resolve(path.join(root, folder));

  // The trailing separator matters: without it, "/home/me/project-evil" would be accepted as being
  // inside "/home/me/project".
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    return null;
  }

  return resolved;
}

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
