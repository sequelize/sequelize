import { randomBytes } from 'node:crypto';
import { inspect } from 'node:util';
import type { AttributeOptions } from '../../model';
import { rejectInvalidOptions } from '../../utils/check';
import { removeNullishValuesFromArray, removeNullishValuesFromHash } from '../../utils/format';
import { joinSQLFragments } from '../../utils/join-sql-fragments';
import { isModelStatic } from '../../utils/model-utils';
import { generateIndexName } from '../../utils/string';
import { AbstractQueryGenerator } from '../abstract/query-generator';
import {
  BULK_INSERT_QUERY_SUPPORTABLE_OPTIONS,
  INSERT_QUERY_SUPPORTABLE_OPTIONS,
  LIST_TABLES_QUERY_SUPPORTABLE_OPTIONS,
  REMOVE_INDEX_QUERY_SUPPORTABLE_OPTIONS,
  TRUNCATE_TABLE_QUERY_SUPPORTABLE_OPTIONS,
} from '../abstract/query-generator-typescript';
import type { QueryWithBindParams, RemoveIndexQueryOptions, TableNameOrModel } from '../abstract/query-generator-typescript';
import type {
  BulkDeleteQueryOptions,
  BulkInsertQueryOptions,
  GetConstraintSnippetQueryOptions,
  InsertQueryOptions,
  ListTablesQueryOptions,
  RemoveColumnQueryOptions,
  ShowConstraintsQueryOptions,
  TruncateTableQueryOptions,
} from '../abstract/query-generator.types';
import { SqliteQueryGeneratorInternal } from './query-generator-internal.js';
import type { SqliteColumnsDescription } from './query-interface.types';
import type { SqliteDialect } from './index.js';

const BULK_INSERT_QUERY_SUPPORTED_OPTIONS = new Set<keyof BulkInsertQueryOptions>(['conflictWhere', 'ignoreDuplicates', 'returning', 'updateOnDuplicate']);
const INSERT_QUERY_SUPPORTED_OPTIONS = new Set<keyof InsertQueryOptions>(['conflictWhere', 'ignoreDuplicates', 'returning', 'updateOnDuplicate']);
const LIST_TABLES_QUERY_SUPPORTED_OPTIONS = new Set<keyof ListTablesQueryOptions>();
const REMOVE_INDEX_QUERY_SUPPORTED_OPTIONS = new Set<keyof RemoveIndexQueryOptions>(['ifExists']);
const TRUNCATE_TABLE_QUERY_SUPPORTED_OPTIONS = new Set<keyof TruncateTableQueryOptions>(['restartIdentity']);

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

  bulkDeleteQuery(tableName: TableNameOrModel, options: BulkDeleteQueryOptions) {
    const table = this.quoteTable(tableName);
    const whereOptions = isModelStatic(tableName) ? { ...options, model: tableName } : options;

    if (options.limit) {
      return joinSQLFragments([
        `DELETE FROM ${table} WHERE rowid IN (`,
        `SELECT rowid FROM ${table}`,
        options.where ? this.whereQuery(options.where, whereOptions) : '',
        this.#internals.addLimitAndOffset(options),
        ')',
      ]);
    }

    return joinSQLFragments([
      `DELETE FROM ${table}`,
      options.where ? this.whereQuery(options.where, whereOptions) : '',
    ]);
  }

  bulkInsertQuery(
    tableName: TableNameOrModel,
    values: Array<Record<string, unknown>>,
    options?: BulkInsertQueryOptions,
    attributeHash?: Record<string, AttributeOptions>,
  ): string {
    if (options) {
      rejectInvalidOptions(
        'bulkInsertQuery',
        this.dialect.name,
        BULK_INSERT_QUERY_SUPPORTABLE_OPTIONS,
        BULK_INSERT_QUERY_SUPPORTED_OPTIONS,
        options,
      );

      if (options.ignoreDuplicates && options.updateOnDuplicate) {
        throw new Error('Options ignoreDuplicates and updateOnDuplicate cannot be used together');
      }
    }

    if (!Array.isArray(values)) {
      throw new Error(`Invalid values: ${inspect(values)}. Expected an array.`);
    }

    if (values.length === 0) {
      throw new Error('Invalid values: []. Expected at least one element.');
    }

    const model = isModelStatic(tableName) ? tableName : options?.model;
    const allColumns = new Set<string>();
    const valueHashes = removeNullishValuesFromArray(values, this.options.omitNull ?? false);
    const attributeMap = new Map<string, AttributeOptions>();
    const bulkInsertOptions = { ...options, model };

    if (model) {
      for (const [column, attribute] of model.modelDefinition.physicalAttributes.entries()) {
        attributeMap.set(attribute?.columnName ?? column, attribute);
      }
    } else if (attributeHash) {
      for (const [column, attribute] of Object.entries(attributeHash)) {
        attributeMap.set(attribute?.columnName ?? column, attribute);
      }
    }

    for (const row of valueHashes) {
      for (const column of Object.keys(row)) {
        allColumns.add(column);
      }
    }

    if (allColumns.size === 0) {
      throw new Error('No columns were defined');
    }

    const columnFragment = [...allColumns].map(column => this.quoteIdentifier(column)).join(',');
    const rowsFragment = valueHashes.map(row => {
      if (typeof row !== 'object' || row == null || Array.isArray(row)) {
        throw new Error(`Invalid row: ${inspect(row)}. Expected an object.`);
      }

      const valueMap = new Map<string, string>();
      for (const column of allColumns) {
        // SQLite does not support DEFAULT in values so default to null if undefined
        const rowValue = row[column] ?? null;

        valueMap.set(column, this.escape(rowValue, {
          ...bulkInsertOptions,
          type: attributeMap.get(column)?.type,
        }));
      }

      return `(${[...valueMap.values()].join(',')})`;
    });

    const conflictFragment = bulkInsertOptions.updateOnDuplicate ? this.#internals.generateUpdateOnDuplicateKeysFragment(bulkInsertOptions) : '';
    const returningFragment = bulkInsertOptions.returning ? joinSQLFragments(['RETURNING', this.#internals.getReturnFields(bulkInsertOptions, attributeMap).join(', ')]) : '';

    return joinSQLFragments([
      'INSERT',
      bulkInsertOptions.ignoreDuplicates ? 'OR IGNORE' : '',
      'INTO',
      this.quoteTable(tableName),
      `(${columnFragment})`,
      'VALUES',
      rowsFragment.join(','),
      conflictFragment,
      returningFragment,
    ]);
  }

  insertQuery(
    tableName: TableNameOrModel,
    value: Record<string, unknown>,
    options?: InsertQueryOptions,
    attributeHash?: Record<string, AttributeOptions>,
  ): QueryWithBindParams {
    if (options) {
      rejectInvalidOptions(
        'insertQuery',
        this.dialect.name,
        INSERT_QUERY_SUPPORTABLE_OPTIONS,
        INSERT_QUERY_SUPPORTED_OPTIONS,
        options,
      );

      if (options.ignoreDuplicates && options.updateOnDuplicate) {
        throw new Error('Options ignoreDuplicates and updateOnDuplicate cannot be used together');
      }
    }

    if (typeof value !== 'object' || value == null || Array.isArray(value)) {
      throw new Error(`Invalid value: ${inspect(value)}. Expected an object.`);
    }

    const bind = Object.create(null);
    const model = isModelStatic(tableName) ? tableName : options?.model;
    const valueMap = new Map<string, string>();
    const valueHash = removeNullishValuesFromHash(value, this.options.omitNull ?? false);
    const attributeMap = new Map<string, AttributeOptions>();
    const insertOptions: InsertQueryOptions = {
      ...options,
      model,
      bindParam: options?.bindParam === undefined ? this.#internals.bindParam(bind) : options.bindParam,
    };

    if (model) {
      for (const [column, attribute] of model.modelDefinition.physicalAttributes.entries()) {
        attributeMap.set(attribute?.columnName ?? column, attribute);
      }
    } else if (attributeHash) {
      for (const [column, attribute] of Object.entries(attributeHash)) {
        attributeMap.set(attribute?.columnName ?? column, attribute);
      }
    }

    for (const [column, rowValue] of Object.entries(valueHash)) {
      if (attributeMap.get(column)?.autoIncrement && rowValue == null) {
        // Skip auto-increment columns with null values as they will be auto-generated
        continue;
      } else if (rowValue === undefined) {
        // Treat undefined values as non-existent
        continue;
      } else {
        valueMap.set(column, this.escape(rowValue, {
          ...insertOptions,
          type: attributeMap.get(column)?.type,
        }));
      }
    }

    const returningFragment = insertOptions.returning ? joinSQLFragments(['RETURNING', this.#internals.getReturnFields(insertOptions, attributeMap).join(', ')]) : '';

    if (valueMap.size === 0) {
      return {
        query: joinSQLFragments([
          'INSERT INTO',
          this.quoteTable(tableName),
          'DEFAULT VALUES',
          returningFragment,
        ]),
        bind: typeof insertOptions.bindParam === 'function' ? bind : undefined,
      };
    }

    const rowFragment = [...valueMap.values()].join(',');
    const columnFragment = [...valueMap.keys()].map(column => this.quoteIdentifier(column)).join(',');
    const conflictFragment = insertOptions.updateOnDuplicate ? this.#internals.generateUpdateOnDuplicateKeysFragment(insertOptions) : '';

    return {
      query: joinSQLFragments([
        'INSERT',
        insertOptions.ignoreDuplicates ? 'OR IGNORE' : '',
        'INTO',
        this.quoteTable(tableName),
        `(${columnFragment})`,
        'VALUES',
        `(${rowFragment})`,
        conflictFragment,
        returningFragment,
      ]),
      bind: typeof insertOptions.bindParam === 'function' ? bind : undefined,
    };
  }

  /**
   * Temporary function until we have moved the query generation of addConstraint here.
   *
   * @param tableName
   * @param options
   */
  _TEMPORARY_getConstraintSnippet(tableName: TableNameOrModel, options: GetConstraintSnippetQueryOptions): string {
    return this.#internals.getConstraintSnippet(tableName, options);
  }
}
