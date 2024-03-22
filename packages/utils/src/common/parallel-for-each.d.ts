import type { AllowPromise } from './types.js';
/**
 * Executes async code in parallel for each entry of an array.
 *
 * @param iterable The value to iterate
 * @param callback The function to call with each entry of the array
 * @returns A promise that resolves once each callback is done executing (and their promise resolved)
 */
export declare function parallelForEach<T>(iterable: Iterable<T>, callback: (value: T, index: number) => AllowPromise<void>): Promise<void>;
