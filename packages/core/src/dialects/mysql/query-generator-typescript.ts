import semver from 'semver';
import { Op } from '../../operators.js';
import type { Expression } from '../../sequelize.js';
import { rejectInvalidOptions } from '../../utils/check';
import { joinSQLFragments } from '../../utils/join-sql-fragments';
import { generateIndexName } from '../../utils/string';
import { AbstractQueryGenerator } from '../abstract/query-generator';
import { REMOVE_INDEX_QUERY_SUPPORTABLE_OPTIONS } from '../abstract/query-generator-typescript';
import type {
  EscapeOptions,
  QueryGeneratorOptions,
  RemoveIndexQueryOptions,
  TableNameOrModel,
} from '../abstract/query-generator-typescript';

const REMOVE_INDEX_QUERY_SUPPORTED_OPTIONS = new Set<keyof RemoveIndexQueryOptions>();

/**
 * Temporary class to ease the TypeScript migration
 */
export class MySqlQueryGeneratorTypeScript extends AbstractQueryGenerator {
  constructor(options: QueryGeneratorOptions) {
    super(options);

    this.whereSqlBuilder.setOperatorKeyword(Op.regexp, 'REGEXP');
    this.whereSqlBuilder.setOperatorKeyword(Op.notRegexp, 'NOT REGEXP');
  }

  describeTableQuery(tableName: TableNameOrModel) {
    return `SHOW FULL COLUMNS FROM ${this.quoteTable(tableName)};`;
  }

  showConstraintsQuery(tableName: TableNameOrModel, constraintName?: string) {
    const table = this.extractTableDetails(tableName);
    const dbVersion = this.sequelize.getDatabaseVersion() || '0.0.0';

    // MySQL 8.0.16+ has a new INFORMATION_SCHEMA.CHECK_CONSTRAINTS table
    if (semver.gte(dbVersion, '8.0.16')) {
      return joinSQLFragments([
        'SELECT c.CONSTRAINT_CATALOG AS constraintCatalog,',
        'c.CONSTRAINT_SCHEMA AS constraintSchema,',
        'c.CONSTRAINT_NAME AS constraintName,',
        'c.CONSTRAINT_TYPE AS constraintType,',
        'c.TABLE_SCHEMA AS tableSchema,',
        'c.TABLE_NAME AS tableName,',
        'kcu.COLUMN_NAME AS columnName,',
        'kcu.REFERENCED_TABLE_NAME AS referencedTableName,',
        'kcu.REFERENCED_COLUMN_NAME AS referencedColumnName,',
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
        table.schema !== '' ? `AND c.TABLE_SCHEMA = ${this.escape(table.schema)}` : '',
        constraintName ? `AND c.CONSTRAINT_NAME = ${this.escape(constraintName)}` : '',
        'ORDER BY c.CONSTRAINT_NAME;',
      ]);
    }

    return joinSQLFragments([
      'SELECT c.CONSTRAINT_CATALOG AS constraintCatalog,',
      'c.CONSTRAINT_SCHEMA AS constraintSchema,',
      'c.CONSTRAINT_NAME AS constraintName,',
      'c.CONSTRAINT_TYPE AS constraintType,',
      'c.TABLE_SCHEMA AS tableSchema,',
      'c.TABLE_NAME AS tableName,',
      'kcu.COLUMN_NAME AS columnName,',
      'kcu.REFERENCED_TABLE_NAME AS referencedTableName,',
      'kcu.REFERENCED_COLUMN_NAME AS referencedColumnName,',
      'r.DELETE_RULE AS deleteAction,',
      'r.UPDATE_RULE AS updateAction',
      'FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS c',
      'LEFT JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS r ON c.CONSTRAINT_CATALOG = r.CONSTRAINT_CATALOG',
      'AND c.CONSTRAINT_SCHEMA = r.CONSTRAINT_SCHEMA AND c.CONSTRAINT_NAME = r.CONSTRAINT_NAME AND c.TABLE_NAME = r.TABLE_NAME',
      'LEFT JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu ON r.CONSTRAINT_CATALOG = kcu.CONSTRAINT_CATALOG',
      'AND r.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME AND r.TABLE_NAME = kcu.TABLE_NAME',
      `WHERE c.TABLE_NAME = ${this.escape(table.tableName)}`,
      table.schema !== '' ? `AND c.TABLE_SCHEMA = ${this.escape(table.schema)}` : '',
      constraintName ? `AND c.CONSTRAINT_NAME = ${this.escape(constraintName)}` : '',
      'ORDER BY c.CONSTRAINT_NAME;',
    ]);
  }

  showIndexesQuery(tableName: TableNameOrModel) {
    return `SHOW INDEX FROM ${this.quoteTable(tableName)}`;
  }

  getToggleForeignKeyChecksQuery(enable: boolean): string {
    return `SET FOREIGN_KEY_CHECKS=${enable ? '1' : '0'}`;
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

  jsonPathExtractionQuery(sqlExpression: string, path: ReadonlyArray<number | string>, unquote: boolean): string {
    let jsonPathStr = '$';
    for (const pathElement of path) {
      if (typeof pathElement === 'number') {
        jsonPathStr += `[${pathElement}]`;
      } else {
        jsonPathStr += `.${this.#quoteJsonPathIdentifier(pathElement)}`;
      }
    }

    const extractQuery = `json_extract(${sqlExpression},${this.escape(jsonPathStr)})`;
    if (unquote) {
      return `json_unquote(${extractQuery})`;
    }

    return extractQuery;
  }

  formatUnquoteJson(arg: Expression, options?: EscapeOptions) {
    return `json_unquote(${this.escape(arg, options)})`;
  }

  #quoteJsonPathIdentifier(identifier: string): string {
    if (/^[a-z_][a-z0-9_]*$/i.test(identifier)) {
      return identifier;
    }

    // Escape backslashes and double quotes
    return `"${identifier.replace(/["\\]/g, s => `\\${s}`)}"`;
  }
}
