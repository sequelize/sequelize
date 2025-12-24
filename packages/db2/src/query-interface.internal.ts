import { IsolationLevel } from '@sequelize/core';
import { AbstractQueryInterfaceInternal } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-interface-internal.js';
import type { Db2Dialect } from './dialect.js';

/**
 * DB2 isolation level constants used by ibm_db driver.
 *
 * @see https://www.ibm.com/docs/en/db2/11.5.x?topic=keywords-txnisolation
 */
enum Db2IsolationLevel {
  READ_UNCOMMITTED = 1,
  READ_COMMITTED = 2,
  REPEATABLE_READ = 4,
  SERIALIZABLE = 8,
}

export class Db2QueryInterfaceInternal extends AbstractQueryInterfaceInternal {
  constructor(readonly dialect: Db2Dialect) {
    super(dialect);
  }

  /**
   * Parses the isolation level and returns the corresponding value for the ibm_db driver.
   *
   * @see https://www.ibm.com/docs/en/db2/11.5.x?topic=keywords-txnisolation
   *
   * @param value The isolation level to parse.
   */
  parseIsolationLevel(value: IsolationLevel): Db2IsolationLevel {
    switch (value) {
      case IsolationLevel.READ_UNCOMMITTED:
        return Db2IsolationLevel.READ_UNCOMMITTED;
      case IsolationLevel.READ_COMMITTED:
        return Db2IsolationLevel.READ_COMMITTED;
      case IsolationLevel.REPEATABLE_READ:
        return Db2IsolationLevel.REPEATABLE_READ;
      case IsolationLevel.SERIALIZABLE:
        return Db2IsolationLevel.SERIALIZABLE;
      default:
        throw new Error(`Unknown isolation level: ${value}`);
    }
  }
}
