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
export class MsSqlQueryGeneratorTypeScript extends AbstractQueryGenerator {
  describeTableQuery(tableName: TableNameOrModel) {
    const table = this.extractTableDetails(tableName);

    return joinSQLFragments([
      'SELECT',
      `c.COLUMN_NAME AS 'Name',`,
      `c.DATA_TYPE AS 'Type',`,
      `c.CHARACTER_MAXIMUM_LENGTH AS 'Length',`,
      `c.IS_NULLABLE as 'IsNull',`,
      `COLUMN_DEFAULT AS 'Default',`,
      `pk.CONSTRAINT_TYPE AS 'Constraint',`,
      `COLUMNPROPERTY(OBJECT_ID(c.TABLE_SCHEMA+'.'+c.TABLE_NAME), c.COLUMN_NAME, 'IsIdentity') as 'IsIdentity',`,
      `CAST(prop.value AS NVARCHAR) AS 'Comment'`,
      'FROM',
      'INFORMATION_SCHEMA.TABLES t',
      'INNER JOIN',
      'INFORMATION_SCHEMA.COLUMNS c ON t.TABLE_NAME = c.TABLE_NAME AND t.TABLE_SCHEMA = c.TABLE_SCHEMA',
      'LEFT JOIN (SELECT tc.table_schema, tc.table_name,',
      'cu.column_name, tc.CONSTRAINT_TYPE',
      'FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc',
      'JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE  cu',
      'ON tc.table_schema=cu.table_schema and tc.table_name=cu.table_name',
      'and tc.constraint_name=cu.constraint_name',
      `and tc.CONSTRAINT_TYPE='PRIMARY KEY') pk`,
      'ON pk.table_schema=c.table_schema',
      'AND pk.table_name=c.table_name',
      'AND pk.column_name=c.column_name',
      'INNER JOIN sys.columns AS sc',
      `ON sc.object_id = object_id(t.table_schema + '.' + t.table_name) AND sc.name = c.column_name`,
      'LEFT JOIN sys.extended_properties prop ON prop.major_id = sc.object_id',
      'AND prop.minor_id = sc.column_id',
      `AND prop.name = 'MS_Description'`,
      `WHERE t.TABLE_NAME = ${this.escape(table.tableName)}`,
      `AND t.TABLE_SCHEMA = ${this.escape(table.schema)}`,
    ]);
  }

  showConstraintsQuery(tableName: TableNameOrModel, constraintName?: string) {
    const table = this.extractTableDetails(tableName);

    return joinSQLFragments([
      'SELECT DB_NAME() AS constraintCatalog,',
      's.[name] AS constraintSchema,',
      'c.constraintName,',
      `REPLACE(LEFT(c.constraintType, CHARINDEX('_CONSTRAINT', c.constraintType) - 1), '_', ' ') AS constraintType,`,
      'DB_NAME() AS tableCatalog,',
      's.[name] AS tableSchema,',
      't.[name] AS tableName,',
      'c.columnName,',
      'c.referencedTableName,',
      'c.referencedColumnName,',
      'c.deleteAction,',
      'c.updateAction,',
      'c.definition',
      'FROM sys.tables t INNER JOIN sys.schemas s ON t.schema_id = s.schema_id',
      'INNER JOIN (',
      'SELECT [name] AS constraintName, [type_desc] AS constraintType, [parent_object_id] AS constraintTableId, null AS columnName, null AS referencedTableName',
      ', null AS referencedColumnName, null AS deleteAction, null AS updateAction, null AS definition FROM sys.key_constraints UNION ALL',
      'SELECT [name] AS constraintName, [type_desc] AS constraintType, [parent_object_id] AS constraintTableId, null AS columnName, null AS referencedTableName',
      ', null AS referencedColumnName, null AS deleteAction, null AS updateAction, [definition] FROM sys.check_constraints c UNION ALL',
      'SELECT [name] AS constraintName, [type_desc] AS constraintType, [parent_object_id] AS constraintTableId, null AS columnName, null AS referencedTableName',
      ', null AS referencedColumnName, null AS deleteAction, null AS updateAction, [definition] FROM sys.default_constraints UNION ALL',
      'SELECT k.[name] AS constraintName, k.[type_desc] AS constraintType, k.[parent_object_id] AS constraintTableId, fcol.[name] AS columnName',
      ', OBJECT_NAME(k.[referenced_object_id]) AS referencedTableName, rcol.[name] AS referencedColumnName, k.[delete_referential_action_desc] AS deleteAction',
      ', k.[update_referential_action_desc] AS updateAction, null AS definition FROM sys.foreign_keys k INNER JOIN sys.foreign_key_columns c ON k.[object_id] = c.constraint_object_id',
      'INNER JOIN sys.columns fcol ON c.parent_column_id = fcol.column_id AND c.parent_object_id = fcol.object_id',
      'INNER JOIN sys.columns rcol ON c.referenced_column_id = rcol.column_id AND c.referenced_object_id = rcol.object_id',
      ') c ON t.object_id = c.constraintTableId',
      `WHERE s.name = ${this.escape(table.schema)} AND t.name = ${this.escape(table.tableName)}`,
      constraintName ? `AND c.constraintName = ${this.escape(constraintName)}` : '',
      'ORDER BY c.constraintName',
    ]);
  }

  showIndexesQuery(tableName: TableNameOrModel) {
    return `EXEC sys.sp_helpindex @objname = ${this.escape(this.quoteTable(tableName))};`;
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
      'DROP INDEX',
      options?.ifExists ? 'IF EXISTS' : '',
      this.quoteIdentifier(indexName),
      'ON',
      this.quoteTable(tableName),
    ]);
  }
}
