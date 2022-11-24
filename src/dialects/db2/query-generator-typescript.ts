import { randomBytes } from 'node:crypto';
import { ISOLATION_LEVELS } from '../../transaction';
import { joinSQLFragments } from '../../utils/join-sql-fragments';
import { AbstractQueryGenerator } from '../abstract/query-generator';
import type { StartTransactionQueryOptions, TableNameOrModel } from '../abstract/query-generator-typescript';

/**
 * Temporary class to ease the TypeScript migration
 */
export class Db2QueryGeneratorTypeScript extends AbstractQueryGenerator {
  describeTableQuery(tableName: TableNameOrModel) {
    const table = this.extractTableDetails(tableName);

    return joinSQLFragments([
      'SELECT NAME AS "Name", TBNAME AS "Table", TBCREATOR AS "Schema",',
      'TRIM(COLTYPE) AS "Type", LENGTH AS "Length", SCALE AS "Scale",',
      'NULLS AS "IsNull", DEFAULT AS "Default", COLNO AS "Colno",',
      'IDENTITY AS "IsIdentity", KEYSEQ AS "KeySeq", REMARKS AS "Comment"',
      'FROM',
      'SYSIBM.SYSCOLUMNS',
      `WHERE TBNAME = ${this.escape(table.tableName)}`,
      table.schema !== '' ? `AND TBCREATOR = ${this.escape(table.schema)}` : 'AND TBCREATOR = USER',
      ';',
    ]);
  }

  showIndexesQuery(tableName: TableNameOrModel) {
    const table = this.extractTableDetails(tableName);

    return joinSQLFragments([
      'SELECT NAME AS "name", TBNAME AS "tableName", UNIQUERULE AS "keyType",',
      'COLNAMES, INDEXTYPE AS "type" FROM SYSIBM.SYSINDEXES',
      `WHERE TBNAME = ${this.escape(table.tableName)}`,
      table.schema !== '' ? `AND TBCREATOR = ${this.escape(table.schema)}` : 'AND TBCREATOR = USER',
      'ORDER BY NAME;',
    ]);
  }

  // TODO: research if Db2 supports SERIALIZABLE https://www.ibm.com/docs/en/db2/11.5?topic=commands-change-isolation-level
  setIsolationLevelQuery(value: ISOLATION_LEVELS) {
    switch (value) {
      case ISOLATION_LEVELS.REPEATABLE_READ:
        return `CHANGE ISOLATION TO RR;`;
      case ISOLATION_LEVELS.READ_UNCOMMITTED:
        return `CHANGE ISOLATION TO UR;`;
      case ISOLATION_LEVELS.READ_COMMITTED:
        return `CHANGE ISOLATION TO CS;`;
      case ISOLATION_LEVELS.SERIALIZABLE:
        throw new Error(`Unsupported isolation level: ${value}`);
      default:
        throw new Error(`Unknown isolation level: ${value}`);
    }
  }

  generateTransactionId() {
    return randomBytes(10).toString('hex');
  }

  startTransactionQuery(_options: StartTransactionQueryOptions) {
    return 'BEGIN TRANSACTION;';
  }

  createSavepointQuery(savepointName: string) {
    return `SAVE TRANSACTION ${this.quoteIdentifier(savepointName)};`;
  }

  commitTransactionQuery() {
    return 'COMMIT TRANSACTION;';
  }

  rollbackTransactionQuery() {
    return 'ROLLBACK TRANSACTION;';
  }

  rollbackSavepointQuery(savepointName: string) {
    return `ROLLBACK TRANSACTION ${this.quoteIdentifier(savepointName)};`;
  }
}
