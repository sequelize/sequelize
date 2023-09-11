import { Op } from '../../operators.js';
import type { Expression } from '../../sequelize.js';
import { rejectInvalidOptions } from '../../utils/check';
import { joinSQLFragments } from '../../utils/join-sql-fragments';
import { buildJsonPath } from '../../utils/json.js';
import { generateIndexName } from '../../utils/string';
import { AbstractQueryGenerator } from '../abstract/query-generator';
import { REMOVE_INDEX_QUERY_SUPPORTABLE_OPTIONS } from '../abstract/query-generator-typescript';
import type {
  EscapeOptions,
  QueryGeneratorOptions,
  RemoveIndexQueryOptions,
  TableNameOrModel,
} from '../abstract/query-generator-typescript';
import type {
  ListSchemasQueryOptions,
  ListTablesQueryOptions,
  ShowConstraintsQueryOptions,
} from '../abstract/query-generator.types.js';

const REMOVE_INDEX_QUERY_SUPPORTED_OPTIONS = new Set<keyof RemoveIndexQueryOptions>(['ifExists']);

/**
 * Temporary class to ease the TypeScript migration
 */
export class MariaDbQueryGeneratorTypeScript extends AbstractQueryGenerator {
  constructor(options: QueryGeneratorOptions) {
    super(options);

    this.whereSqlBuilder.setOperatorKeyword(Op.regexp, 'REGEXP');
    this.whereSqlBuilder.setOperatorKeyword(Op.notRegexp, 'NOT REGEXP');
  }

  protected _getTechnicalSchemaNames() {
    return ['MYSQL', 'INFORMATION_SCHEMA', 'PERFORMANCE_SCHEMA', 'SYS', 'mysql', 'information_schema', 'performance_schema', 'sys'];
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

  describeTableQuery(tableName: TableNameOrModel) {
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

  showConstraintsQuery(tableName: TableNameOrModel, options?: ShowConstraintsQueryOptions) {
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
      'r.UPDATE_RULE AS updateAction,',
      'ch.CHECK_CLAUSE AS definition',
      'FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS c',
      'LEFT JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS r ON c.CONSTRAINT_CATALOG = r.CONSTRAINT_CATALOG',
      'AND c.CONSTRAINT_SCHEMA = r.CONSTRAINT_SCHEMA AND c.CONSTRAINT_NAME = r.CONSTRAINT_NAME AND c.TABLE_NAME = r.TABLE_NAME',
      'LEFT JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu ON c.CONSTRAINT_CATALOG = kcu.CONSTRAINT_CATALOG',
      'AND c.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA AND c.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME AND c.TABLE_NAME = kcu.TABLE_NAME',
      'LEFT JOIN INFORMATION_SCHEMA.CHECK_CONSTRAINTS ch ON c.CONSTRAINT_CATALOG = ch.CONSTRAINT_CATALOG',
      'AND c.CONSTRAINT_SCHEMA = ch.CONSTRAINT_SCHEMA AND c.CONSTRAINT_NAME = ch.CONSTRAINT_NAME',
      `WHERE c.TABLE_NAME = ${this.escape(table.tableName)}`,
      `AND c.TABLE_SCHEMA = ${this.escape(table.schema)}`,
      options?.columnName ? `AND kcu.COLUMN_NAME = ${this.escape(options.columnName)}` : '',
      options?.constraintName ? `AND c.CONSTRAINT_NAME = ${this.escape(options.constraintName)}` : '',
      options?.constraintType ? `AND c.CONSTRAINT_TYPE = ${this.escape(options.constraintType)}` : '',
      'ORDER BY c.CONSTRAINT_NAME, kcu.ORDINAL_POSITION',
    ]);
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

  getToggleForeignKeyChecksQuery(enable: boolean): string {
    return `SET FOREIGN_KEY_CHECKS=${enable ? '1' : '0'}`;
  }

  jsonPathExtractionQuery(sqlExpression: string, path: ReadonlyArray<number | string>, unquote: boolean): string {
    const extractQuery = `json_extract(${sqlExpression},${this.escape(buildJsonPath(path))})`;

    if (unquote) {
      return `json_unquote(${extractQuery})`;
    }

    // MariaDB has a very annoying behavior with json_extract: It returns the JSON value as a proper JSON string (e.g. `true` or `null` instead true or null)
    // Except if the value is going to be used in a comparison, in which case it unquotes it automatically (even if we did not call JSON_UNQUOTE).
    // This is a problem because it makes it impossible to distinguish between a JSON text `true` and a JSON boolean true.
    // This useless function call is here to make mariadb not think the value will be used in a comparison, and thus not unquote it.
    // We could replace it with a custom function that does nothing, but this would require a custom function to be created on the database ahead of time.
    return `json_compact(${extractQuery})`;
  }

  formatUnquoteJson(arg: Expression, options?: EscapeOptions) {
    return `json_unquote(${this.escape(arg, options)})`;
  }

  versionQuery() {
    return 'SELECT VERSION() as `version`';
  }
}
