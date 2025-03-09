import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Async generator that yields every file present in the specified folder, and is sub-folders
 *
 * @param dir
 */
export async function* listFilesRecursive(dir: string): AsyncGenerator<string, void> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.resolve(dir, entry.name);

    if (entry.isDirectory()) {
      yield* listFilesRecursive(entryPath);
    } else {
      yield entryPath;
    }
  }
}
