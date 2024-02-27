import fs from 'node:fs/promises';
import { isNodeError } from './check.js';

export async function checkFileExists(path: string): Promise<boolean> {
  try {
    await fs.access(path);

    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return false;
    }

    throw error;
  }
}
