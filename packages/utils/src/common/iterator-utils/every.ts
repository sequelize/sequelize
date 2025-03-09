export function every<In>(iterable: Iterable<In>, cb: (item: In) => boolean): boolean {
  for (const item of iterable) {
    if (!cb(item)) {
      return false;
    }
  }

  return true;
}
