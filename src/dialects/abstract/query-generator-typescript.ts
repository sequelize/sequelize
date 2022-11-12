import NodeUtil from 'node:util';
import isObject from 'lodash/isObject';
import type { ModelStatic } from '../../model.js';
import type { Sequelize } from '../../sequelize.js';
import { isPlainObject, isString, quoteIdentifier } from '../../utils/index.js';
import { isModelStatic } from '../../utils/model-utils.js';
import type { TableName } from './query-interface.js';
import type { AbstractDialect } from './index.js';

export type TableNameOrModel = TableName | ModelStatic;

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

  extractTableDetails(tableNameOrModel: TableNameOrModel, options?: { schema?: string, delimiter?: string }) {
    const tableNameObject = isModelStatic(tableNameOrModel) ? tableNameOrModel.getTableName()
      : isString(tableNameOrModel) ? { tableName: tableNameOrModel }
      : tableNameOrModel;

    if (!isPlainObject(tableNameObject)) {
      throw new Error(`Invalid input received, got ${NodeUtil.inspect(tableNameOrModel)}, expected a Model Class, a TableNameWithSchema object, or a table name string`);
    }

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
      if (tableName.schema && tableName.schema !== this.dialect.getDefaultSchema()) {
        sql += `${this.quoteIdentifier(tableName.schema)}.`;
      }

      sql += this.quoteIdentifier(tableName.tableName);
    } else {
      if (tableName.schema && tableName.schema !== this.dialect.getDefaultSchema()) {
        sql += tableName.schema + (tableName.delimiter || '.');
      }

      sql += tableName.tableName;
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
}
