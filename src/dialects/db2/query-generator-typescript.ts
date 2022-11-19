import { joinSQLFragments } from '../../utils/join-sql-fragments';
import { AbstractQueryGenerator } from '../abstract/query-generator';
import type { TableNameWithSchema } from '../abstract/query-interface';

/**
 * Temporary class to ease the TypeScript migration
 */
export class Db2QueryGeneratorTypeScript extends AbstractQueryGenerator {
  describeTableQuery(table: TableNameWithSchema) {
    return joinSQLFragments([
      'SELECT NAME AS "Name", TBNAME AS "Table", TBCREATOR AS "Schema",',
      'TRIM(COLTYPE) AS "Type", LENGTH AS "Length", SCALE AS "Scale",',
      'NULLS AS "IsNull", DEFAULT AS "Default", COLNO AS "Colno",',
      'IDENTITY AS "IsIdentity", KEYSEQ AS "KeySeq", REMARKS AS "Comment"',
      'FROM',
      'SYSIBM.SYSCOLUMNS',
      `WHERE TBNAME = ${this.escape(table.tableName)}`,
      table.schema !== this.dialect.getDefaultSchema() ? `AND TBCREATOR = ${this.escape(table.schema)}` : 'AND TBCREATOR = USER',
      ';',
    ]);
  }

  showIndexesQuery(table: TableNameWithSchema) {
    return joinSQLFragments([
      'SELECT NAME AS "name", TBNAME AS "tableName", UNIQUERULE AS "keyType",',
      'COLNAMES, INDEXTYPE AS "type" FROM SYSIBM.SYSINDEXES',
      `WHERE TBNAME = ${this.escape(table.tableName)}`,
      table.schema !== this.dialect.getDefaultSchema() ? `AND TBCREATOR = ${this.escape(table.schema)}` : 'AND TBCREATOR = USER',
      'ORDER BY NAME;',
    ]);
  }
}
