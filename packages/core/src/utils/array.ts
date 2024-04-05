/**
 * Checks if 2 arrays intersect.
 *
 * @param arr1
 * @param arr2
 * @private
 */
export function intersects<T>(arr1: T[], arr2: T[]): boolean {
  return arr1.some(v => arr2.includes(v));
}

/**
 * Returns the intersection of two arrays.
 *
 * @param arr1
 * @param arr2
 */
export function getIntersection<T>(arr1: T[], arr2: T[]): T[] {
  return arr1.filter(v => arr2.includes(v));
}
