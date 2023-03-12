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
      `AND t.TABLE_SCHEMA = ${this.escape(table.schema!)}`,
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

  getForeignKeyQuery(tableName: TableNameOrModel, columnName?: string) {
    const table = this.extractTableDetails(tableName);

    // TODO: get the database from the provided tableName (see #12449)
    const catalogName = this.sequelize.config.database;
    const escapedCatalogName = this.escape(catalogName);

    return joinSQLFragments([
      `SELECT OBJ.NAME AS 'constraintName',`,
      `${escapedCatalogName} AS 'constraintCatalog',`,
      `SCHEMA_NAME(OBJ.SCHEMA_ID) AS 'constraintSchema',`,
      `TB.NAME AS 'tableName',`,
      `SCHEMA_NAME(TB.SCHEMA_ID) AS 'tableSchema',`,
      `${escapedCatalogName} AS 'tableCatalog',`,
      `COL.NAME AS 'columnName',`,
      `SCHEMA_NAME(RTB.SCHEMA_ID) AS 'referencedTableSchema',`,
      `${escapedCatalogName} AS 'referencedTableCatalog',`,
      `RTB.NAME AS 'referencedTableName',`,
      `RCOL.NAME AS 'referencedColumnName'`,
      'FROM sys.foreign_key_columns FKC',
      'INNER JOIN sys.objects OBJ ON OBJ.OBJECT_ID = FKC.CONSTRAINT_OBJECT_ID',
      'INNER JOIN sys.tables TB ON TB.OBJECT_ID = FKC.PARENT_OBJECT_ID',
      'INNER JOIN sys.columns COL ON COL.COLUMN_ID = PARENT_COLUMN_ID AND COL.OBJECT_ID = TB.OBJECT_ID',
      'INNER JOIN sys.tables RTB ON RTB.OBJECT_ID = FKC.REFERENCED_OBJECT_ID',
      'INNER JOIN sys.columns RCOL ON RCOL.COLUMN_ID = REFERENCED_COLUMN_ID AND RCOL.OBJECT_ID = RTB.OBJECT_ID',
      `WHERE TB.NAME = ${this.escape(table.tableName)}`,
      columnName && `AND COL.NAME = ${this.escape(columnName)}`,
      `AND SCHEMA_NAME(TB.SCHEMA_ID) = ${this.escape(table.schema!)}`,
    ]);
  }
}
