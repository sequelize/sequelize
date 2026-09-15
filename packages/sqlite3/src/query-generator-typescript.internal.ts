import type {
  BulkDeleteQueryOptions,
  GetConstraintSnippetQueryOptions,
  ListTablesQueryOptions,
  RemoveColumnQueryOptions,
  RemoveIndexQueryOptions,
  ShowConstraintsQueryOptions,
  StartTransactionQueryOptions,
  TableOrModel,
  TruncateTableQueryOptions,
} from '@sequelize/core';
import { AbstractQueryGenerator, IsolationLevel } from '@sequelize/core';
import { attributeTypeToSql } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/data-types-utils.js';
import type { NormalizedDataType } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/data-types.js';
import {
  LIST_TABLES_QUERY_SUPPORTABLE_OPTIONS,
  REMOVE_INDEX_QUERY_SUPPORTABLE_OPTIONS,
  START_TRANSACTION_QUERY_SUPPORTABLE_OPTIONS,
  TRUNCATE_TABLE_QUERY_SUPPORTABLE_OPTIONS,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator-typescript.js';
import type {
  AttributesToSqlColumns,
  AttributeToSqlColumn,
  AttributeToSqlInput,
  AttributeToSqlOptions,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator.internal-types.js';
import { rejectInvalidOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import { joinSQLFragments } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/join-sql-fragments.js';
import { extractModelDefinition } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/model-utils.js';
import { EMPTY_SET } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/object.js';
import { defaultValueSchemable } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/query-builder-utils.js';
import { generateIndexName } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/string.js';
import isPlainObject from 'lodash/isPlainObject';
import { randomBytes } from 'node:crypto';
import type { SqliteDialect } from './dialect.js';
import { SqliteQueryGeneratorInternal } from './query-generator.internal.js';
import type { SqliteColumnsDescription } from './query-interface.types.js';

const REMOVE_INDEX_QUERY_SUPPORTED_OPTIONS = new Set<keyof RemoveIndexQueryOptions>(['ifExists']);
const TRUNCATE_TABLE_QUERY_SUPPORTED_OPTIONS = new Set<keyof TruncateTableQueryOptions>([
  'restartIdentity',
]);

/**
 * Temporary class to ease the TypeScript migration
 */
export class SqliteQueryGeneratorTypeScript extends AbstractQueryGenerator {
  readonly #internals: SqliteQueryGeneratorInternal;

  constructor(
    dialect: SqliteDialect,
    internals: SqliteQueryGeneratorInternal = new SqliteQueryGeneratorInternal(dialect),
  ) {
    super(dialect, internals);

    this.#internals = internals;
  }

  describeTableQuery(tableName: TableOrModel) {
    return `PRAGMA TABLE_INFO(${this.quoteTable(tableName)})`;
  }

  describeCreateTableQuery(tableName: TableOrModel) {
    return `SELECT sql FROM sqlite_master WHERE tbl_name = ${this.escapeTable(tableName)};`;
  }

  listTablesQuery(options?: ListTablesQueryOptions) {
    if (options) {
      rejectInvalidOptions(
        'listTablesQuery',
        this.dialect,
        LIST_TABLES_QUERY_SUPPORTABLE_OPTIONS,
        EMPTY_SET,
        options,
      );
    }

    return "SELECT name AS `tableName` FROM sqlite_master WHERE type='table' AND name != 'sqlite_sequence'";
  }

  truncateTableQuery(tableName: TableOrModel, options?: TruncateTableQueryOptions) {
    if (options) {
      rejectInvalidOptions(
        'truncateTableQuery',
        this.dialect,
        TRUNCATE_TABLE_QUERY_SUPPORTABLE_OPTIONS,
        TRUNCATE_TABLE_QUERY_SUPPORTED_OPTIONS,
        options,
      );
    }

    const sql = [`DELETE FROM ${this.quoteTable(tableName)}`];
    if (options?.restartIdentity) {
      sql.push(
        `DELETE FROM ${this.quoteTable('sqlite_sequence')} WHERE ${this.quoteIdentifier('name')} = ${this.escapeTable(tableName)}`,
      );
    }

    return sql;
  }

  showConstraintsQuery(tableName: TableOrModel, _options?: ShowConstraintsQueryOptions) {
    return joinSQLFragments([
      'SELECT sql FROM sqlite_master',
      `WHERE tbl_name = ${this.escapeTable(tableName)}`,
    ]);
  }

  showIndexesQuery(tableName: TableOrModel) {
    return `PRAGMA INDEX_LIST(${this.quoteTable(tableName)})`;
  }

  getToggleForeignKeyChecksQuery(enable: boolean): string {
    return `PRAGMA foreign_keys = ${enable ? 'ON' : 'OFF'}`;
  }

  renameColumnQuery(
    _tableName: TableOrModel,
    _attrNameBefore: string,
    _attrNameAfter: string,
    _attributes: SqliteColumnsDescription,
  ): string {
    throw new Error(`renameColumnQuery is not supported in ${this.dialect.name}.`);
  }

  removeColumnQuery(
    _table: TableOrModel,
    _columnName: string,
    _options?: RemoveColumnQueryOptions,
  ): string {
    throw new Error(`removeColumnQuery is not supported in ${this.dialect.name}.`);
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

    return joinSQLFragments([
      'DROP INDEX',
      options?.ifExists ? 'IF EXISTS' : '',
      this.quoteIdentifier(indexName),
    ]);
  }

  // SQLite does not support renaming columns. The following is a workaround.
  _replaceColumnQuery(
    tableName: TableOrModel,
    attrNameBefore: string,
    attrNameAfter: string,
    attributes: SqliteColumnsDescription,
  ) {
    const table = this.extractTableDetails(tableName);
    const backupTable = this.extractTableDetails(
      `${table.tableName}_${randomBytes(8).toString('hex')}`,
      table,
    );
    const quotedTableName = this.quoteTable(table);
    const quotedBackupTableName = this.quoteTable(backupTable);

    const tableAttributes = this.attributesToSql(attributes as AttributesToSqlColumns);
    const attributeNamesImport = Object.keys(tableAttributes)
      .map(attr => {
        return attrNameAfter === attr
          ? `${this.quoteIdentifier(attrNameBefore)} AS ${this.quoteIdentifier(attr)}`
          : this.quoteIdentifier(attr);
      })
      .join(', ');
    const attributeNamesExport = Object.keys(tableAttributes)
      .map(attr => this.quoteIdentifier(attr))
      .join(', ');

    return [
      this.createTableQuery(backupTable, tableAttributes),
      `INSERT INTO ${quotedBackupTableName} SELECT ${attributeNamesImport} FROM ${quotedTableName};`,
      `DROP TABLE ${quotedTableName};`,
      this.createTableQuery(table, tableAttributes),
      `INSERT INTO ${quotedTableName} SELECT ${attributeNamesExport} FROM ${quotedBackupTableName};`,
      `DROP TABLE ${quotedBackupTableName};`,
    ];
  }

  // SQLite has limited ALTER TABLE capapibilites which requires the below workaround involving recreating tables.
  // This leads to issues with losing data or losing foreign key references.
  _replaceTableQuery(
    tableName: TableOrModel,
    attributes: SqliteColumnsDescription,
    createTableSql?: string,
  ) {
    const table = this.extractTableDetails(tableName);
    const backupTable = this.extractTableDetails(
      `${table.tableName}_${randomBytes(8).toString('hex')}`,
      table,
    );
    const quotedTableName = this.quoteTable(table);
    const quotedBackupTableName = this.quoteTable(backupTable);

    const tableAttributes = this.attributesToSql(attributes as AttributesToSqlColumns);
    const attributeNames = Object.keys(tableAttributes)
      .map(attr => this.quoteIdentifier(attr))
      .join(', ');

    const backupTableSql = createTableSql
      ? `${createTableSql.replace(`CREATE TABLE ${quotedTableName}`, `CREATE TABLE ${quotedBackupTableName}`)};`
      : this.createTableQuery(backupTable, tableAttributes);

    return [
      backupTableSql,
      `INSERT INTO ${quotedBackupTableName} SELECT ${attributeNames} FROM ${quotedTableName};`,
      `DROP TABLE ${quotedTableName};`,
      `ALTER TABLE ${quotedBackupTableName} RENAME TO ${quotedTableName};`,
    ];
  }

  private escapeTable(tableName: TableOrModel): string {
    const table = this.extractTableDetails(tableName);

    if (table.schema) {
      return this.escape(`${table.schema}${table.delimiter}${table.tableName}`);
    }

    return this.escape(table.tableName);
  }

  versionQuery() {
    return 'SELECT sqlite_version() as `version`';
  }

  tableExistsQuery(tableName: TableOrModel): string {
    return `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ${this.escapeTable(tableName)}`;
  }

  /**
   * Generates an SQL query to check if there are any foreign key violations in the db schema
   *
   * @param tableName
   */
  foreignKeyCheckQuery(tableName: TableOrModel) {
    return `PRAGMA foreign_key_check(${this.quoteTable(tableName)});`;
  }

  setIsolationLevelQuery(isolationLevel: IsolationLevel): string {
    switch (isolationLevel) {
      case IsolationLevel.REPEATABLE_READ:
        throw new Error(
          `The ${isolationLevel} isolation level is not supported by ${this.dialect.name}.`,
        );
      case IsolationLevel.READ_UNCOMMITTED:
        return 'PRAGMA read_uncommitted = 1';
      case IsolationLevel.READ_COMMITTED:
        throw new Error(
          `The ${isolationLevel} isolation level is not supported by ${this.dialect.name}.`,
        );
      case IsolationLevel.SERIALIZABLE:
        return 'PRAGMA read_uncommitted = 0';
      default:
        throw new Error(`Unknown isolation level: ${isolationLevel}`);
    }
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

    return joinSQLFragments([
      'BEGIN',
      // Use the transaction type from the options, or the default transaction type from the dialect
      options?.transactionType ?? this.sequelize.options.transactionType,
      'TRANSACTION',
    ]);
  }

  bulkDeleteQuery(tableOrModel: TableOrModel, options: BulkDeleteQueryOptions) {
    const table = this.quoteTable(tableOrModel);
    const modelDefinition = extractModelDefinition(tableOrModel);
    const whereOptions = { ...options, model: modelDefinition };
    const whereFragment = whereOptions.where
      ? this.whereQuery(whereOptions.where, whereOptions)
      : '';

    if (whereOptions.limit) {
      return joinSQLFragments([
        `DELETE FROM ${table} WHERE rowid IN (`,
        `SELECT rowid FROM ${table}`,
        whereFragment,
        this.#internals.addLimitAndOffset(whereOptions),
        ')',
      ]);
    }

    return joinSQLFragments([`DELETE FROM ${table}`, whereFragment]);
  }

  /**
   * Temporary function until we have moved the query generation of addConstraint here.
   *
   * @param tableName
   * @param options
   */
  _TEMPORARY_getConstraintSnippet(
    tableName: TableOrModel,
    options: GetConstraintSnippetQueryOptions,
  ): string {
    return this.#internals.getConstraintSnippet(tableName, options);
  }

  getRandomFloatFunctionCall(): string {
    // sqlite's RANDOM generates a value between -9223372036854775808 and +9223372036854775807, so we need to transform it to be between 0 and 1
    return '((RANDOM() + 9223372036854775808.0) / 18446744073709551616.0)';
  }

  attributeToSql(column: AttributeToSqlInput, options?: AttributeToSqlOptions): string {
    const attribute: AttributeToSqlColumn = isPlainObject(column)
      ? (column as AttributeToSqlColumn)
      : { type: column as NormalizedDataType };

    let sql = attributeTypeToSql(attribute.type);

    if (attribute.allowNull === false) {
      sql += ' NOT NULL';
    }

    if (defaultValueSchemable(attribute.defaultValue, this.dialect)) {
      // TODO thoroughly check that DataTypes.NOW will properly
      // get populated on all databases as DEFAULT value
      // i.e. mysql requires: DEFAULT CURRENT_TIMESTAMP
      sql += ` DEFAULT ${this.escape(attribute.defaultValue, { ...options, type: attribute.type })}`;
    }

    if (attribute.unique === true) {
      sql += ' UNIQUE';
    }

    if (attribute.primaryKey) {
      sql += ' PRIMARY KEY';

      if (attribute.autoIncrement) {
        sql += ' AUTOINCREMENT';
      }
    }

    if (!options?.withoutForeignKeyConstraints && attribute.references) {
      const referencesTable = this.quoteTable(attribute.references.table);

      let referencesKey: string;
      if (attribute.references.key) {
        referencesKey = this.quoteIdentifier(attribute.references.key);
      } else {
        referencesKey = this.quoteIdentifier('id');
      }

      sql += ` REFERENCES ${referencesTable} (${referencesKey})`;

      if (attribute.onDelete) {
        sql += ` ON DELETE ${attribute.onDelete.toUpperCase()}`;
      }

      if (attribute.onUpdate) {
        sql += ` ON UPDATE ${attribute.onUpdate.toUpperCase()}`;
      }
    }

    return sql;
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
