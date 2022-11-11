import NodeUtil from 'node:util';
import isObject from 'lodash/isObject';
import type { ModelStatic, ColumnOptions } from '../../model.js';
import type { Sequelize } from '../../sequelize.js';
import type { MakeNullish, Nullish } from '../../utils/index.js';
import { getColumnName, isPlainObject, isString } from '../../utils/index.js';
import { isModelStatic } from '../../utils/model-utils.js';
import { isDataType } from './data-types-utils.js';
import type { DataType, DataTypeInstance } from './data-types.js';
import type { TableName, TableNameWithSchema } from './query-interface.js';
import type { AbstractDialect } from './index.js';

export type ChangeColumnDefinitions = {
  [attributeName: string]: DataType | ChangeColumnDefinition,
};

export type ChangeColumnDefinition = Partial<Omit<ColumnOptions, 'primaryKey' | 'unique'>> & {
  /**
   * Only 'true' is allowed, because changeColumns can add a single-column unique, but does not have access to enough information
   * to add a multi-column unique, or removing a column from a unique index.
   */
  unique?: MakeNullish<true>,

  /**
   * Set to true to remove the defaultValue.
   *
   * Cannot be used in conjunction with defaultValue.
   */
  dropDefaultValue?: boolean,
};

export type NormalizedChangeColumnDefinition = Omit<ChangeColumnDefinition, 'type'> & {
  type?: DataTypeInstance | string | Nullish,
};

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

  get options() {
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

  changeColumnsQuery(tableOrModel: TableNameOrModel, columnDefinitions: ChangeColumnDefinitions): string {
    if (Object.keys(columnDefinitions).length === 0) {
      throw new Error('changeColumnsQuery requires at least one column to be provided.');
    }

    const tableName = this.extractTableDetails(tableOrModel);

    const columnsSql: string[] = [];

    const isModel = isModelStatic(tableOrModel);

    for (const [columnOrAttributeName, rawColumnDefinition] of Object.entries(columnDefinitions)) {
      let columnName: string | null;
      if (isModel) {
        columnName = getColumnName(tableOrModel, columnOrAttributeName);
        if (columnName == null) {
          throw new Error(`changeColumnsQuery: Attribute ${columnOrAttributeName} does not exist on model ${tableOrModel.name}.

Be aware that when giving a Model instead of a TableName to changeColumnsQuery, it expects you to use attribute names (the JS name) instead of column names (the SQL name).
If you want to change a column that is not defined on the model, pass a TableName instead of the Model. You can get a TableName by calling getTableName() on your Model class.`);
        }
      } else {
        columnName = columnOrAttributeName;
      }

      const columnDefinition = this.#normalizeChangeColumnAttribute(rawColumnDefinition);

      if ('primaryKey' in columnDefinition) {
        throw new Error('changeColumnsQuery does not support adding or removing a column from the primary key because it would need to drop and recreate the constraint but it does not know whether other columns are already part of the primary key. Use dropConstraint and addConstraint instead.');
      }

      if ('unique' in columnDefinition && columnDefinition.unique !== true) {
        throw new Error('changeColumnsQuery does not support adding or removing a column from a unique index because it would need to drop and recreate the index but it does not know whether other columns are already part of the index. Use dropIndex and addIndex instead.');
      }

      if (('onUpdate' in columnDefinition || 'onDelete' in columnDefinition) && !('references' in columnDefinition)) {
        throw new Error('changeColumnsQuery does not support changing onUpdate or onDelete on their own. Use dropConstraint and addConstraint instead.');
      }

      if (columnDefinition.dropDefaultValue && columnDefinition.defaultValue !== undefined) {
        throw new Error('Cannot use both dropDefaultValue and defaultValue on the same column.');
      }

      const columnSql = this._attributeToChangeColumn(tableName, columnName, columnDefinition);

      if (columnSql) {
        columnsSql.push(columnSql);
      }
    }

    // it is possible for this query to be empty but still valid if the dialect overrides this method.
    // for instance, postgres set comments without using ALTER TABLE,
    // so if the only change is a comment change, this will be empty,
    // but the postgres dialect will add the necessary SET COMMENT statement.
    if (columnsSql.length === 0) {
      return '';
    }

    return `ALTER TABLE ${this.quoteTable(tableName)} ${columnsSql.join(', ')};`;
  }

  #normalizeChangeColumnAttribute(attribute: DataType | ChangeColumnDefinition): NormalizedChangeColumnDefinition {
    if (isDataType(attribute)) {
      return { type: this.sequelize.normalizeDataType(attribute) };
    }

    if (attribute.type == null) {
      return {
        ...attribute,
        type: undefined,
      };
    }

    return {
      ...attribute,
      type: this.sequelize.normalizeDataType(attribute.type),
    };
  }

  protected _attributeToChangeColumn(
    _tableName: TableNameWithSchema,
    _columnName: string,
    _columnDefinition: NormalizedChangeColumnDefinition,
  ): string {
    throw new Error(`_attributeToChangeColumn has not been implemented by dialect ${this.dialect.name}`);
  }

  /**
   * Quote table name with optional alias and schema attribution
   *
   * @param param table string or object
   * @param alias alias name
   */
  quoteTable(param: TableName, alias: boolean | string = false): string {
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
   * @param _identifier
   * @param _force
   */
  quoteIdentifier(_identifier: string, _force?: boolean): string {
    throw new Error(`quoteIdentifier for Dialect "${this.dialect.name}" is not implemented`);
  }
}
