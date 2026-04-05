/**
 * Counts how many elements in the iterable match the predicate.
 *
 * @param iterable
 * @param cb
 * @returns how many elements in the iterable match the predicate.
 */
export function count<In>(
  iterable: Iterable<In>,
  cb: (item: In, index: number) => boolean,
): number {
  let i = 0;
  let currentCount = 0;

  for (const item of iterable) {
    if (cb(item, i++)) {
      currentCount++;
    }
  }

  return currentCount;
}
