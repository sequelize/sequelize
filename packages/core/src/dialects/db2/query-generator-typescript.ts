import { rejectInvalidOptions } from '../../utils/check';
import { joinSQLFragments } from '../../utils/join-sql-fragments';
import { generateIndexName } from '../../utils/string';
import { AbstractQueryGenerator } from '../abstract/query-generator';
import { REMOVE_INDEX_QUERY_SUPPORTABLE_OPTIONS } from '../abstract/query-generator-typescript';
import type { RemoveIndexQueryOptions, TableNameOrModel } from '../abstract/query-generator-typescript';
import type { AddConstraintQueryOptions } from '../abstract/query-generator.types';

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

  addConstraintQuery(tableName: TableNameOrModel, options: AddConstraintQueryOptions) {
    return joinSQLFragments([
      'ALTER TABLE',
      this.quoteTable(tableName),
      'ADD',
      this.getConstraintSnippet(tableName, options),
    ]);
  }

  showConstraintsQuery(tableName: TableNameOrModel, constraintName?: string) {
    const table = this.extractTableDetails(tableName);

    return joinSQLFragments([
      'SELECT c.TABSCHEMA AS "constraintSchema",',
      'c.CONSTNAME AS "constraintName",',
      `CASE c.TYPE WHEN 'P' THEN 'PRIMARY KEY' WHEN 'F' THEN 'FOREIGN KEY' WHEN 'K' THEN 'CHECK' WHEN 'U' THEN 'UNIQUE' ELSE NULL END AS "constraintType",`,
      'c.TABSCHEMA AS "tableSchema",',
      'c.TABNAME AS "tableName",',
      'k.COLNAME AS "columnNames",',
      'r.REFTABSCHEMA AS "referencedTableSchema",',
      'r.REFTABNAME AS "referencedTableName",',
      'fk.COLNAME AS "referencedColumnNames",',
      `CASE r.DELETERULE WHEN 'A' THEN 'NO ACTION' WHEN 'C' THEN 'CASCADE' WHEN 'N' THEN 'SET NULL' WHEN 'R' THEN 'RESTRICT' ELSE NULL END AS "deleteRule",`,
      `CASE r.UPDATERULE WHEN 'A' THEN 'NO ACTION' WHEN 'R' THEN 'RESTRICT' ELSE NULL END AS "updateRule",`,
      'ck.TEXT AS "definition"',
      'FROM SYSCAT.TABCONST c',
      'LEFT JOIN SYSCAT.REFERENCES r ON c.CONSTNAME = r.CONSTNAME AND c.TABNAME = r.TABNAME AND c.TABSCHEMA = r.TABSCHEMA',
      'LEFT JOIN SYSCAT.KEYCOLUSE k ON r.CONSTNAME = k.CONSTNAME AND r.TABNAME = k.TABNAME AND r.TABSCHEMA = k.TABSCHEMA',
      'LEFT JOIN SYSCAT.KEYCOLUSE fk ON r.REFKEYNAME = fk.CONSTNAME',
      'LEFT JOIN SYSCAT.CHECKS ck ON c.CONSTNAME = ck.CONSTNAME AND c.TABNAME = ck.TABNAME AND c.TABSCHEMA = ck.TABSCHEMA',
      `WHERE c.TABNAME = ${this.escape(table.tableName)}`,
      'AND c.TABSCHEMA =',
      table.schema ? this.escape(table.schema) : 'USER',
      constraintName ? `AND c.CONSTNAME = ${this.escape(constraintName)}` : '',
      'ORDER BY c.CONSTNAME',
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

  versionQuery() {
    return 'select service_level as "version" from TABLE (sysproc.env_get_inst_info()) as A';
  }
}
