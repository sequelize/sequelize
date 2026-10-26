import type { QueryRawOptions, TableOrModel } from '@sequelize/core';
import { IsolationLevel, TransactionNestMode } from '@sequelize/core';
import { AbstractQueryInterfaceInternal } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-interface-internal.js';
import type { MsSqlDialect } from './dialect.js';

export class MsSqlQueryInterfaceInternal extends AbstractQueryInterfaceInternal {
  constructor(readonly dialect: MsSqlDialect) {
    super(dialect);
  }

  /**
   * Schema changes are transactional in SQL Server, so the column change and the unique key are done in one transaction:
   * if the unique key cannot be added (e.g. because of duplicate values), the column is not changed either.
   *
   * @param tableName The table that contains the column
   * @param columnName The name of the column, as it is in the database
   * @param changeColumnSql The query that changes the column
   * @param options Query options
   */
  async changeColumnAndAddUniqueKey(
    tableName: TableOrModel,
    columnName: string,
    changeColumnSql: string,
    options?: QueryRawOptions,
  ): Promise<unknown> {
    return this.dialect.sequelize.transaction(
      { nestMode: TransactionNestMode.savepoint, transaction: options?.transaction },
      async transaction => {
        return super.changeColumnAndAddUniqueKey(tableName, columnName, changeColumnSql, {
          ...options,
          transaction,
        });
      },
    );
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
