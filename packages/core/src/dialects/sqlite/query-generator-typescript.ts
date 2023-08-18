import { randomBytes } from 'node:crypto';
import { rejectInvalidOptions } from '../../utils/check';
import { joinSQLFragments } from '../../utils/join-sql-fragments';
import { generateIndexName } from '../../utils/string';
import { AbstractQueryGenerator } from '../abstract/query-generator';
import type { RemoveColumnQueryOptions } from '../abstract/query-generator';
import { REMOVE_INDEX_QUERY_SUPPORTABLE_OPTIONS } from '../abstract/query-generator-typescript';
import type { RemoveIndexQueryOptions, TableNameOrModel } from '../abstract/query-generator-typescript';
import type { ShowConstraintsQueryOptions } from '../abstract/query-generator.types';
import type { ColumnsDescription } from '../abstract/query-interface.types';

const REMOVE_INDEX_QUERY_SUPPORTED_OPTIONS = new Set<keyof RemoveIndexQueryOptions>(['ifExists']);

/**
 * Temporary class to ease the TypeScript migration
 */
export class SqliteQueryGeneratorTypeScript extends AbstractQueryGenerator {
  createSchemaQuery(): string {
    throw new Error(`Schemas are not supported in ${this.dialect.name}.`);
  }

  dropSchemaQuery(): string {
    throw new Error(`Schemas are not supported in ${this.dialect.name}.`);
  }

  listSchemasQuery(): string {
    throw new Error(`Schemas are not supported in ${this.dialect.name}.`);
  }

  describeTableQuery(tableName: TableNameOrModel) {
    return `PRAGMA TABLE_INFO(${this.quoteTable(tableName)})`;
  }

  describeCreateTableQuery(tableName: TableNameOrModel) {
    return `SELECT sql FROM sqlite_master WHERE tbl_name = ${this.escapeTable(tableName)};`;
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

  dropForeignKeyQuery(_tableName: TableNameOrModel, _foreignKey: string): string {
    throw new Error(`dropForeignKeyQuery is not supported in ${this.dialect.name}.`);
  }

  removeColumnQuery(_table: TableNameOrModel, _attributeName: string, _options?: RemoveColumnQueryOptions): string {
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

  getForeignKeyQuery(tableName: TableNameOrModel, columnName?: string) {
    if (columnName) {
      throw new Error(`Providing a columnName in getForeignKeyQuery is not supported by ${this.dialect.name}.`);
    }

    const escapedTable = this.escapeTable(tableName);

    return joinSQLFragments([
      'SELECT id as `constraintName`,',
      `${escapedTable} as \`tableName\`,`,
      'pragma.`from` AS `columnName`,',
      'pragma.`table` AS `referencedTableName`,',
      'pragma.`to` AS `referencedColumnName`,',
      'pragma.`on_update`,',
      'pragma.`on_delete`',
      `FROM pragma_foreign_key_list(${escapedTable}) AS pragma;`,
    ]);
  }

  _replaceTableQuery(tableName: TableNameOrModel, attributes: ColumnsDescription, createTableSql?: string) {
    const table = this.extractTableDetails(tableName);
    const backupTable = this.extractTableDetails(`${table.tableName}_${randomBytes(8).toString('hex')}`, table);
    const quotedTableName = this.quoteTable(table);
    const quotedBackupTableName = this.quoteTable(backupTable);

    const tableAttributes = this.attributesToSQL(attributes);
    const attributeNames = Object.keys(tableAttributes).map(attr => this.quoteIdentifier(attr)).join(', ');

    const backupTableSql = createTableSql
      ? `${createTableSql.replace(`CREATE TABLE ${quotedTableName}`, `CREATE TABLE ${quotedBackupTableName}`)};`
      : this.createTableQuery(backupTable, tableAttributes);

    return joinSQLFragments([
      backupTableSql,
      `INSERT INTO ${quotedBackupTableName} SELECT ${attributeNames} FROM ${quotedTableName};`,
      `DROP TABLE ${quotedTableName};`,
      `ALTER TABLE ${quotedBackupTableName} RENAME TO ${quotedTableName};`,
    ]);
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
}
