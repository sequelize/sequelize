import { rejectInvalidOptions } from '../../utils/check';
import { joinSQLFragments } from '../../utils/join-sql-fragments';
import { generateIndexName } from '../../utils/string';
import { AbstractQueryGenerator } from '../abstract/query-generator';
import { REMOVE_INDEX_QUERY_SUPPORTABLE_OPTIONS } from '../abstract/query-generator-typescript';
import type { RemoveIndexQueryOptions, TableNameOrModel } from '../abstract/query-generator-typescript';

const REMOVE_INDEX_QUERY_SUPPORTED_OPTIONS = new Set<keyof RemoveIndexQueryOptions>();

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
      'AND TBCREATOR =',
      table.schema ? this.escape(table.schema) : 'USER',
      ';',
    ]);
  }

  showIndexesQuery(tableName: TableNameOrModel) {
    const table = this.extractTableDetails(tableName);

    return joinSQLFragments([
      'SELECT',
      'i.INDNAME AS "name",',
      'i.TABNAME AS "tableName",',
      'i.UNIQUERULE AS "keyType",',
      'i.INDEXTYPE AS "type",',
      'c.COLNAME AS "columnName",',
      'c.COLORDER AS "columnOrder"',
      'FROM SYSCAT.INDEXES i',
      'INNER JOIN SYSCAT.INDEXCOLUSE c ON i.INDNAME = c.INDNAME AND i.INDSCHEMA = c.INDSCHEMA',
      `WHERE TABNAME = ${this.escape(table.tableName)}`,
      'AND TABSCHEMA =',
      table.schema ? this.escape(table.schema) : 'USER',
      'ORDER BY i.INDNAME, c.COLSEQ;',
    ]);
  }

  removeIndexQuery(
    tableName: TableNameOrModel,
    indexNameOrAttributes: string | string[],
    options?: RemoveIndexQueryOptions,
  ) {
    if (options) {
      rejectInvalidOptions(
        'removeIndexQuery',
        this.dialect.name,
        REMOVE_INDEX_QUERY_SUPPORTABLE_OPTIONS,
        REMOVE_INDEX_QUERY_SUPPORTED_OPTIONS,
        options,
      );
    }

    let indexName: string;
    if (Array.isArray(indexNameOrAttributes)) {
      const table = this.extractTableDetails(tableName);
      indexName = generateIndexName(table, { fields: indexNameOrAttributes });
    } else {
      indexName = indexNameOrAttributes;
    }

    return `DROP INDEX ${this.quoteIdentifier(indexName)}`;
  }

  getForeignKeyQuery(tableName: TableNameOrModel, columnName?: string) {
    const table = this.extractTableDetails(tableName);

    return joinSQLFragments([
      'SELECT R.CONSTNAME AS "constraintName",',
      'TRIM(R.TABSCHEMA) AS "constraintSchema",',
      'R.TABNAME AS "tableName",',
      `TRIM(R.TABSCHEMA) AS "tableSchema", LISTAGG(C.COLNAME,', ')`,
      'WITHIN GROUP (ORDER BY C.COLNAME) AS "columnName",',
      'TRIM(R.REFTABSCHEMA) AS "referencedTableSchema",',
      'R.REFTABNAME AS "referencedTableName",',
      'TRIM(R.PK_COLNAMES) AS "referencedColumnName"',
      'FROM SYSCAT.REFERENCES R, SYSCAT.KEYCOLUSE C',
      'WHERE R.CONSTNAME = C.CONSTNAME AND R.TABSCHEMA = C.TABSCHEMA',
      'AND R.TABNAME = C.TABNAME',
      `AND R.TABNAME = ${this.escape(table.tableName)}`,
      'AND R.TABSCHEMA =',
      table.schema ? this.escape(table.schema) : 'CURRENT SCHEMA',
      columnName && `AND C.COLNAME = ${this.escape(columnName)}`,
      'GROUP BY R.REFTABSCHEMA,',
      'R.REFTABNAME, R.TABSCHEMA, R.TABNAME, R.CONSTNAME, R.PK_COLNAMES',
    ]);
  }
}
