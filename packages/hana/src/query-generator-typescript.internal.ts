import type {
  DropSchemaQueryOptions,
  Expression,
  TableOrModel,
} from '@sequelize/core';
import type {
  ListSchemasQueryOptions,
  ListTablesQueryOptions,
  RemoveIndexQueryOptions,
  ShowConstraintsQueryOptions,
} from '@sequelize/core';
import type { AddLimitOffsetOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator.internal-types.js';
import type {
  EscapeOptions,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator-typescript.js';
import { AbstractQueryGenerator, Op } from '@sequelize/core';
import { rejectInvalidOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import { joinSQLFragments } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/join-sql-fragments.js';
import { EMPTY_SET } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/object.js';
import { buildJsonPath } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/json.js';
import { generateIndexName } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/string.js';
import {
  DROP_SCHEMA_QUERY_SUPPORTABLE_OPTIONS,
  REMOVE_INDEX_QUERY_SUPPORTABLE_OPTIONS,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator-typescript.js';
import type { HanaDialect } from './dialect.js';
import { HanaQueryGeneratorInternal } from './query-generator.internal.js';

const DROP_SCHEMA_QUERY_SUPPORTED_OPTIONS = new Set<keyof DropSchemaQueryOptions>([
  'cascade',
]);

const REMOVE_INDEX_QUERY_SUPPORTED_OPTIONS = new Set<keyof RemoveIndexQueryOptions>();

/**
 * Temporary class to ease the TypeScript migration
 */
export class HanaQueryGeneratorTypeScript extends AbstractQueryGenerator {
  readonly #internals: HanaQueryGeneratorInternal;

  constructor(
    dialect: HanaDialect,
    internals: HanaQueryGeneratorInternal = new HanaQueryGeneratorInternal(dialect),
  ) {
    super(dialect, internals);

    this.#internals = internals;
  }

  protected _getTechnicalSchemaNames() {
    return ['HANA', 'INFORMATION_SCHEMA', 'PERFORMANCE_SCHEMA', 'SYS', 'hana', 'information_schema', 'performance_schema', 'sys'];
  }

  dropSchemaQuery(schemaName: string, options?: DropSchemaQueryOptions): string {
    if (options) {
      rejectInvalidOptions(
        'dropSchemaQuery',
        this.dialect,
        DROP_SCHEMA_QUERY_SUPPORTABLE_OPTIONS,
        DROP_SCHEMA_QUERY_SUPPORTED_OPTIONS,
        options,
      );
    }

    return super.dropSchemaQuery(schemaName, options);
  }

  listSchemasQuery(options?: ListSchemasQueryOptions) {
    const schemasToSkip = this._getTechnicalSchemaNames();

    if (options && Array.isArray(options?.skip)) {
      schemasToSkip.push(...options.skip);
    }

    return joinSQLFragments([
      'SELECT SCHEMA_NAME AS `schema`',
      'FROM INFORMATION_SCHEMA.SCHEMATA',
      `WHERE SCHEMA_NAME NOT IN (${schemasToSkip.map(schema => this.escape(schema)).join(', ')})`,
    ]);
  }

  describeTableQuery(tableName: TableOrModel) {
    return `SHOW FULL COLUMNS FROM ${this.quoteTable(tableName)};`;
  }

  listTablesQuery(options?: ListTablesQueryOptions) {
    return joinSQLFragments([
      'SELECT TABLE_NAME AS `tableName`,',
      'TABLE_SCHEMA AS `schema`',
      `FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'`,
      options?.schema
        ? `AND TABLE_SCHEMA = ${this.escape(options.schema)}`
        : `AND TABLE_SCHEMA NOT IN (${this._getTechnicalSchemaNames().map(schema => this.escape(schema)).join(', ')})`,
      'ORDER BY TABLE_SCHEMA, TABLE_NAME',
    ]);
  }

  showConstraintsQuery(tableName: TableOrModel, options?: ShowConstraintsQueryOptions) {
    const table = this.extractTableDetails(tableName);

    return joinSQLFragments([
      'SELECT c.CONSTRAINT_SCHEMA AS constraintSchema,',
      'c.CONSTRAINT_NAME AS constraintName,',
      'c.CONSTRAINT_TYPE AS constraintType,',
      'c.TABLE_SCHEMA AS tableSchema,',
      'c.TABLE_NAME AS tableName,',
      'kcu.COLUMN_NAME AS columnNames,',
      'kcu.REFERENCED_TABLE_SCHEMA AS referencedTableSchema,',
      'kcu.REFERENCED_TABLE_NAME AS referencedTableName,',
      'kcu.REFERENCED_COLUMN_NAME AS referencedColumnNames,',
      'r.DELETE_RULE AS deleteAction,',
      'r.UPDATE_RULE AS updateAction',
      'FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS c',
      'LEFT JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS r ON c.CONSTRAINT_CATALOG = r.CONSTRAINT_CATALOG',
      'AND c.CONSTRAINT_SCHEMA = r.CONSTRAINT_SCHEMA AND c.CONSTRAINT_NAME = r.CONSTRAINT_NAME AND c.TABLE_NAME = r.TABLE_NAME',
      'LEFT JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu ON c.CONSTRAINT_CATALOG = kcu.CONSTRAINT_CATALOG',
      'AND c.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA AND c.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME AND c.TABLE_NAME = kcu.TABLE_NAME',
      `WHERE c.TABLE_NAME = ${this.escape(table.tableName)}`,
      `AND c.TABLE_SCHEMA = ${this.escape(table.schema)}`,
      options?.columnName ? `AND kcu.COLUMN_NAME = ${this.escape(options.columnName)}` : '',
      options?.constraintName ? `AND c.CONSTRAINT_NAME = ${this.escape(options.constraintName)}` : '',
      options?.constraintType ? `AND c.CONSTRAINT_TYPE = ${this.escape(options.constraintType)}` : '',
      'ORDER BY c.CONSTRAINT_NAME, kcu.ORDINAL_POSITION',
    ]);
  }

  showIndexesQuery(tableName: TableOrModel) {
    return `SHOW INDEX FROM ${this.quoteTable(tableName)}`;
  }

  getToggleForeignKeyChecksQuery(enable: boolean): string {
    return `SET FOREIGN_KEY_CHECKS=${enable ? '1' : '0'}`;
  }

  removeIndexQuery(
    tableName: TableOrModel,
    indexNameOrAttributes: string | string[],
    options?: RemoveIndexQueryOptions,
  ) {
    if (options) {
      rejectInvalidOptions(
        'removeIndexQuery',
        this.dialect,
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

  jsonPathExtractionQuery(sqlExpression: string, path: ReadonlyArray<number | string>, unquote: boolean): string {
    const extractQuery = `json_extract(${sqlExpression},${this.escape(buildJsonPath(path))})`;
    if (unquote) {
      return `json_unquote(${extractQuery})`;
    }

    return extractQuery;
  }

  formatUnquoteJson(arg: Expression, options?: EscapeOptions) {
    return `json_unquote(${this.escape(arg, options)})`;
  }

  versionQuery() {
    return `SELECT "VALUE" AS "version" FROM SYS.M_SYSTEM_OVERVIEW WHERE "SECTION" = 'System' and "NAME" = 'Version'`;
  }

  protected _addLimitAndOffset(options: AddLimitOffsetOptions) {
    let fragment = '';
    if (options.limit != null) {
      fragment += ` LIMIT ${this.escape(options.limit, options)}`;
    } else if (options.offset) {
      // limit must be specified if offset is specified.
      fragment += ` LIMIT 18446744073709551615`;
    }

    if (options.offset) {
      fragment += ` OFFSET ${this.escape(options.offset, options)}`;
    }

    return fragment;
  }

}
