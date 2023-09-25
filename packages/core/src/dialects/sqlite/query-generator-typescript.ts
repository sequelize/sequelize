import { randomBytes } from 'node:crypto';
import { rejectInvalidOptions } from '../../utils/check';
import { joinSQLFragments } from '../../utils/join-sql-fragments';
import { isModelStatic } from '../../utils/model-utils';
import { generateIndexName } from '../../utils/string';
import { AbstractQueryGenerator } from '../abstract/query-generator';
import {
  LIST_TABLES_QUERY_SUPPORTABLE_OPTIONS,
  REMOVE_INDEX_QUERY_SUPPORTABLE_OPTIONS,
  TRUNCATE_TABLE_QUERY_SUPPORTABLE_OPTIONS,
} from '../abstract/query-generator-typescript';
import type { RemoveIndexQueryOptions, TableNameOrModel } from '../abstract/query-generator-typescript';
import type {
  AddLimitOffsetOptions,
  DeleteQueryOptions,
  ListTablesQueryOptions,
  RemoveColumnQueryOptions,
  ShowConstraintsQueryOptions,
  TruncateTableQueryOptions,
} from '../abstract/query-generator.types';
import type { SqliteColumnsDescription } from './query-interface.types';

const LIST_TABLES_QUERY_SUPPORTED_OPTIONS = new Set<keyof ListTablesQueryOptions>();
const REMOVE_INDEX_QUERY_SUPPORTED_OPTIONS = new Set<keyof RemoveIndexQueryOptions>(['ifExists']);
const TRUNCATE_TABLE_QUERY_SUPPORTED_OPTIONS = new Set<keyof TruncateTableQueryOptions>(['restartIdentity']);

/**
 * Temporary class to ease the TypeScript migration
 */
export class SqliteQueryGeneratorTypeScript extends AbstractQueryGenerator {
  describeTableQuery(tableName: TableNameOrModel) {
    return `PRAGMA TABLE_INFO(${this.quoteTable(tableName)})`;
  }

  describeCreateTableQuery(tableName: TableNameOrModel) {
    return `SELECT sql FROM sqlite_master WHERE tbl_name = ${this.escapeTable(tableName)};`;
  }

  listTablesQuery(options?: ListTablesQueryOptions) {
    if (options) {
      rejectInvalidOptions(
        'listTablesQuery',
        this.dialect.name,
        LIST_TABLES_QUERY_SUPPORTABLE_OPTIONS,
        LIST_TABLES_QUERY_SUPPORTED_OPTIONS,
        options,
      );
    }

    return 'SELECT name AS `tableName` FROM sqlite_master WHERE type=\'table\' AND name != \'sqlite_sequence\'';
  }

  truncateTableQuery(tableName: TableNameOrModel, options?: TruncateTableQueryOptions) {
    if (options) {
      rejectInvalidOptions(
        'truncateTableQuery',
        this.dialect.name,
        TRUNCATE_TABLE_QUERY_SUPPORTABLE_OPTIONS,
        TRUNCATE_TABLE_QUERY_SUPPORTED_OPTIONS,
        options,
      );
    }

    const sql = [`DELETE FROM ${this.quoteTable(tableName)}`];
    if (options?.restartIdentity) {
      sql.push(`DELETE FROM ${this.quoteTable('sqlite_sequence')} WHERE ${this.quoteIdentifier('name')} = ${this.escapeTable(tableName)}`);
    }

    return sql;
  }

  showConstraintsQuery(tableName: TableNameOrModel, _options?: ShowConstraintsQueryOptions) {
    return joinSQLFragments([
      'SELECT sql FROM sqlite_master',
      `WHERE tbl_name = ${this.escapeTable(tableName)}`,
    ]);
  }

  showIndexesQuery(tableName: TableNameOrModel) {
    return `PRAGMA INDEX_LIST(${this.quoteTable(tableName)})`;
  }

  getToggleForeignKeyChecksQuery(enable: boolean): string {
    return `PRAGMA foreign_keys = ${enable ? 'ON' : 'OFF'}`;
  }

  renameColumnQuery(
    _tableName: TableNameOrModel,
    _attrNameBefore: string,
    _attrNameAfter: string,
    _attributes: SqliteColumnsDescription,
  ): string {
    throw new Error(`renameColumnQuery is not supported in ${this.dialect.name}.`);
  }

  removeColumnQuery(_table: TableNameOrModel, _columnName: string, _options?: RemoveColumnQueryOptions): string {
    throw new Error(`removeColumnQuery is not supported in ${this.dialect.name}.`);
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

    return joinSQLFragments([
      'DROP INDEX',
      options?.ifExists ? 'IF EXISTS' : '',
      this.quoteIdentifier(indexName),
    ]);
  }

  // SQLite does not support renaming columns. The following is a workaround.
  _replaceColumnQuery(
    tableName: TableNameOrModel,
    attrNameBefore: string,
    attrNameAfter: string,
    attributes: SqliteColumnsDescription,
  ) {
    const table = this.extractTableDetails(tableName);
    const backupTable = this.extractTableDetails(`${table.tableName}_${randomBytes(8).toString('hex')}`, table);
    const quotedTableName = this.quoteTable(table);
    const quotedBackupTableName = this.quoteTable(backupTable);

    const tableAttributes = this.attributesToSQL(attributes);
    const attributeNamesImport = Object.keys(tableAttributes).map(attr => (attrNameAfter === attr ? `${this.quoteIdentifier(attrNameBefore)} AS ${this.quoteIdentifier(attr)}` : this.quoteIdentifier(attr))).join(', ');
    const attributeNamesExport = Object.keys(tableAttributes).map(attr => this.quoteIdentifier(attr)).join(', ');

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
  _replaceTableQuery(tableName: TableNameOrModel, attributes: SqliteColumnsDescription, createTableSql?: string) {
    const table = this.extractTableDetails(tableName);
    const backupTable = this.extractTableDetails(`${table.tableName}_${randomBytes(8).toString('hex')}`, table);
    const quotedTableName = this.quoteTable(table);
    const quotedBackupTableName = this.quoteTable(backupTable);

    const tableAttributes = this.attributesToSQL(attributes);
    const attributeNames = Object.keys(tableAttributes).map(attr => this.quoteIdentifier(attr)).join(', ');

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

  private escapeTable(tableName: TableNameOrModel): string {
    const table = this.extractTableDetails(tableName);

    if (table.schema) {
      return this.escape(`${table.schema}${table.delimiter}${table.tableName}`);
    }

    return this.escape(table.tableName);
  }

  versionQuery() {
    return 'SELECT sqlite_version() as `version`';
  }

  tableExistsQuery(tableName: TableNameOrModel): string {

    return `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ${this.escapeTable(tableName)}`;
  }

  /**
   * Generates an SQL query to check if there are any foreign key violations in the db schema
   *
   * @param tableName
   */
  foreignKeyCheckQuery(tableName: TableNameOrModel) {
    return `PRAGMA foreign_key_check(${this.quoteTable(tableName)});`;
  }

  protected _addLimitAndOffset(options: AddLimitOffsetOptions) {
    let fragment = '';
    if (options.limit != null) {
      fragment += ` LIMIT ${this.escape(options.limit, options)}`;
    } else if (options.offset) {
      // limit must be specified if offset is specified.
      fragment += ` LIMIT -1`;
    }

    if (options.offset) {
      fragment += ` OFFSET ${this.escape(options.offset, options)}`;
    }

    return fragment;
  }

  deleteQuery(tableName: TableNameOrModel, options: DeleteQueryOptions) {
    const table = this.quoteTable(tableName);
    const whereOptions = isModelStatic(tableName) ? { ...options, model: tableName } : options;

    if (options.limit) {
      return joinSQLFragments([
        `DELETE FROM ${table} WHERE rowid IN (`,
        `SELECT rowid FROM ${table}`,
        options.where ? this.whereQuery(options.where, whereOptions) : '',
        this._addLimitAndOffset(options),
        ')',
      ]);
    }

    return joinSQLFragments([
      `DELETE FROM ${table}`,
      options.where ? this.whereQuery(options.where, whereOptions) : '',
    ]);
  }
}
