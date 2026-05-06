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

/**
 * An enum of operators to be used in {@link Sequelize#queryGenerator} methods.
 *
 * @property BIND
 * @property REPLACEMENT
 */
export enum ParameterStyle {
  /**
   * The parameter will be added to the query as a bind parameter.
   */
  BIND = 'BIND',
  /**
   * The parameter will be replaced directly into the query.
   */
  REPLACEMENT = 'REPLACEMENT',
}

/**
 * An enum of query types used by {@link Sequelize#query}.
 */
export enum QueryTypes {
  SELECT = 'SELECT',
  INSERT = 'INSERT',
  UPDATE = 'UPDATE',
  BULKUPDATE = 'BULKUPDATE',
  DELETE = 'DELETE',
  UPSERT = 'UPSERT',
  SHOWINDEXES = 'SHOWINDEXES',
  DESCRIBE = 'DESCRIBE',
  RAW = 'RAW',
  SHOWCONSTRAINTS = 'SHOWCONSTRAINTS',
}

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
export enum TableHints {
  NOLOCK = 'NOLOCK',
  READUNCOMMITTED = 'READUNCOMMITTED',
  UPDLOCK = 'UPDLOCK',
  REPEATABLEREAD = 'REPEATABLEREAD',
  SERIALIZABLE = 'SERIALIZABLE',
  READCOMMITTED = 'READCOMMITTED',
  TABLOCK = 'TABLOCK',
  TABLOCKX = 'TABLOCKX',
  PAGLOCK = 'PAGLOCK',
  ROWLOCK = 'ROWLOCK',
  NOWAIT = 'NOWAIT',
  READPAST = 'READPAST',
  XLOCK = 'XLOCK',
  SNAPSHOT = 'SNAPSHOT',
  NOEXPAND = 'NOEXPAND',
}
