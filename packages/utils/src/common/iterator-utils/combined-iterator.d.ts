/**
 * Combines two iterables, they will be iterated in order
 *
 * @param iterables
 */
export declare function combinedIterator<T>(...iterables: Array<Iterable<T>>): Generator<T, void, undefined>;
