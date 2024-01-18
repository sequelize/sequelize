import { rejectInvalidOptions } from '../../utils/check';
import { generateIndexName } from '../../utils/string';
import { joinSQLFragments } from '../../utils/join-sql-fragments';
import { AbstractQueryGenerator } from '../abstract/query-generator';
import {
  REMOVE_INDEX_QUERY_SUPPORTABLE_OPTIONS,
  RENAME_TABLE_QUERY_SUPPORTABLE_OPTIONS,
  REMOVE_COLUMN_QUERY_SUPPORTABLE_OPTIONS
} from '../abstract/query-generator-typescript';
import type { RemoveIndexQueryOptions, TableNameOrModel } from '../abstract/query-generator-typescript';
import type { TableNameWithSchema } from '../abstract/query-interface';
import type { AddLimitOffsetOptions, RemoveConstraintQueryOptions, RenameTableQueryOptions } from '../abstract/query-generator.types';
import { RemoveColumnQueryOptions } from '../abstract/query-generator.types';

const REMOVE_INDEX_QUERY_SUPPORTED_OPTIONS = new Set<keyof RemoveIndexQueryOptions>();
const RENAME_TABLE_QUERY_SUPPORTED_OPTIONS = new Set<keyof RenameTableQueryOptions>();
const REMOVE_COLUMN_QUERY_SUPPORTED_OPTIONS = new Set<keyof RemoveColumnQueryOptions>();

export class OracleQueryGeneratorTypeScript extends AbstractQueryGenerator {
  describeTableQuery(tableName: TableNameOrModel) {
    const table = this.extractTableDetails(tableName);
    const currTableName = this.getCatalogName(table.tableName);
    const schema = this.getCatalogName(table.schema);

    // name, type, datalength (except number / nvarchar), datalength varchar, datalength number, nullable, default value, primary ?
    return [
      'SELECT atc.COLUMN_NAME, atc.DATA_TYPE, atc.DATA_LENGTH, atc.CHAR_LENGTH, atc.DEFAULT_LENGTH, atc.NULLABLE, ucc.constraint_type ',
      'FROM all_tab_columns atc ',
      'LEFT OUTER JOIN ',
      '(SELECT acc.column_name, acc.table_name, ac.constraint_type FROM all_cons_columns acc INNER JOIN all_constraints ac ON acc.constraint_name = ac.constraint_name) ucc ',
      'ON (atc.table_name = ucc.table_name AND atc.COLUMN_NAME = ucc.COLUMN_NAME) ',
      schema
        ? `WHERE (atc.OWNER = ${this.escape(schema)}) `
        : 'WHERE atc.OWNER = USER ',
      `AND (atc.TABLE_NAME = ${this.escape(currTableName)})`,
      'ORDER BY atc.COLUMN_NAME, CONSTRAINT_TYPE DESC',
    ].join('');
  }

  removeIndexQuery(
    tableName: TableNameOrModel,
    indexNameOrAttributes: string | string[],
    options: RemoveIndexQueryOptions,
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

    return `DROP INDEX ${this.quoteIdentifier(indexName)}`;
  }

  /**
   * Returns the value as it is stored in the Oracle DB
   *
   * @param value
   */
  getCatalogName(value: string | undefined) {
    if (value && this.options.quoteIdentifiers === false) {
      const quotedValue = this.quoteIdentifier(value);
      if (quotedValue === value) {
        value = value.toUpperCase();
      }
    }

    return value;
  }

  showIndexesQuery(table: TableNameWithSchema) {
    const [tableName, owner] = this.getSchemaNameAndTableName(table);
    const sql = [
      'SELECT i.index_name,i.table_name, i.column_name, u.uniqueness, i.descend, c.constraint_type ',
      'FROM all_ind_columns i ',
      'INNER JOIN all_indexes u ',
      'ON (u.table_name = i.table_name AND u.index_name = i.index_name) ',
      'LEFT OUTER JOIN all_constraints c ',
      'ON (c.table_name = i.table_name AND c.index_name = i.index_name) ',
      `WHERE i.table_name = ${this.escape(tableName)}`,
      ' AND u.table_owner = ',
      owner ? this.escape(owner) : 'USER',
      ' ORDER BY index_name, column_position',
    ];

    return sql.join('');
  }

  /**
   * Returns the tableName and schemaName as it is stored the Oracle DB
   *
   * @param table
   */
  getSchemaNameAndTableName(table: any) {
    table = this.extractTableDetails(table);
    const tableName = this.getCatalogName(table.tableName || table);
    const schemaName = this.getCatalogName(table.schema);

    return [tableName, schemaName];
  }

  removeConstraintQuery(tableName: TableNameOrModel, constraintName: string, options?: RemoveConstraintQueryOptions) {
    if (constraintName.startsWith('sys')) {
      return joinSQLFragments([
        'ALTER TABLE',
        this.quoteTable(tableName),
        'DROP CONSTRAINT',
        options?.ifExists ? 'IF EXISTS' : '',
        constraintName,
        options?.cascade ? 'CASCADE' : '',
      ]);
    } else {
      return super.removeConstraintQuery(tableName, constraintName, options);
    }
  }

  _addLimitAndOffset(options : AddLimitOffsetOptions) {
    let fragment = '';
    const offset = options.offset || 0;

    if (options.offset || options.limit) {
      fragment += ` OFFSET ${this.escape(offset, options)} ROWS`;
    }

    if (options.limit) {
      fragment += ` FETCH NEXT ${this.escape(options.limit, options)} ROWS ONLY`;
    }

    return fragment;
  }

  renameTableQuery(
    beforeTableName: TableNameOrModel,
    afterTableName: TableNameOrModel,
    options?: RenameTableQueryOptions,
  ): string {
    if (options) {
      rejectInvalidOptions(
        'renameTableQuery',
        this.dialect.name,
        RENAME_TABLE_QUERY_SUPPORTABLE_OPTIONS,
        RENAME_TABLE_QUERY_SUPPORTED_OPTIONS,
        options,
      );
    }
    const beforeTable = this.extractTableDetails(beforeTableName);
    const afterTable = this.extractTableDetails(afterTableName);
    let renamedTable  = afterTable.tableName;

    if (beforeTable.schema !== afterTable.schema) {
      throw new Error(`Moving tables between schemas is not supported by ${this.dialect.name} dialect.`);
    }
    
    return `ALTER TABLE ${this.quoteTable(beforeTableName)} RENAME TO ${this.quoteTable(renamedTable)}`;
  }

  getAliasToken(): string {
    return '';
  }

  removeColumnQuery(tableName: TableNameOrModel, attributeName: string, options: RemoveColumnQueryOptions): string {
    rejectInvalidOptions(
      'removeColumnQuery',
      this.dialect.name,
      REMOVE_COLUMN_QUERY_SUPPORTABLE_OPTIONS,
      REMOVE_COLUMN_QUERY_SUPPORTED_OPTIONS,
      options,
    );
    return joinSQLFragments([
      'ALTER TABLE',
      this.quoteTable(tableName),
      'DROP COLUMN',
      this.quoteIdentifier(attributeName)
    ]);
  }
}
