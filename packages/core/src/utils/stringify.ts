import type { InspectOptions } from 'node:util';
import { inspect } from 'node:util';

// * `src/associations/helpers.ts` passes `sorted: boolean` option.
// * `src/utils/immutability.ts` passes `depth: number` option.
export default function stringify(variable: any, options?: InspectOptions) {
  return inspect(variable, options);
}
