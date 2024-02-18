/**
 * Implements https://github.com/tc39/proposal-array-from-async
 * This function works like Array.from, but accepts async iterators instead of sync iterators.
 *
 * @param asyncIterable An async iterable
 * @returns A promise that resolves to an array that includes all items yielded by the async iterable.
 */
export async function arrayFromAsync<T>(asyncIterable: AsyncIterable<T>): Promise<T[]> {
  const out = [];
  for await (const v of asyncIterable) {
    out.push(await v);
  }

  return out;
}
