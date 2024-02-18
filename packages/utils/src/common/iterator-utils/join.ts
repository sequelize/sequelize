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
