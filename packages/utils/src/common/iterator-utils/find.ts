export function find<Val>(iterable: Iterable<Val>, cb: (item: Val) => boolean): Val | undefined {
  for (const item of iterable) {
    if (cb(item)) {
      return item;
    }
  }

  return undefined;
}
