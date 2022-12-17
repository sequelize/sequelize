import { rejectInvalidOptions } from '../../utils/check';
import { joinSQLFragments } from '../../utils/join-sql-fragments';
import { generateIndexName } from '../../utils/string';
import { AbstractQueryGenerator } from '../abstract/query-generator';
import { REMOVE_INDEX_QUERY_SUPPORTABLE_OPTIONS } from '../abstract/query-generator-typescript';
import type { RemoveIndexQueryOptions, TableNameOrModel } from '../abstract/query-generator-typescript';

const REMOVE_INDEX_QUERY_SUPPORTED_OPTIONS = new Set<keyof RemoveIndexQueryOptions>();

const GET_FOREIGN_KEYS_PREFIX = [
  'SELECT CONSTRAINT_NAME as constraint_name,',
  'CONSTRAINT_NAME as constraintName,',
  'CONSTRAINT_SCHEMA as constraintSchema,',
  'CONSTRAINT_SCHEMA as constraintCatalog,',
  'TABLE_NAME as tableName,',
  'TABLE_SCHEMA as tableSchema,',
  'TABLE_SCHEMA as tableCatalog,',
  'COLUMN_NAME as columnName,',
  'REFERENCED_TABLE_SCHEMA as referencedTableSchema,',
  'REFERENCED_TABLE_SCHEMA as referencedTableCatalog,',
  'REFERENCED_TABLE_NAME as referencedTableName,',
  'REFERENCED_COLUMN_NAME as referencedColumnName',
  'FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE',
];

/**
 * Temporary class to ease the TypeScript migration
 */
export class MySqlQueryGeneratorTypeScript extends AbstractQueryGenerator {
  describeTableQuery(tableName: TableNameOrModel) {
    return `SHOW FULL COLUMNS FROM ${this.quoteTable(tableName)};`;
  }

  showIndexesQuery(tableName: TableNameOrModel) {
    return `SHOW INDEX FROM ${this.quoteTable(tableName)}`;
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

    return `DROP INDEX ${this.quoteIdentifier(indexName)} ON ${this.quoteTable(tableName)}`;
  }

  getForeignKeyQuery(tableName: TableNameOrModel, columnName?: string) {
    const table = this.extractTableDetails(tableName);

    if (!columnName) {
      return joinSQLFragments([
        GET_FOREIGN_KEYS_PREFIX,
        `where TABLE_NAME = ${this.escape(table.tableName)}`,
        `AND CONSTRAINT_NAME != 'PRIMARY' AND CONSTRAINT_SCHEMA = ${this.escape(table.schema!)}`,
        'AND REFERENCED_TABLE_NAME IS NOT NULL',
      ]);
    }

    const escapedTableName = this.escape(table.tableName);
    const escapedSchemaName = this.escape(table.schema!);
    const escapedColumnName = this.escape(columnName);

    // TODO: this should return the query for the foreign key constraint of the column/constraint, not the foreign keys that referece the table and column
    return joinSQLFragments([
      GET_FOREIGN_KEYS_PREFIX,
      'WHERE (',
      `REFERENCED_TABLE_NAME = ${escapedTableName}`,
      `AND REFERENCED_TABLE_SCHEMA = ${escapedSchemaName}`,
      `AND REFERENCED_COLUMN_NAME = ${escapedColumnName}`,
      ') OR (',
      `TABLE_NAME = ${escapedTableName}`,
      `AND TABLE_SCHEMA = ${escapedSchemaName}`,
      `AND COLUMN_NAME = ${escapedColumnName}`,
      'AND REFERENCED_TABLE_NAME IS NOT NULL',
      ')',
    ]);
  }
}
