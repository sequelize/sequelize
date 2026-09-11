import type {
  Expression,
  ListSchemasQueryOptions,
  ListTablesQueryOptions,
  RemoveIndexQueryOptions,
  ShowConstraintsQueryOptions,
  TableOrModel,
  TruncateTableQueryOptions,
} from '@sequelize/core';
import { AbstractQueryGenerator, Op } from '@sequelize/core';
import {
  attributeTypeToDataTypeId,
  attributeTypeToSql,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/data-types-utils.js';
import type { NormalizedDataType } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/data-types.js';
import type { EscapeOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator-typescript.js';
import {
  REMOVE_INDEX_QUERY_SUPPORTABLE_OPTIONS,
  TRUNCATE_TABLE_QUERY_SUPPORTABLE_OPTIONS,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator-typescript.js';
import type {
  AttributesToSqlColumns,
  AttributeToSqlColumn,
  AttributeToSqlInput,
  AttributeToSqlOptions,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator.internal-types.js';
import { BaseSqlExpression } from '@sequelize/core/_non-semver-use-at-your-own-risk_/expression-builders/base-sql-expression.js';
import { rejectInvalidOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import { joinSQLFragments } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/join-sql-fragments.js';
import { buildJsonPath } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/json.js';
import { EMPTY_SET } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/object.js';
import { defaultValueSchemable } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/query-builder-utils.js';
import { generateIndexName } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/string.js';
import isPlainObject from 'lodash/isPlainObject';
import type { MySqlDialect } from './dialect.js';
import { MySqlQueryGeneratorInternal } from './query-generator.internal.js';

// MySQL only accepts a default on these types if it is written as an expression,
// i.e. wrapped in parentheses, even when the expression is a literal
const typeNeedingParenthesizedDefault = new Set(['BLOB', 'TEXT', 'GEOMETRY', 'JSON']);

/**
 * Temporary class to ease the TypeScript migration
 */
export class MySqlQueryGeneratorTypeScript extends AbstractQueryGenerator {
  readonly #internals: MySqlQueryGeneratorInternal;

  constructor(
    dialect: MySqlDialect,
    internals: MySqlQueryGeneratorInternal = new MySqlQueryGeneratorInternal(dialect),
  ) {
    super(dialect, internals);

    internals.whereSqlBuilder.setOperatorKeyword(Op.regexp, 'REGEXP');
    internals.whereSqlBuilder.setOperatorKeyword(Op.notRegexp, 'NOT REGEXP');

    this.#internals = internals;
  }

  listSchemasQuery(options?: ListSchemasQueryOptions) {
    let schemasToSkip = this.#internals.getTechnicalSchemaNames();
    if (options && Array.isArray(options?.skip)) {
      schemasToSkip = [...schemasToSkip, ...options.skip];
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
      options?.constraintName
        ? `AND c.CONSTRAINT_NAME = ${this.escape(options.constraintName)}`
        : '',
      options?.constraintType
        ? `AND c.CONSTRAINT_TYPE = ${this.escape(options.constraintType)}`
        : '',
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
        EMPTY_SET,
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

  jsonPathExtractionQuery(
    sqlExpression: string,
    path: ReadonlyArray<number | string>,
    unquote: boolean,
  ): string {
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
    return 'SELECT VERSION() as `version`';
  }

  getUuidV1FunctionCall(): string {
    return 'UUID()';
  }

  getRandomFloatFunctionCall(): string {
    return 'RAND()';
  }

  attributeToSql(column: AttributeToSqlInput, options?: AttributeToSqlOptions): string {
    const attribute: AttributeToSqlColumn = isPlainObject(column)
      ? (column as AttributeToSqlColumn)
      : { type: column as NormalizedDataType };

    let template = attributeTypeToSql(attribute.type);

    if (attribute.allowNull === false) {
      template += ' NOT NULL';
    }

    if (attribute.autoIncrement) {
      template += ' auto_increment';
    }

    if (defaultValueSchemable(attribute.defaultValue, this.dialect)) {
      const { defaultValue } = attribute;
      const escaped = this.escape(defaultValue);
      const needsParentheses =
        defaultValue instanceof BaseSqlExpression ||
        typeNeedingParenthesizedDefault.has(attributeTypeToDataTypeId(attribute.type));

      template += ` DEFAULT ${needsParentheses ? `(${escaped})` : escaped}`;
    }

    if (attribute.unique === true) {
      template += ' UNIQUE';
    }

    if (attribute.primaryKey) {
      template += ' PRIMARY KEY';
    }

    if (attribute.comment) {
      template += ` COMMENT ${this.escape(attribute.comment)}`;
    }

    if (attribute.first) {
      template += ' FIRST';
    }

    if (attribute.after) {
      template += ` AFTER ${this.quoteIdentifier(attribute.after)}`;
    }

    if (!options?.withoutForeignKeyConstraints && attribute.references) {
      if (options?.context === 'addColumn' && options.tableOrModel && attribute.field) {
        const fkName = this.quoteIdentifier(
          `${this.extractTableDetails(options.tableOrModel).tableName}_${attribute.field}_foreign_idx`,
        );

        template += `, ADD CONSTRAINT ${fkName} FOREIGN KEY (${this.quoteIdentifier(attribute.field)})`;
      }

      template += ` REFERENCES ${this.quoteTable(attribute.references.table)}`;

      if (attribute.references.key) {
        template += ` (${this.quoteIdentifier(attribute.references.key)})`;
      } else {
        template += ` (${this.quoteIdentifier('id')})`;
      }

      if (attribute.onDelete) {
        template += ` ON DELETE ${attribute.onDelete.toUpperCase()}`;
      }

      if (attribute.onUpdate) {
        template += ` ON UPDATE ${attribute.onUpdate.toUpperCase()}`;
      }
    }

    return template;
  }

  attributesToSql(
    columns: AttributesToSqlColumns,
    options?: AttributeToSqlOptions,
  ): Record<string, string> {
    const result: Record<string, string> = Object.create(null);

    for (const key of Object.keys(columns)) {
      const rawColumn = columns[key];
      const attribute: AttributeToSqlColumn = isPlainObject(rawColumn)
        ? { ...(rawColumn as AttributeToSqlColumn) }
        : { type: rawColumn as NormalizedDataType };
      const columnName = attribute.field || attribute.columnName || key;

      attribute.field = columnName;

      result[columnName] = this.attributeToSql(attribute, options);
    }

    return result;
  }
}
