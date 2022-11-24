import { ISOLATION_LEVELS } from '../../transaction';
import type { StartTransactionQueryOptions, TableNameOrModel } from '../abstract/query-generator-typescript';
import { MySqlQueryGenerator } from '../mysql/query-generator';

/**
 * Temporary class to ease the TypeScript migration
 */
export class SqliteQueryGeneratorTypeScript extends MySqlQueryGenerator {
  describeTableQuery(tableName: TableNameOrModel) {
    return `PRAGMA TABLE_INFO(${this.quoteTable(tableName)});`;
  }

  showIndexesQuery(tableName: TableNameOrModel) {
    return `PRAGMA INDEX_LIST(${this.quoteTable(tableName)})`;
  }

  startTransactionQuery(options: StartTransactionQueryOptions) {
    if (options?.type) {
      return `BEGIN ${options.type} TRANSACTION;`;
    }

    return 'BEGIN TRANSACTION;';
  }

  createSavepointQuery(savepointName: string) {
    return `SAVEPOINT ${this.quoteIdentifier(savepointName)};`;
  }

  setIsolationLevelQuery(value: string) {
    switch (value) {
      case ISOLATION_LEVELS.REPEATABLE_READ:
        throw new Error(`Unsupported isolation level: ${value}`);
      case ISOLATION_LEVELS.READ_UNCOMMITTED:
        return 'PRAGMA read_uncommitted = ON;';
      case ISOLATION_LEVELS.READ_COMMITTED:
        return 'PRAGMA read_uncommitted = OFF;';
      case ISOLATION_LEVELS.SERIALIZABLE:
        return '-- SQLite\'s default isolation level is SERIALIZABLE. Nothing to do.';
      default:
        throw new Error(`Unknown isolation level: ${value}`);
    }
  }
}
