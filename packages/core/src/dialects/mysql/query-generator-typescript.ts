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

  getForeignKeyQuery(tableName: TableNameOrModel, columnName?: string) {
    const table = this.extractTableDetails(tableName);

    return joinSQLFragments([
      'SELECT CONSTRAINT_NAME as constraintName,',
      'CONSTRAINT_SCHEMA as constraintSchema,',
      'TABLE_NAME as tableName,',
      'TABLE_SCHEMA as tableSchema,',
      'COLUMN_NAME as columnName,',
      'REFERENCED_TABLE_SCHEMA as referencedTableSchema,',
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
}
