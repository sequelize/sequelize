/**
 * Like {@link Array#map}, but works with any iterable.
 *
 * @param iterable
 * @param cb
 * @returns an iterator.
 */
export declare function map<In, Out>(iterable: Iterable<In>, cb: (item: In, index: number) => Out): Generator<Out, void>;
