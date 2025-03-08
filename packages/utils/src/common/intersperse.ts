import { isFunction } from './predicates/is-function.js';

/**
 * Inserts a value between each element of a list.
 * `separator` can be a function, which is useful to generate JSX elements with different keys.
 *
 * @param list The list
 * @param separator The value to insert between each element of the list, or a function that will produce each element to insert.
 */
export function intersperse<Value, Separator>(
  list: Value[],
  separator: Separator | ((index: number) => Separator),
): Array<Value | Separator> {
  const res: Array<Value | Separator> = [];

  if (list.length === 0) {
    return res;
  }

  const separatorIsFunction = isFunction(separator);

  let i = 0;

  res.push(list[i++]);
  while (i < list.length) {
    res.push(separatorIsFunction ? separator(i) : separator, list[i++]);
  }

  return res;
}
