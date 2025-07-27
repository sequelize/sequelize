import { IsolationLevel } from '@sequelize/core';
import { AbstractQueryInterfaceInternal } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-interface-internal.js';
import type { MsSqlDialect } from './dialect.js';

export class MsSqlQueryInterfaceInternal extends AbstractQueryInterfaceInternal {
  constructor(readonly dialect: MsSqlDialect) {
    super(dialect);
  }

  /**
   * Parses the isolation level and returns the corresponding value for tedious.
   *
   * @see https://github.com/tediousjs/tedious/blob/master/src/transaction.ts
   *
   * @param value The isolation level to parse.
   */
  parseIsolationLevel(value?: IsolationLevel | null | undefined): number {
    if (value == null) {
      return 0;
    }

    switch (value) {
      case IsolationLevel.READ_UNCOMMITTED:
        return 1;
      case IsolationLevel.READ_COMMITTED:
        return 2;
      case IsolationLevel.REPEATABLE_READ:
        return 3;
      case IsolationLevel.SERIALIZABLE:
        return 4;
      default:
        throw new Error(`Unknown isolation level: ${value}`);
    }
  }
}
