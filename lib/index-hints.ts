/**
 * An enum of index hints to be used in mysql for querying with index hints
 *
 * @property USE
 * @property FORCE
 * @property IGNORE
 */
export enum IndexHints {
  USE = 'USE',
  FORCE = 'FORCE',
  IGNORE = 'IGNORE',
}
