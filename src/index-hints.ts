/**
 * An enum of index hints to be used in mysql for querying with index hints
 */
enum IndexHints {
  USE = 'USE',
  FORCE = 'FORCE',
  IGNORE = 'IGNORE'
}

module.exports = IndexHints;
