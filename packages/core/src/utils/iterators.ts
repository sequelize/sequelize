/**
 * Like {@link Array#map}, but works with any iterable.
 *
 * @param iterable
 * @param cb
 * @returns an iterator.
 */
export function* map<In, Out>(
  iterable: Iterable<In>,
  cb: (item: In, index: number) => Out,
): Generator<Out, void> {
  let i = 0;

  for (const item of iterable) {
    yield cb(item, i++);
  }
}

export function some<In>(iterable: Iterable<In>, cb: (item: In) => boolean): boolean {
  for (const item of iterable) {
    if (cb(item)) {
      return true;
    }
  }

  return false;
}

export function every<In>(iterable: Iterable<In>, cb: (item: In) => boolean): boolean {
  for (const item of iterable) {
    if (!cb(item)) {
      return false;
    }
  }

  return true;
}

export function find<Val>(iterable: Iterable<Val>, cb: (item: Val) => boolean): Val | undefined {
  for (const item of iterable) {
    if (cb(item)) {
      return item;
    }
  }

  return undefined;
}

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

export function join<T>(iterable: Iterable<T>, glue: string): string {
  const iterator = iterable[Symbol.iterator]();
  const first = iterator.next();
  if (first.done) {
    return '';
  }

  let result = String(first.value);

  let item;
  while (((item = iterator.next()), !item.done)) {
    result += glue + String(item.value);
  }

  return result;
}
