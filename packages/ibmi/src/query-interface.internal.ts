import { IsolationLevel } from '@sequelize/core';
import { AbstractQueryInterfaceInternal } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-interface-internal.js';
import type { IBMiDialect } from './dialect.js';

export class IBMiQueryInterfaceInternal extends AbstractQueryInterfaceInternal {
  constructor(readonly dialect: IBMiDialect) {
    super(dialect);
  }

  /**
   * Parses the isolation level and returns the corresponding value for odbc.
   *
   * @see https://github.com/markdirish/node-odbc/#setIsolationLevellevel-callback
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
