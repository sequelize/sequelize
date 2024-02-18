import { IsolationLevel } from '../../transaction';
import { AbstractQueryInterfaceInternal } from '../abstract/query-interface-internal';
import type { MssqlDialect } from './index.js';

export class MsSqlQueryInterfaceInternal extends AbstractQueryInterfaceInternal {
  constructor(readonly dialect: MssqlDialect) {
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
