import { rejectInvalidOptions } from '../../utils/check';
import { joinSQLFragments } from '../../utils/join-sql-fragments';
import { AbstractQueryGenerator } from '../abstract/query-generator';
import { REMOVE_CONSTRAINT_QUERY_SUPPORTABLE_OPTIONS } from '../abstract/query-generator-typescript';
import type { RemoveConstraintQueryOptions, TableNameOrModel } from '../abstract/query-generator-typescript';
import type { AddConstraintQueryOptions } from '../abstract/query-generator.types';

const REMOVE_CONSTRAINT_QUERY_SUPPORTED_OPTIONS = new Set<keyof RemoveConstraintQueryOptions>(['cascade']);

/**
 * Temporary class to ease the TypeScript migration
 */
export class SnowflakeQueryGeneratorTypeScript extends AbstractQueryGenerator {
  describeTableQuery(tableName: TableNameOrModel) {
    return `SHOW FULL COLUMNS FROM ${this.quoteTable(tableName)};`;
  }

  addConstraintQuery(tableName: TableNameOrModel, options: AddConstraintQueryOptions) {
    return joinSQLFragments([
      'ALTER TABLE',
      this.quoteTable(tableName),
      'ADD',
      this.getConstraintSnippet(tableName, options),
    ]);
  }

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
      this.quoteIdentifier(constraintName),
      options?.cascade ? 'CASCADE' : '',
    ]);
  }

  showConstraintsQuery(tableName: TableNameOrModel, constraintName?: string) {
    const table = this.extractTableDetails(tableName);

    return joinSQLFragments([
      'SELECT c.CONSTRAINT_CATALOG AS constraintCatalog,',
      'c.CONSTRAINT_SCHEMA AS constraintSchema,',
      'c.CONSTRAINT_NAME AS constraintName,',
      'c.CONSTRAINT_TYPE AS constraintType,',
      'c.TABLE_CATALOG AS tableCatalog,',
      'c.TABLE_SCHEMA AS tableSchema,',
      'c.TABLE_NAME AS tableName,',
      'fk.TABLE_SCHEMA AS referencedTableSchema,',
      'fk.TABLE_NAME AS referencedTableName,',
      'r.DELETE_RULE AS deleteAction,',
      'r.UPDATE_RULE AS updateAction,',
      'c.IS_DEFERRABLE AS isDeferrable,',
      'c.INITIALLY_DEFERRED AS initiallyDeferred',
      'FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS c',
      'LEFT JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS r ON c.CONSTRAINT_CATALOG = r.CONSTRAINT_CATALOG AND c.CONSTRAINT_SCHEMA = r.CONSTRAINT_SCHEMA AND c.CONSTRAINT_NAME = r.CONSTRAINT_NAME',
      'LEFT JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS fk ON r.UNIQUE_CONSTRAINT_CATALOG = fk.CONSTRAINT_CATALOG AND r.UNIQUE_CONSTRAINT_SCHEMA = fk.CONSTRAINT_SCHEMA AND r.UNIQUE_CONSTRAINT_NAME = fk.CONSTRAINT_NAME',
      `WHERE c.TABLE_NAME = ${this.escape(table.tableName)}`,
      `AND c.TABLE_SCHEMA = ${this.escape(table.schema)}`,
      constraintName ? `AND c.CONSTRAINT_NAME = ${this.escape(constraintName)}` : '',
      'ORDER BY c.CONSTRAINT_NAME',
    ]);
  }

  showIndexesQuery() {
    // TODO [+snowflake-sdk]: check if this is the correct implementation
    return `SELECT '' FROM DUAL`;
  }

  versionQuery() {
    return 'SELECT CURRENT_VERSION() AS "version"';
  }
}
