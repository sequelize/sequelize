import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export function fileUrlToDirname(url: string | URL): string {
  return dirname(fileURLToPath(url));
}
