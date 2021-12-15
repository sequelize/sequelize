/**
 * Checks if 2 arrays intersect.
 *
 * @param {Array} arr1
 * @param {Array} arr2
 * @private
 */
export function intersects(arr1: any[], arr2: any[]) {
  return arr1.some(v => arr2.includes(v));
}
