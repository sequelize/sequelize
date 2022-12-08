import { rejectInvalidOptions } from '../../utils/check';
import { joinSQLFragments } from '../../utils/join-sql-fragments';
import { generateIndexName } from '../../utils/string';
import { AbstractQueryGenerator } from '../abstract/query-generator';
import { REMOVE_INDEX_QUERY_SUPPORTABLE_OPTIONS } from '../abstract/query-generator-typescript';
import type { RemoveIndexQueryOptions, TableNameOrModel } from '../abstract/query-generator-typescript';

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

  removeIndexQuery(tableName: TableNameOrModel, indexNameOrAttributes: string | string[], options: RemoveIndexQueryOptions) {
    if (options) {
      const REMOVE_INDEX_QUERY_SUPPORTED_OPTIONS = new Set<keyof RemoveIndexQueryOptions>();
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
}
