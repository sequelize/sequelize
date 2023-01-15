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

    return joinSQLFragments([
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
      'WHERE',
      `TABLE_NAME = ${this.escape(table.tableName)}`,
      `AND TABLE_SCHEMA = ${this.escape(table.schema!)}`,
      columnName && `AND COLUMN_NAME = ${this.escape(columnName)}`,
      'AND REFERENCED_TABLE_NAME IS NOT NULL',
    ]);
  }
}
