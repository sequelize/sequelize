import { IsolationLevel } from '@sequelize/core';
import { AbstractQueryInterfaceInternal } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-interface-internal.js';
import type { Db2Dialect } from './dialect.js';

export class Db2QueryInterfaceInternal extends AbstractQueryInterfaceInternal {
  constructor(readonly dialect: Db2Dialect) {
    super(dialect);
  }

  /**
   * Parses the isolation level and returns the corresponding value for tedious.
   *
   * @see https://www.ibm.com/docs/en/db2/11.5?topic=keywords-txnisolation
   *
   * @param value The isolation level to parse.
   */
  parseIsolationLevel(value: IsolationLevel): number {
    switch (value) {
      case IsolationLevel.READ_UNCOMMITTED:
        return 1;
      case IsolationLevel.READ_COMMITTED:
        return 2;
      case IsolationLevel.REPEATABLE_READ:
        return 4;
      case IsolationLevel.SERIALIZABLE:
        return 8;
      default:
        throw new Error(`Unknown isolation level: ${value}`);
    }
  }
}
