export function some<In>(iterable: Iterable<In>, cb: (item: In) => boolean): boolean {
  for (const item of iterable) {
    if (cb(item)) {
      return true;
    }
  }

  return false;
}
