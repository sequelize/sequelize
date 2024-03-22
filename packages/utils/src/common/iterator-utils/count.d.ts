/**
 * Counts how many elements in the iterable match the predicate.
 *
 * @param iterable
 * @param cb
 * @returns how many elements in the iterable match the predicate.
 */
export declare function count<In>(iterable: Iterable<In>, cb: (item: In, index: number) => boolean): number;
