/**
 * Like {@link Array#map}, but works with any iterable.
 *
 * @param iterable
 * @param cb
 * @returns an iterator.
 */
export function *map<In, Out>(
  iterable: Iterable<In>,
  cb: (item: In, index: number) => Out,
): Generator<Out, void> {
  let i = 0;

  for (const item of iterable) {
    yield cb(item, i++);
  }
}

/**
 * Combines two iterables, they will be iterated in order
 *
 * @param iterables
 */
export function *combinedIterator<T>(
  ...iterables: Array<Iterable<T>>
): Generator<T, void, undefined> {
  for (const iterable of iterables) {
    yield* iterable;
  }
}
