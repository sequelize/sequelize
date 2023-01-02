import NodeUtil from 'node:util';
import isObject from 'lodash/isObject';
import type { ModelStatic } from '../../model.js';
import type { Sequelize } from '../../sequelize.js';
import { isPlainObject, isString } from '../../utils/check.js';
import { quoteIdentifier } from '../../utils/dialect.js';
import { isModelStatic } from '../../utils/model-utils.js';
import type { TableName, TableNameWithSchema } from './query-interface.js';
import type { AbstractDialect } from './index.js';

export type TableNameOrModel = TableName | ModelStatic;

// keep REMOVE_INDEX_QUERY_SUPPORTABLE_OPTIONS updated when modifying this
export interface RemoveIndexQueryOptions {
  concurrently?: boolean;
  ifExists?: boolean;
  cascade?: boolean;
}

export const REMOVE_INDEX_QUERY_SUPPORTABLE_OPTIONS = new Set<keyof RemoveIndexQueryOptions>(['concurrently', 'ifExists', 'cascade']);

export interface QueryGeneratorOptions {
  sequelize: Sequelize;
  dialect: AbstractDialect;
}

/**
 * Temporary class to ease the TypeScript migration
 */
export class AbstractQueryGeneratorTypeScript {

  protected readonly dialect: AbstractDialect;
  protected readonly sequelize: Sequelize;

  constructor(options: QueryGeneratorOptions) {
    if (!options.sequelize) {
      throw new Error('QueryGenerator initialized without options.sequelize');
    }

    if (!options.dialect) {
      throw new Error('QueryGenerator initialized without options.dialect');
    }

    this.sequelize = options.sequelize;
    this.dialect = options.dialect;
  }

  protected get options() {
    return this.sequelize.options;
  }

  describeTableQuery(tableName: TableNameOrModel) {
    return `DESCRIBE ${this.quoteTable(tableName)};`;
  }

  showIndexesQuery(_tableName: TableNameOrModel): string {
    throw new Error(`showIndexesQuery has not been implemented in ${this.dialect.name}.`);
  }

  removeIndexQuery(
    _tableName: TableNameOrModel,
    _indexNameOrAttributes: string | string [],
    _options?: RemoveIndexQueryOptions,
  ): string {
    throw new Error(`removeIndexQuery has not been implemented in ${this.dialect.name}.`);
  }

  // TODO: rename to "normalizeTable" & move to sequelize class
  extractTableDetails(
    tableNameOrModel: TableNameOrModel,
    options?: { schema?: string, delimiter?: string },
  ): TableNameWithSchema {
    const tableNameObject = isModelStatic(tableNameOrModel) ? tableNameOrModel.getTableName()
      : isString(tableNameOrModel) ? { tableName: tableNameOrModel }
      : tableNameOrModel;

    if (!isPlainObject(tableNameObject)) {
      throw new Error(`Invalid input received, got ${NodeUtil.inspect(tableNameOrModel)}, expected a Model Class, a TableNameWithSchema object, or a table name string`);
    }

    // @ts-expect-error -- TODO: this is added by getTableName on model, and must be removed
    delete tableNameObject.toString;

    return {
      ...tableNameObject,
      schema: options?.schema || tableNameObject.schema || this.options.schema || this.dialect.getDefaultSchema(),
      delimiter: options?.delimiter || tableNameObject.delimiter || '.',
    };
  }

  /**
   * Quote table name with optional alias and schema attribution
   *
   * @param param table string or object
   * @param alias alias name
   */
  quoteTable(param: TableNameOrModel, alias: boolean | string = false): string {
    if (isModelStatic(param)) {
      param = param.getTableName();
    }

    const tableName = this.extractTableDetails(param);

    if (isObject(param) && ('as' in param || 'name' in param)) {
      throw new Error('parameters "as" and "name" are not allowed in the first parameter of quoteTable, pass them as the second parameter.');
    }

    if (alias === true) {
      alias = tableName.tableName;
    }

    let sql = '';

    if (this.dialect.supports.schemas) {
      // Some users sync the same set of tables in different schemas for various reasons
      // They then set `searchPath` when running a query to use different schemas.
      // See https://github.com/sequelize/sequelize/pull/15274#discussion_r1020770364
      // For this reason, we treat the default schema as equivalent to "no schema specified"
      if (tableName.schema && tableName.schema !== this.dialect.getDefaultSchema()) {
        sql += `${this.quoteIdentifier(tableName.schema)}.`;
      }

      sql += this.quoteIdentifier(tableName.tableName);
    } else {
      const fakeSchemaPrefix = (tableName.schema && tableName.schema !== this.dialect.getDefaultSchema())
        ? tableName.schema + (tableName.delimiter || '.')
        : '';

      sql += this.quoteIdentifier(fakeSchemaPrefix + tableName.tableName);
    }

    if (alias) {
      sql += ` AS ${this.quoteIdentifier(alias)}`;
    }

    return sql;
  }

  /**
   * Adds quotes to identifier
   *
   * @param identifier
   * @param _force
   */
  quoteIdentifier(identifier: string, _force?: boolean) {
    return quoteIdentifier(identifier, this.dialect.TICK_CHAR_LEFT, this.dialect.TICK_CHAR_RIGHT);
  }

  isSameTable(tableA: TableNameOrModel, tableB: TableNameOrModel) {
    if (tableA === tableB) {
      return true;
    }

    tableA = this.extractTableDetails(tableA);
    tableB = this.extractTableDetails(tableB);

    return tableA.tableName === tableB.tableName && tableA.schema === tableB.schema;
  }
}
