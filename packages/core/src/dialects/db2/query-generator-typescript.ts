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
      table.schema !== '' ? `AND TBCREATOR = ${this.escape(table.schema)}` : 'AND TBCREATOR = USER',
      ';',
    ]);
  }

  showConstraintsQuery(tableName: TableNameOrModel, constraintName?: string) {
    const table = this.extractTableDetails(tableName);

    return joinSQLFragments([
      'SELECT c.CONSTNAME AS "constraintName",',
      `CASE c.TYPE WHEN 'P' THEN 'PRIMARY KEY' WHEN 'F' THEN 'FOREIGN KEY' WHEN 'K' THEN 'CHECK' WHEN 'U' THEN 'UNIQUE' ELSE NULL END AS "constraintType",`,
      'c.TABSCHEMA AS "tableSchema",',
      'c.TABNAME AS "tableName",',
      'k.COLNAME AS "columnName",',
      'r.REFTABSCHEMA AS "referencedTableSchema",',
      'r.REFTABNAME AS "referencedTableName",',
      'fk.COLNAME AS "referencedColumnName",',
      `CASE r.DELETERULE WHEN 'A' THEN 'NO ACTION' WHEN 'C' THEN 'CASCADE' WHEN 'N' THEN 'SET NULL' WHEN 'R' THEN 'RESTRICT' ELSE NULL END AS "deleteRule",`,
      `CASE r.UPDATERULE WHEN 'A' THEN 'NO ACTION' WHEN 'R' THEN 'RESTRICT' ELSE NULL END AS "updateRule",`,
      'ck.TEXT AS "definition"',
      'FROM SYSCAT.TABCONST c',
      'LEFT JOIN SYSCAT.REFERENCES r ON c.CONSTNAME = r.CONSTNAME AND c.TABNAME = r.TABNAME AND c.TABSCHEMA = r.TABSCHEMA',
      'LEFT JOIN SYSCAT.KEYCOLUSE k ON r.CONSTNAME = k.CONSTNAME AND r.TABNAME = k.TABNAME AND r.TABSCHEMA = k.TABSCHEMA',
      'LEFT JOIN SYSCAT.KEYCOLUSE fk ON r.REFKEYNAME = fk.CONSTNAME',
      'LEFT JOIN SYSCAT.CHECKS ck ON c.CONSTNAME = ck.CONSTNAME AND c.TABNAME = ck.TABNAME AND c.TABSCHEMA = ck.TABSCHEMA',
      `WHERE c.TABNAME = ${this.escape(table.tableName)}`,
      'AND c.TABSCHEMA',
      table.schema ? this.escape(table.schema) : 'USER',
      constraintName ? `AND c.CONSTNAME = ${this.escape(constraintName)}` : '',
      'ORDER BY c.CONSTNAME',
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
}
