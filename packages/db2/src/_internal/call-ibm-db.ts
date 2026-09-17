const { setImmediate } = globalThis;

/**
 * Calls a callback-style ibm_db method and returns a promise of the callback's result arguments.
 *
 * ibm_db invokes its callbacks outside of a Node.js callback scope, so since Node.js 26 microtasks queued
 * from them (such as promise continuations) do not run until another macrotask happens.
 * Settling the promise from `setImmediate` makes sure the caller resumes right away.
 * The reference to `setImmediate` is kept at load time so that fake timers installed later do not intercept it.
 *
 * Do not use ibm_db's promise APIs for this reason.
 *
 * @param fn Function that calls the ibm_db method with the provided callback
 */
export async function callIbmDb<T extends unknown[]>(
  fn: (callback: (error: Error | null | undefined, ...results: T) => void) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    fn((error, ...results) => {
      setImmediate(() => {
        if (error) {
          reject(error);
        } else {
          resolve(results);
        }
      });
    });
  });
}
