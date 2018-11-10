'use strict';

/**
 * An enum of table hints to be used in mssql for querying with table hints
 * 
 * @property NOLOCK
 * @property READUNCOMMITTED
 * @property UPDLOCK
 * @property REPEATABLEREAD
 * @property SERIALIZABLE
 * @property READCOMMITTED
 * @property TABLOCK
 * @property TABLOCKX
 * @property PAGLOCK
 * @property ROWLOCK
 * @property NOWAIT
 * @property READPAST
 * @property XLOCK
 * @property SNAPSHOT
 * @property NOEXPAND
 */
const TableHints = module.exports = { // eslint-disable-line
  NOLOCK: 'NOLOCK',
  READUNCOMMITTED: 'READUNCOMMITTED',
  UPDLOCK: 'UPDLOCK',
  REPEATABLEREAD: 'REPEATABLEREAD',
  SERIALIZABLE: 'SERIALIZABLE',
  READCOMMITTED: 'READCOMMITTED',
  TABLOCK: 'TABLOCK',
  TABLOCKX: 'TABLOCKX',
  PAGLOCK: 'PAGLOCK',
  ROWLOCK: 'ROWLOCK',
  NOWAIT: 'NOWAIT',
  READPAST: 'READPAST',
  XLOCK: 'XLOCK',
  SNAPSHOT: 'SNAPSHOT',
  NOEXPAND: 'NOEXPAND'
};
