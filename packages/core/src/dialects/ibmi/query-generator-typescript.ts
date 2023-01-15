import { rejectInvalidOptions } from '../../utils/check';
import { joinSQLFragments } from '../../utils/join-sql-fragments';
import { generateIndexName } from '../../utils/string';
import { AbstractQueryGenerator } from '../abstract/query-generator';
import { REMOVE_INDEX_QUERY_SUPPORTABLE_OPTIONS } from '../abstract/query-generator-typescript';
import type { RemoveIndexQueryOptions, TableNameOrModel } from '../abstract/query-generator-typescript';

const REMOVE_INDEX_QUERY_SUPPORTED_OPTIONS = new Set<keyof RemoveIndexQueryOptions>(['ifExists']);

/**
 * Temporary class to ease the TypeScript migration
 */
export class IBMiQueryGeneratorTypeScript extends AbstractQueryGenerator {
  describeTableQuery(tableName: TableNameOrModel) {
    const table = this.extractTableDetails(tableName);

    return joinSQLFragments([
      'SELECT',
      'QSYS2.SYSCOLUMNS.*,',
      'QSYS2.SYSCST.CONSTRAINT_NAME,',
      'QSYS2.SYSCST.CONSTRAINT_TYPE',
      'FROM QSYS2.SYSCOLUMNS',
      'LEFT OUTER JOIN QSYS2.SYSCSTCOL',
      'ON QSYS2.SYSCOLUMNS.TABLE_SCHEMA = QSYS2.SYSCSTCOL.TABLE_SCHEMA',
      'AND QSYS2.SYSCOLUMNS.TABLE_NAME = QSYS2.SYSCSTCOL.TABLE_NAME',
      'AND QSYS2.SYSCOLUMNS.COLUMN_NAME = QSYS2.SYSCSTCOL.COLUMN_NAME',
      'LEFT JOIN QSYS2.SYSCST',
      'ON QSYS2.SYSCSTCOL.CONSTRAINT_NAME = QSYS2.SYSCST.CONSTRAINT_NAME',
      'WHERE QSYS2.SYSCOLUMNS.TABLE_SCHEMA =',
      table.schema !== '' ? `${this.escape(table.schema)}` : 'CURRENT SCHEMA',
      'AND QSYS2.SYSCOLUMNS.TABLE_NAME =',
      `${this.escape(table.tableName)}`,
    ]);
  }

  showConstraintsQuery(tableName: TableNameOrModel, constraintName?: string) {
    const table = this.extractTableDetails(tableName);

    return joinSQLFragments([
      'SELECT c.CONSTRAINT_NAME AS "constraintName",',
      'c.CONSTRAINT_SCHEMA AS "constraintSchema",',
      'c.CONSTRAINT_TYPE AS "constraintType",',
      'c.TABLE_SCHEMA AS "tableSchema",',
      'c.TABLE_NAME AS "tableName",',
      'k.COLUMN_NAME AS "columnName",',
      'fk.TABLE_SCHEMA AS "referencedTableSchema",',
      'fk.TABLE_NAME AS "referencedTableName",',
      'fk.COLUMN_NAME AS "referencedColumnName",',
      'r.DELETE_RULE AS "deleteRule",',
      'r.UPDATE_RULE AS "updateRule",',
      'ch.CHECK_CLAUSE AS "definition",',
      'c.IS_DEFERRABLE AS "isDeferrable",',
      'c.INITIALLY_DEFERRED AS "initiallyDeferred"',
      'FROM QSYS2.SYSCST c',
      'LEFT JOIN QSYS2.SYSREFCST r ON c.CONSTRAINT_NAME = r.CONSTRAINT_NAME AND c.CONSTRAINT_SCHEMA = r.CONSTRAINT_SCHEMA',
      'LEFT JOIN QSYS2.SYSKEYCST k ON r.CONSTRAINT_NAME = k.CONSTRAINT_NAME AND r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA',
      'LEFT JOIN QSYS2.SYSKEYCST fk ON r.UNIQUE_CONSTRAINT_NAME = k.CONSTRAINT_NAME AND r.UNIQUE_CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA',
      'LEFT JOIN QSYS2.SYSCHKCST ch ON c.CONSTRAINT_NAME = ch.CONSTRAINT_NAME AND c.CONSTRAINT_SCHEMA = ch.CONSTRAINT_SCHEMA',
      `WHERE c.TABLE_NAME = ${this.escape(table.tableName)}`,
      'AND c.TABLE_SCHEMA =',
      table.schema ? this.escape(table.schema) : 'CURRENT SCHEMA',
      constraintName ? `AND c.CONSTRAINT_NAME = ${this.escape(constraintName)}` : '',
      'ORDER BY c.CONSTRAINT_NAME',
    ]);
  }

  showIndexesQuery(tableName: TableNameOrModel) {
    const table = this.extractTableDetails(tableName);

    // TODO [+odbc]: check if the query also works when capitalized (for consistency)
    return joinSQLFragments([
      'select QSYS2.SYSCSTCOL.CONSTRAINT_NAME as NAME, QSYS2.SYSCSTCOL.COLUMN_NAME, QSYS2.SYSCST.CONSTRAINT_TYPE, QSYS2.SYSCST.TABLE_SCHEMA,',
      'QSYS2.SYSCST.TABLE_NAME from QSYS2.SYSCSTCOL left outer join QSYS2.SYSCST on QSYS2.SYSCSTCOL.TABLE_SCHEMA = QSYS2.SYSCST.TABLE_SCHEMA and',
      'QSYS2.SYSCSTCOL.TABLE_NAME = QSYS2.SYSCST.TABLE_NAME and QSYS2.SYSCSTCOL.CONSTRAINT_NAME = QSYS2.SYSCST.CONSTRAINT_NAME where',
      'QSYS2.SYSCSTCOL.TABLE_SCHEMA =',
      table.schema !== '' ? `${this.escape(table.schema)}` : 'CURRENT SCHEMA',
      `and QSYS2.SYSCSTCOL.TABLE_NAME = ${this.escape(table.tableName)} union select QSYS2.SYSKEYS.INDEX_NAME AS NAME,`,
      `QSYS2.SYSKEYS.COLUMN_NAME, CAST('INDEX' AS VARCHAR(11)), QSYS2.SYSINDEXES.TABLE_SCHEMA, QSYS2.SYSINDEXES.TABLE_NAME from QSYS2.SYSKEYS`,
      'left outer join QSYS2.SYSINDEXES on QSYS2.SYSKEYS.INDEX_NAME = QSYS2.SYSINDEXES.INDEX_NAME where QSYS2.SYSINDEXES.TABLE_SCHEMA =',
      table.schema !== '' ? `${this.escape(table.schema)}` : 'CURRENT SCHEMA',
      `and QSYS2.SYSINDEXES.TABLE_NAME = ${this.escape(table.tableName)}`,
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

    return joinSQLFragments([
      'BEGIN',
      options?.ifExists ? `IF EXISTS (SELECT * FROM QSYS2.SYSINDEXES WHERE INDEX_NAME = ${this.quoteIdentifier(indexName)}) THEN` : '',
      `DROP INDEX ${this.quoteIdentifier(indexName)};`,
      'COMMIT;',
      options?.ifExists ? 'END IF;' : '',
      'END',
    ]);
  }
}
