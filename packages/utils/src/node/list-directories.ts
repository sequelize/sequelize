import type { PathLike } from 'node:fs';
import fs from 'node:fs/promises';

export async function listDirectories(directory: PathLike): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });

  return entries.filter(entry => entry.isDirectory()).map(entry => entry.name);
}
