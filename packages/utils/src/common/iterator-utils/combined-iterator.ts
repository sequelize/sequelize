/**
 * Combines two iterables, they will be iterated in order
 *
 * @param iterables
 */
export function* combinedIterator<T>(
  ...iterables: Array<Iterable<T>>
): Generator<T, void, undefined> {
  for (const iterable of iterables) {
    yield* iterable;
  }
}
