'use strict';

/**
 * An enum of index hints to be used in mysql for querying with index hints
 *
 * @property USE
 * @property FORCE
 * @property IGNORE
 */
const IndexHints = module.exports = { // eslint-disable-line
  USE: 'USE',
  FORCE: 'FORCE',
  IGNORE: 'IGNORE'
};
