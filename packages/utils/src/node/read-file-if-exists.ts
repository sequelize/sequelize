import type { Abortable } from 'node:events';
import type { ObjectEncodingOptions, OpenMode, PathLike } from 'node:fs';
import fs from 'node:fs/promises';
import { isNodeError } from './is-node-error.js';

export interface ReadFileOptions extends Abortable, ObjectEncodingOptions {
  flag?: OpenMode | undefined;
}

export async function readFileIfExists(
  filePath: PathLike,
  options?: ReadFileOptions,
): Promise<string | Buffer | null> {
  try {
    // @types/node's last `readFile` overload stopped making `options` optional, so an explicit
    // `undefined` (from this function's own optional parameter) no longer matches it. `null` does.
    return await fs.readFile(filePath, options ?? null);
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      // file not found
      return null;
    }

    throw error;
  }
}
