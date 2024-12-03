import type {
  CreateDatabaseQueryOptions,
  ListDatabasesQueryOptions,
  ListSchemasQueryOptions,
  ListTablesQueryOptions,
  ShowConstraintsQueryOptions,
  StartTransactionQueryOptions,
  TableOrModel,
  TruncateTableQueryOptions,
} from '@sequelize/core';
import { AbstractQueryGenerator, Op } from '@sequelize/core';
import {
  CREATE_DATABASE_QUERY_SUPPORTABLE_OPTIONS,
  SHOW_CONSTRAINTS_QUERY_SUPPORTABLE_OPTIONS,
  START_TRANSACTION_QUERY_SUPPORTABLE_OPTIONS,
  TRUNCATE_TABLE_QUERY_SUPPORTABLE_OPTIONS,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator-typescript.js';
import { rejectInvalidOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import { joinSQLFragments } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/join-sql-fragments.js';
import { EMPTY_SET } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/object.js';
import type { SnowflakeDialect } from './dialect.js';
import { SnowflakeQueryGeneratorInternal } from './query-generator.internal.js';

const SHOW_CONSTRAINTS_QUERY_SUPPORTED_OPTIONS = new Set<keyof ShowConstraintsQueryOptions>([
  'constraintName',
  'constraintType',
]);

/**
 * Temporary class to ease the TypeScript migration
 */
export class SnowflakeQueryGeneratorTypeScript extends AbstractQueryGenerator {
  readonly #internals: SnowflakeQueryGeneratorInternal;

  constructor(
    dialect: SnowflakeDialect,
    internals: SnowflakeQueryGeneratorInternal = new SnowflakeQueryGeneratorInternal(dialect),
  ) {
    super(dialect, internals);

    internals.whereSqlBuilder.setOperatorKeyword(Op.regexp, 'REGEXP');
    internals.whereSqlBuilder.setOperatorKeyword(Op.notRegexp, 'NOT REGEXP');

    this.#internals = internals;
  }

  createDatabaseQuery(database: string, options?: CreateDatabaseQueryOptions) {
    if (options) {
      rejectInvalidOptions(
        'createDatabaseQuery',
        this.dialect,
        CREATE_DATABASE_QUERY_SUPPORTABLE_OPTIONS,
        EMPTY_SET,
        options,
      );
    }

    return joinSQLFragments([`CREATE DATABASE IF NOT EXISTS ${this.quoteIdentifier(database)}`]);
  }

  listDatabasesQuery(options?: ListDatabasesQueryOptions) {
    let sql = `SELECT DATABASE_NAME as "name", * FROM SNOWFLAKE.INFORMATION_SCHEMA.DATABASES WHERE "name" NOT IN ('SNOWFLAKE', 'SNOWFLAKE$GDS')`;
    if (options?.skip) {
      sql += ` AND UPPER("name") NOT IN (${options.skip.map(db => `UPPER(${this.escape(db)})`).join(', ')})`;
    }

    return sql;
  }

  listSchemasQuery(options?: ListSchemasQueryOptions) {
    let schemasToSkip = this.#internals.getTechnicalSchemaNames();
    if (options && Array.isArray(options?.skip)) {
      schemasToSkip = [...schemasToSkip, ...options.skip];
    }

    return joinSQLFragments([
      'SELECT SCHEMA_NAME AS "schema"',
      'FROM INFORMATION_SCHEMA.SCHEMATA',
      `WHERE SCHEMA_NAME NOT IN (${schemasToSkip.map(schema => this.escape(schema)).join(', ')})`,
    ]);
  }

  describeTableQuery(tableName: TableOrModel) {
    return `SHOW FULL COLUMNS FROM ${this.quoteTable(tableName)};`;
  }

  listTablesQuery(options?: ListTablesQueryOptions) {
    return joinSQLFragments([
      'SELECT TABLE_NAME AS "tableName",',
      'TABLE_SCHEMA AS "schema"',
      `FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'`,
      options?.schema
        ? `AND TABLE_SCHEMA = ${this.escape(options.schema)}`
        : `AND TABLE_SCHEMA NOT IN (${this.#internals
            .getTechnicalSchemaNames()
            .map(schema => this.escape(schema))
            .join(', ')})`,
      'ORDER BY TABLE_SCHEMA, TABLE_NAME',
    ]);
  }

  truncateTableQuery(tableName: TableOrModel, options?: TruncateTableQueryOptions) {
    if (options) {
      rejectInvalidOptions(
        'truncateTableQuery',
        this.dialect,
        TRUNCATE_TABLE_QUERY_SUPPORTABLE_OPTIONS,
        EMPTY_SET,
        options,
      );
    }

    return `TRUNCATE ${this.quoteTable(tableName)}`;
  }

  showConstraintsQuery(tableName: TableOrModel, options?: ShowConstraintsQueryOptions) {
    if (options) {
      rejectInvalidOptions(
        'showConstraintsQuery',
        this.dialect,
        SHOW_CONSTRAINTS_QUERY_SUPPORTABLE_OPTIONS,
        SHOW_CONSTRAINTS_QUERY_SUPPORTED_OPTIONS,
        options,
      );
    }

    const table = this.extractTableDetails(tableName);

    return joinSQLFragments([
      'SELECT c.CONSTRAINT_CATALOG AS "constraintCatalog",',
      'c.CONSTRAINT_SCHEMA AS "constraintSchema",',
      'c.CONSTRAINT_NAME AS "constraintName",',
      'c.CONSTRAINT_TYPE AS "constraintType",',
      'c.TABLE_CATALOG AS "tableCatalog",',
      'c.TABLE_SCHEMA AS "tableSchema",',
      'c.TABLE_NAME AS "tableName",',
      'fk.TABLE_SCHEMA AS "referencedTableSchema",',
      'fk.TABLE_NAME AS "referencedTableName",',
      'r.DELETE_RULE AS "deleteAction",',
      'r.UPDATE_RULE AS "updateAction",',
      'c.IS_DEFERRABLE AS "isDeferrable",',
      'c.INITIALLY_DEFERRED AS "initiallyDeferred"',
      'FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS c',
      'LEFT JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS r ON c.CONSTRAINT_CATALOG = r.CONSTRAINT_CATALOG AND c.CONSTRAINT_SCHEMA = r.CONSTRAINT_SCHEMA AND c.CONSTRAINT_NAME = r.CONSTRAINT_NAME',
      'LEFT JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS fk ON r.UNIQUE_CONSTRAINT_CATALOG = fk.CONSTRAINT_CATALOG AND r.UNIQUE_CONSTRAINT_SCHEMA = fk.CONSTRAINT_SCHEMA AND r.UNIQUE_CONSTRAINT_NAME = fk.CONSTRAINT_NAME',
      `WHERE c.TABLE_NAME = ${this.escape(table.tableName)}`,
      `AND c.TABLE_SCHEMA = ${this.escape(table.schema)}`,
      options?.constraintName
        ? `AND c.CONSTRAINT_NAME = ${this.escape(options.constraintName)}`
        : '',
      options?.constraintType
        ? `AND c.CONSTRAINT_TYPE = ${this.escape(options.constraintType)}`
        : '',
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

  startTransactionQuery(options?: StartTransactionQueryOptions): string {
    if (options) {
      rejectInvalidOptions(
        'startTransactionQuery',
        this.dialect,
        START_TRANSACTION_QUERY_SUPPORTABLE_OPTIONS,
        this.dialect.supports.startTransaction,
        options,
      );
    }

    return options?.transactionName
      ? `START TRANSACTION NAME ${this.quoteIdentifier(options.transactionName)}`
      : 'START TRANSACTION';
  }
}
