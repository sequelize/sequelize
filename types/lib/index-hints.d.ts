/**
 * Available index hints to be used for querying data in mysql for index hints.
 */
declare enum IndexHints {
  USE = 'USE',
  FORCE = 'FORCE',
  IGNORE = 'IGNORE'
}

export = IndexHints;
