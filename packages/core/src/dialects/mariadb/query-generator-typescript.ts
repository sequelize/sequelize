import { rejectInvalidOptions } from '../../utils/check';
import { joinSQLFragments } from '../../utils/join-sql-fragments';
import { generateIndexName } from '../../utils/string';
import {
  REMOVE_CONSTRAINT_QUERY_SUPPORTABLE_OPTIONS,
  REMOVE_INDEX_QUERY_SUPPORTABLE_OPTIONS,
} from '../abstract/query-generator-typescript';
import type { RemoveIndexQueryOptions, TableNameOrModel } from '../abstract/query-generator-typescript';
import type { RemoveConstraintQueryOptions } from '../abstract/query-generator.types';
import { MySqlQueryGenerator } from '../mysql/query-generator.js';

const REMOVE_CONSTRAINT_QUERY_SUPPORTED_OPTIONS = new Set<keyof RemoveConstraintQueryOptions>(['ifExists']);
const REMOVE_INDEX_QUERY_SUPPORTED_OPTIONS = new Set<keyof RemoveIndexQueryOptions>(['ifExists']);

/**
 * Temporary class to ease the TypeScript migration
 */
export class MariaDbQueryGeneratorTypeScript extends MySqlQueryGenerator {
  removeConstraintQuery(tableName: TableNameOrModel, constraintName: string, options?: RemoveConstraintQueryOptions) {
    if (options) {
      rejectInvalidOptions(
        'removeConstraintQuery',
        this.dialect.name,
        REMOVE_CONSTRAINT_QUERY_SUPPORTABLE_OPTIONS,
        REMOVE_CONSTRAINT_QUERY_SUPPORTED_OPTIONS,
        options,
      );
    }

    return joinSQLFragments([
      'ALTER TABLE',
      this.quoteTable(tableName),
      'DROP CONSTRAINT',
      options?.ifExists ? 'IF EXISTS' : '',
      this.quoteIdentifier(constraintName),
    ]);
  }

  showConstraintsQuery(tableName: TableNameOrModel, constraintName?: string) {
    const table = this.extractTableDetails(tableName);

    return joinSQLFragments([
      'SELECT c.CONSTRAINT_CATALOG AS constraintCatalog,',
      'c.CONSTRAINT_SCHEMA AS constraintSchema,',
      'c.CONSTRAINT_NAME AS constraintName,',
      'c.CONSTRAINT_TYPE AS constraintType,',
      'c.TABLE_SCHEMA AS tableSchema,',
      'c.TABLE_NAME AS tableName,',
      'kcu.COLUMN_NAME AS columnNames,',
      'kcu.REFERENCED_TABLE_NAME AS referencedTableName,',
      'kcu.REFERENCED_COLUMN_NAME AS referencedColumnNames,',
      'r.DELETE_RULE AS deleteAction,',
      'r.UPDATE_RULE AS updateAction,',
      'ch.CHECK_CLAUSE AS definition',
      'FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS c',
      'LEFT JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS r ON c.CONSTRAINT_CATALOG = r.CONSTRAINT_CATALOG',
      'AND c.CONSTRAINT_SCHEMA = r.CONSTRAINT_SCHEMA AND c.CONSTRAINT_NAME = r.CONSTRAINT_NAME AND c.TABLE_NAME = r.TABLE_NAME',
      'LEFT JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu ON r.CONSTRAINT_CATALOG = kcu.CONSTRAINT_CATALOG',
      'AND r.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME AND r.TABLE_NAME = kcu.TABLE_NAME',
      'LEFT JOIN INFORMATION_SCHEMA.CHECK_CONSTRAINTS ch ON c.CONSTRAINT_CATALOG = ch.CONSTRAINT_CATALOG',
      'AND c.CONSTRAINT_SCHEMA = ch.CONSTRAINT_SCHEMA AND c.CONSTRAINT_NAME = ch.CONSTRAINT_NAME',
      `WHERE c.TABLE_NAME = ${this.escape(table.tableName)}`,
      `AND c.TABLE_SCHEMA = ${this.escape(table.schema)}`,
      constraintName ? `AND c.CONSTRAINT_NAME = ${this.escape(constraintName)}` : '',
      'ORDER BY c.CONSTRAINT_NAME',
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

    let indexName;
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

  jsonPathExtractionQuery(sqlExpression: string, path: ReadonlyArray<number | string>, unquote: boolean): string {
    const sql = super.jsonPathExtractionQuery(sqlExpression, path, unquote);

    if (unquote) {
      return sql;
    }

    // MariaDB has a very annoying behavior with json_extract: It returns the JSON value as a proper JSON string (e.g. "true" or "null" instead true or null)
    // Except if the value is going to be used in a comparison, in which case it unquotes it automatically (even if we did not call JSON_UNQUOTE).
    // This is a problem because it makes it impossible to distinguish between a JSON text "true" and a JSON boolean true.
    // This useless function call is here to make mariadb not think the value will be used in a comparison, and thus not unquote it.
    // We could replace it with a custom function that does nothing, but this would require a custom function to be created on the database ahead of time.
    return `json_compact(${sql})`;
  }
}
