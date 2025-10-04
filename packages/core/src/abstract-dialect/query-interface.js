'use strict';

import { map } from '@sequelize/utils';
import defaults from 'lodash/defaults';
import find from 'lodash/find';
import intersection from 'lodash/intersection';
import isObject from 'lodash/isObject';
import mapValues from 'lodash/mapValues';
import uniq from 'lodash/uniq';
import * as DataTypes from '../data-types';
import { QueryTypes } from '../enums';
import { cloneDeep, getObjectFromMap } from '../utils/object';
import { assertNoReservedBind, combineBinds } from '../utils/sql';
import { AbstractDataType } from './data-types';
import { AbstractQueryInterfaceTypeScript } from './query-interface-typescript';

/**
 * The interface that Sequelize uses to talk to all databases
 */
export class AbstractQueryInterface extends AbstractQueryInterfaceTypeScript {
  /**
   * Create a table with given set of attributes
   *
   * ```js
   * queryInterface.createTable(
   *   'nameOfTheNewTable',
   *   {
   *     id: {
   *       type: DataTypes.INTEGER,
   *       primaryKey: true,
   *       autoIncrement: true
   *     },
   *     createdAt: {
   *       type: DataTypes.DATE
   *     },
   *     updatedAt: {
   *       type: DataTypes.DATE
   *     },
   *     attr1: DataTypes.STRING,
   *     attr2: DataTypes.INTEGER,
   *     attr3: {
   *       type: DataTypes.BOOLEAN,
   *       defaultValue: false,
   *       allowNull: false
   *     },
   *     //foreign key usage
   *     attr4: {
   *       type: DataTypes.INTEGER,
   *       references: {
   *         model: 'another_table_name',
   *         key: 'id'
   *       },
   *       onUpdate: 'cascade',
   *       onDelete: 'cascade'
   *     }
   *   },
   *   {
   *     engine: 'MYISAM',    // default: 'InnoDB'
   *     charset: 'latin1',   // default: null
   *     schema: 'public',    // default: public, PostgreSQL only.
   *     comment: 'my table', // comment for table
   *     collate: 'latin1_danish_ci' // collation, MYSQL only
   *   }
   * )
   * ```
   *
   * @param {string} tableName  Name of table to create
   * @param {object} attributes Object representing a list of table attributes to create
   * @param {object} [options] create table and query options
   * @param {Model}  [model] model class
   *
   * @returns {Promise}
   */
  // TODO: remove "schema" option from the option bag, it must be passed as part of "tableName" instead
  async createTable(tableName, attributes, options, model) {
    options = { ...options };

    // TODO: the sqlite implementation of createTableQuery should be improved so it also generates a CREATE UNIQUE INDEX query
    if (model && this.sequelize.dialect.name !== 'sqlite3') {
      options.uniqueKeys = options.uniqueKeys || model.uniqueKeys;
    }

    attributes = mapValues(attributes, attribute => this.sequelize.normalizeAttribute(attribute));

    // Postgres requires special SQL commands for ENUM/ENUM[]
    await this.ensureEnums(tableName, attributes, options, model);

    // Snowflake requires special SQL commands for SEQUENCES
    await this.ensureSequences(tableName, attributes, options);

    const modelTable = model?.table;

    if (!tableName.schema && (options.schema || modelTable?.schema)) {
      tableName = this.queryGenerator.extractTableDetails(tableName);
      tableName.schema = modelTable?.schema || options.schema;
    }

    attributes = this.queryGenerator.attributesToSQL(attributes, {
      table: tableName,
      context: 'createTable',
      withoutForeignKeyConstraints: options.withoutForeignKeyConstraints,
      // schema override for multi-tenancy
      schema: options.schema,
    });

    const sql = this.queryGenerator.createTableQuery(tableName, attributes, options);

    return await this.sequelize.queryRaw(sql, options);
  }

  /**
   * Add a new column to a table
   *
   * ```js
   * queryInterface.addColumn('tableA', 'columnC', DataTypes.STRING, {
   *    after: 'columnB' // after option is only supported by MySQL
   * });
   * ```
   *
   * @param {string} table     Table to add column to
   * @param {string} key       Column name
   * @param {object} attribute Attribute definition
   * @param {object} [options] Query options
   *
   * @returns {Promise}
   */
  async addColumn(table, key, attribute, options = {}) {
    if (!table || !key || !attribute) {
      throw new Error(
        'addColumn takes at least 3 arguments (table, attribute name, attribute definition)',
      );
    }

    attribute = this.sequelize.normalizeAttribute(attribute);

    if (
      attribute.type instanceof AbstractDataType &&
      // we don't give a context if it already has one, because it could come from a Model.
      !attribute.type.usageContext
    ) {
      attribute.type.attachUsageContext({
        tableName: table,
        columnName: key,
        sequelize: this.sequelize,
      });
    }

    const { ifNotExists, ...rawQueryOptions } = options;
    const addColumnQueryOptions = ifNotExists ? { ifNotExists } : undefined;

    return await this.sequelize.queryRaw(
      this.queryGenerator.addColumnQuery(table, key, attribute, addColumnQueryOptions),
      rawQueryOptions,
    );
  }

  /**
   * Remove a column from a table
   *
   * @param {string} tableName      Table to remove column from
   * @param {string} attributeName  Column name to remove
   * @param {object} [options]      Query options
   */

  normalizeAttribute(dataTypeOrOptions) {
    let attribute;
    if (Object.values(DataTypes).includes(dataTypeOrOptions)) {
      attribute = { type: dataTypeOrOptions, allowNull: true };
    } else {
      attribute = dataTypeOrOptions;
    }

    return this.sequelize.normalizeAttribute(attribute);
  }

  /**
   * Split a list of identifiers by "." and quote each part
   *
   * @param {string} identifier
   * @param {boolean} force
   *
   * @returns {string}
   */
  quoteIdentifier(identifier, force) {
    return this.queryGenerator.quoteIdentifier(identifier, force);
  }

  /**
   * Split a list of identifiers by "." and quote each part.
   *
   * @param {string} identifiers
   *
   * @returns {string}
   */
  quoteIdentifiers(identifiers) {
    return this.queryGenerator.quoteIdentifiers(identifiers);
  }

  /**
   * Change a column definition
   *
   * @param {string} tableName          Table name to change from
   * @param {string} attributeName      Column name
   * @param {object} dataTypeOrOptions  Attribute definition for new column
   * @param {object} [options]          Query options
   */
  async changeColumn(tableName, attributeName, dataTypeOrOptions, options) {
    options ||= {};

    const query = this.queryGenerator.attributesToSQL(
      {
        [attributeName]: this.normalizeAttribute(dataTypeOrOptions),
      },
      {
        context: 'changeColumn',
        table: tableName,
      },
    );
    const sql = this.queryGenerator.changeColumnQuery(tableName, query);

    return this.sequelize.queryRaw(sql, options);
  }

  /**
   * Rejects if the table doesn't have the specified column, otherwise returns the column description.
   *
   * @param {string} tableName
   * @param {string} columnName
   * @param {object} options
   * @private
   */
  // TODO: rename to "describeColumn"
  async assertTableHasColumn(tableName, columnName, options) {
    const description = await this.describeTable(tableName, options);
    if (description[columnName]) {
      return description;
    }

    throw new Error(`Table ${tableName} doesn't have the column ${columnName}`);
  }

  /**
   * Rename a column
   *
   * @param {string} tableName        Table name whose column to rename
   * @param {string} attrNameBefore   Current column name
   * @param {string} attrNameAfter    New column name
   * @param {object} [options]        Query option
   *
   * @returns {Promise}
   */
  async renameColumn(tableName, attrNameBefore, attrNameAfter, options) {
    options ||= {};
    const data = (await this.assertTableHasColumn(tableName, attrNameBefore, options))[
      attrNameBefore
    ];

    const _options = {};

    _options[attrNameAfter] = {
      attribute: attrNameAfter,
      type: data.type,
      allowNull: data.allowNull,
      defaultValue: data.defaultValue,
    };

    // fix: a not-null column cannot have null as default value
    if (data.defaultValue === null && !data.allowNull) {
      delete _options[attrNameAfter].defaultValue;
    }

    const sql = this.queryGenerator.renameColumnQuery(
      tableName,
      attrNameBefore,
      this.queryGenerator.attributesToSQL(_options),
    );

    return await this.sequelize.queryRaw(sql, options);
  }

  /**
   * Add an index to a column
   *
   * @param {string|object}  tableName Table name to add index on, can be a object with schema
   * @param {Array}   [attributes]     Use options.fields instead, List of attributes to add index on
   * @param {object}  options          indexes options
   * @param {Array}   options.fields   List of attributes to add index on
   * @param {boolean} [options.concurrently] Pass CONCURRENT so other operations run while the index is created
   * @param {boolean} [options.unique] Create a unique index
   * @param {string}  [options.using]  Useful for GIN indexes
   * @param {string}  [options.operator] Index operator
   * @param {string}  [options.type]   Type of index, available options are UNIQUE|FULLTEXT|SPATIAL
   * @param {string}  [options.name]   Name of the index. Default is <table>_<attr1>_<attr2>
   * @param {object}  [options.where]  Where condition on index, for partial indexes
   * @param {string}  [rawTablename]   table name, this is just for backward compatibiity
   *
   * @returns {Promise}
   */
  async addIndex(tableName, attributes, options, rawTablename) {
    // Support for passing tableName, attributes, options or tableName, options (with a fields param which is the attributes)
    if (!Array.isArray(attributes)) {
      rawTablename = options;
      options = attributes;
      attributes = options.fields;
    }

    if (!rawTablename) {
      // Map for backwards compat
      rawTablename = tableName;
    }

    options = cloneDeep(options) ?? {};
    options.fields = attributes;
    const sql = this.queryGenerator.addIndexQuery(tableName, options, rawTablename);

    return await this.sequelize.queryRaw(sql, { ...options, supportsSearchPath: false });
  }

  /**
   * Show indexes on a table
   *
   * @param {TableOrModel} tableName
   * @param {object}    [options] Query options
   *
   * @returns {Promise<Array>}
   * @private
   */
  async showIndex(tableName, options) {
    const sql = this.queryGenerator.showIndexesQuery(tableName, options);

    return await this.sequelize.queryRaw(sql, { ...options, type: QueryTypes.SHOWINDEXES });
  }

  /**
   * Remove an already existing index from a table
   *
   * @param {string} tableName                    Table name to drop index from
   * @param {string|string[]} indexNameOrAttributes  Index name or list of attributes that in the index
   * @param {object} [options]                    Query options
   * @param {boolean} [options.concurrently]      Pass CONCURRENTLY so other operations run while the index is created
   *
   * @returns {Promise}
   */
  async removeIndex(tableName, indexNameOrAttributes, options) {
    options ||= {};
    const sql = this.queryGenerator.removeIndexQuery(tableName, indexNameOrAttributes, options);

    return await this.sequelize.queryRaw(sql, options);
  }

  async insert(instance, tableName, values, options) {
    if (options?.bind) {
      assertNoReservedBind(options.bind);
    }

    options = cloneDeep(options) ?? {};
    const modelDefinition = instance?.modelDefinition;

    options.hasTrigger = modelDefinition?.options.hasTrigger;
    const { bind, query } = this.queryGenerator.insertQuery(
      tableName,
      values,
      modelDefinition && getObjectFromMap(modelDefinition.attributes),
      options,
    );

    options.type = QueryTypes.INSERT;
    options.instance = instance;

    // unlike bind, replacements are handled by QueryGenerator, not QueryRaw
    delete options.replacements;
    options.bind = combineBinds(options.bind, bind);

    const results = await this.sequelize.queryRaw(query, options);
    if (instance) {
      results[0].isNewRecord = false;
    }

    return results;
  }

  /**
   * Upsert
   *
   * @param {string} tableName    table to upsert on
   * @param {object} insertValues values to be inserted, mapped to field name
   * @param {object} updateValues values to be updated, mapped to field name
   * @param {object} where        where conditions, which can be used for UPDATE part when INSERT fails
   * @param {object} options      query options
   *
   * @returns {Promise<boolean,?number>} Resolves an array with <created, primaryKey>
   */
  // Note: "where" is only used by DB2 and MSSQL. This is because these dialects do not propose any "ON CONFLICT UPDATE" mechanisms
  // The UPSERT pattern in SQL server requires providing a WHERE clause
  // TODO: the user should be able to configure the WHERE clause for upsert instead of the current default which
  //  is using the primary keys.
  async upsert(tableName, insertValues, updateValues, where, options) {
    if (!this.dialect.supports.upserts) {
      throw new Error(`Upserts are not supported by the ${this.dialect.name} dialect.`);
    }

    if (options?.bind) {
      assertNoReservedBind(options.bind);
    }

    options = { ...options };

    const model = options.model;
    const modelDefinition = model.modelDefinition;

    options.type = QueryTypes.UPSERT;
    options.updateOnDuplicate = Object.keys(updateValues);
    options.upsertKeys = options.conflictFields || [];

    if (options.upsertKeys.length === 0) {
      const primaryKeys = Array.from(
        map(
          modelDefinition.primaryKeysAttributeNames,
          pkAttrName => modelDefinition.attributes.get(pkAttrName).columnName,
        ),
      );

      const uniqueColumnNames = Object.values(model.getIndexes())
        .filter(c => c.unique && c.fields.length > 0)
        .map(c => c.fields);
      // For fields in updateValues, try to find a constraint or unique index
      // that includes given field. Only first matching upsert key is used.
      for (const field of options.updateOnDuplicate) {
        const indexKey = uniqueColumnNames.find(fields => fields.includes(field));
        if (indexKey) {
          options.upsertKeys = indexKey;
          break;
        }
      }

      // Always use PK, if no constraint available OR update data contains PK
      if (
        options.upsertKeys.length === 0 ||
        intersection(options.updateOnDuplicate, primaryKeys).length > 0
      ) {
        options.upsertKeys = primaryKeys;
      }

      options.upsertKeys = uniq(options.upsertKeys);
    }

    const { bind, query } = this.queryGenerator.insertQuery(
      tableName,
      insertValues,
      getObjectFromMap(modelDefinition.attributes),
      options,
    );

    // unlike bind, replacements are handled by QueryGenerator, not QueryRaw
    delete options.replacement;
    options.bind = combineBinds(options.bind, bind);

    return await this.sequelize.queryRaw(query, options);
  }

  /**
   * Insert multiple records into a table
   *
   * @example
   * queryInterface.bulkInsert('roles', [{
   *    label: 'user',
   *    createdAt: new Date(),
   *    updatedAt: new Date()
   *  }, {
   *    label: 'admin',
   *    createdAt: new Date(),
   *    updatedAt: new Date()
   *  }]);
   *
   * @param {string} tableName   Table name to insert record to
   * @param {Array}  records     List of records to insert
   * @param {object} options     Various options, please see Model.bulkCreate options
   * @param {object} attributes  Various attributes mapped by field name
   *
   * @returns {Promise}
   */
  async bulkInsert(tableName, records, options, attributes) {
    options = { ...options, type: QueryTypes.INSERT };

    const sql = this.queryGenerator.bulkInsertQuery(tableName, records, options, attributes);

    // unlike bind, replacements are handled by QueryGenerator, not QueryRaw
    delete options.replacements;

    const results = await this.sequelize.queryRaw(sql, options);

    return results[0];
  }

  async update(instance, tableName, values, where, options) {
    if (options?.bind) {
      assertNoReservedBind(options.bind);
    }

    const modelDefinition = instance?.modelDefinition;

    options = { ...options, model: instance?.constructor };
    options.hasTrigger = modelDefinition?.options.hasTrigger;

    const { bind, query } = this.queryGenerator.updateQuery(
      tableName,
      values,
      where,
      options,
      modelDefinition && getObjectFromMap(modelDefinition.attributes),
    );

    options.type = QueryTypes.UPDATE;
    options.instance = instance;

    delete options.replacements;

    options.bind = combineBinds(options.bind, bind);

    return await this.sequelize.queryRaw(query, options);
  }

  /**
   * Update multiple records of a table
   *
   * @example
   * queryInterface.bulkUpdate('roles', {
   *     label: 'admin',
   *   }, {
   *     userType: 3,
   *   },
   * );
   *
   * @param {string} tableName     Table name to update
   * @param {object} values        Values to be inserted, mapped to field name
   * @param {object} where    A hash with conditions OR an ID as integer OR a string with conditions
   * @param {object} [options]     Various options, please see Model.bulkCreate options
   * @param {object} [columnDefinitions]  Attributes on return objects if supported by SQL dialect
   *
   * @returns {Promise}
   */
  async bulkUpdate(tableName, values, where, options, columnDefinitions) {
    if (options?.bind) {
      assertNoReservedBind(options.bind);
    }

    options = cloneDeep(options) ?? {};
    if (typeof where === 'object') {
      where = cloneDeep(where) ?? {};
    }

    const { bind, query } = this.queryGenerator.updateQuery(
      tableName,
      values,
      where,
      options,
      columnDefinitions,
    );
    const table = isObject(tableName) ? tableName : { tableName };
    const model = options.model
      ? options.model
      : find(this.sequelize.models, { tableName: table.tableName });

    options.type = QueryTypes.BULKUPDATE;
    options.model = model;
    options.bind = combineBinds(options.bind, bind);

    return await this.sequelize.queryRaw(query, options);
  }

  async select(model, tableName, optionsArg) {
    const minifyAliases = optionsArg.minifyAliases ?? this.sequelize.options.minifyAliases;
    const options = { ...optionsArg, type: QueryTypes.SELECT, model, minifyAliases };

    const sql = this.queryGenerator.selectQuery(tableName, options, model);

    // unlike bind, replacements are handled by QueryGenerator, not QueryRaw
    delete options.replacements;

    return await this.sequelize.queryRaw(sql, options);
  }

  async increment(
    model,
    tableName,
    where,
    incrementAmountsByField,
    extraAttributesToBeUpdated,
    options,
  ) {
    return this.#arithmeticQuery(
      '+',
      model,
      tableName,
      where,
      incrementAmountsByField,
      extraAttributesToBeUpdated,
      options,
    );
  }

  async decrement(
    model,
    tableName,
    where,
    incrementAmountsByField,
    extraAttributesToBeUpdated,
    options,
  ) {
    return this.#arithmeticQuery(
      '-',
      model,
      tableName,
      where,
      incrementAmountsByField,
      extraAttributesToBeUpdated,
      options,
    );
  }

  async #arithmeticQuery(
    operator,
    model,
    tableName,
    where,
    incrementAmountsByAttribute,
    extraAttributesToBeUpdated,
    options,
  ) {
    options = cloneDeep(options) ?? {};
    options.model = model;

    const sql = this.queryGenerator.arithmeticQuery(
      operator,
      tableName,
      where,
      incrementAmountsByAttribute,
      extraAttributesToBeUpdated,
      options,
    );

    options.type = QueryTypes.UPDATE;

    // unlike bind, replacements are handled by QueryGenerator, not QueryRaw
    delete options.replacements;

    return await this.sequelize.queryRaw(sql, options);
  }

  async rawSelect(tableName, options, attributeSelector, Model) {
    options = cloneDeep(options) ?? {};
    options = defaults(options, {
      raw: true,
      plain: true,
      type: QueryTypes.SELECT,
    });

    const sql = this.queryGenerator.selectQuery(tableName, options, Model);

    if (attributeSelector === undefined) {
      throw new Error('Please pass an attribute selector!');
    }

    // unlike bind, replacements are handled by QueryGenerator, not QueryRaw
    delete options.replacements;

    const data = await this.sequelize.queryRaw(sql, options);
    if (!options.plain) {
      return data;
    }

    const result = data ? data[attributeSelector] : null;

    if (!options || !options.dataType) {
      return result;
    }

    const dataType = options.dataType;

    // TODO: DECIMAL is not safely representable as a float!
    //  Use the DataType's parse method instead.
    if (
      (dataType instanceof DataTypes.DECIMAL || dataType instanceof DataTypes.FLOAT) &&
      result !== null
    ) {
      return Number.parseFloat(result);
    }

    // TODO: BIGINT is not safely representable as an int!
    //  Use the DataType's parse method instead.
    if (
      (dataType instanceof DataTypes.INTEGER || dataType instanceof DataTypes.BIGINT) &&
      result !== null
    ) {
      return Number.parseInt(result, 10);
    }

    if (dataType instanceof DataTypes.DATE && result !== null && !(result instanceof Date)) {
      return new Date(result);
    }

    return result;
  }

  async createTrigger(
    tableName,
    triggerName,
    timingType,
    fireOnArray,
    functionName,
    functionParams,
    optionsArray,
    options,
  ) {
    const sql = this.queryGenerator.createTrigger(
      tableName,
      triggerName,
      timingType,
      fireOnArray,
      functionName,
      functionParams,
      optionsArray,
    );
    options ||= {};
    if (sql) {
      return await this.sequelize.queryRaw(sql, options);
    }
  }

  async dropTrigger(tableName, triggerName, options) {
    const sql = this.queryGenerator.dropTrigger(tableName, triggerName);
    options ||= {};

    if (sql) {
      return await this.sequelize.queryRaw(sql, options);
    }
  }

  async renameTrigger(tableName, oldTriggerName, newTriggerName, options) {
    const sql = this.queryGenerator.renameTrigger(tableName, oldTriggerName, newTriggerName);
    options ||= {};

    if (sql) {
      return await this.sequelize.queryRaw(sql, options);
    }
  }

  /**
   * Create an SQL function
   *
   * @example
   * queryInterface.createFunction(
   *   'someFunction',
   *   [
   *     {type: 'integer', name: 'param', direction: 'IN'}
   *   ],
   *   'integer',
   *   'plpgsql',
   *   'RETURN param + 1;',
   *   [
   *     'IMMUTABLE',
   *     'LEAKPROOF'
   *   ],
   *   {
   *    variables:
   *      [
   *        {type: 'integer', name: 'myVar', default: 100}
   *      ],
   *      force: true
   *   };
   * );
   *
   * @param {string}  functionName  Name of SQL function to create
   * @param {Array}   params        List of parameters declared for SQL function
   * @param {string}  returnType    SQL type of function returned value
   * @param {string}  language      The name of the language that the function is implemented in
   * @param {string}  body          Source code of function
   * @param {Array}   optionsArray  Extra-options for creation
   * @param {object}  [options]     query options
   * @param {boolean} options.force If force is true, any existing functions with the same parameters will be replaced. For postgres, this means using `CREATE OR REPLACE FUNCTION` instead of `CREATE FUNCTION`. Default is false
   * @param {Array<object>}   options.variables List of declared variables. Each variable should be an object with string fields `type` and `name`, and optionally having a `default` field as well.
   *
   * @returns {Promise}
   */
  async createFunction(functionName, params, returnType, language, body, optionsArray, options) {
    const sql = this.queryGenerator.createFunction(
      functionName,
      params,
      returnType,
      language,
      body,
      optionsArray,
      options,
    );
    options ||= {};

    if (sql) {
      return await this.sequelize.queryRaw(sql, options);
    }
  }

  /**
   * Drop an SQL function
   *
   * @example
   * queryInterface.dropFunction(
   *   'someFunction',
   *   [
   *     {type: 'varchar', name: 'param1', direction: 'IN'},
   *     {type: 'integer', name: 'param2', direction: 'INOUT'}
   *   ]
   * );
   *
   * @param {string} functionName Name of SQL function to drop
   * @param {Array}  params       List of parameters declared for SQL function
   * @param {object} [options]    query options
   *
   * @returns {Promise}
   */
  async dropFunction(functionName, params, options) {
    const sql = this.queryGenerator.dropFunction(functionName, params);
    options ||= {};

    if (sql) {
      return await this.sequelize.queryRaw(sql, options);
    }
  }

  /**
   * Rename an SQL function
   *
   * @example
   * queryInterface.renameFunction(
   *   'fooFunction',
   *   [
   *     {type: 'varchar', name: 'param1', direction: 'IN'},
   *     {type: 'integer', name: 'param2', direction: 'INOUT'}
   *   ],
   *   'barFunction'
   * );
   *
   * @param {string} oldFunctionName  Current name of function
   * @param {Array}  params           List of parameters declared for SQL function
   * @param {string} newFunctionName  New name of function
   * @param {object} [options]        query options
   *
   * @returns {Promise}
   */
  async renameFunction(oldFunctionName, params, newFunctionName, options) {
    const sql = this.queryGenerator.renameFunction(oldFunctionName, params, newFunctionName);
    options ||= {};

    if (sql) {
      return await this.sequelize.queryRaw(sql, options);
    }
  }

  // Helper methods useful for querying

  /**
   * @private
   */
  ensureEnums() {
    // noop by default
  }

  /**
   * @private
   */
  ensureSequences() {
    // noop by default
  }

  /**
   * @private
   */
  getNextPrimaryKeyValue() {
    // noop by default
  }
}
