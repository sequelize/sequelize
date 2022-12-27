'use strict';

import { map } from '../../utils/iterators';
import { cloneDeep, getObjectFromMap } from '../../utils/object';
import { noSchemaParameter, noSchemaDelimiterParameter } from '../../utils/deprecations';
import { assertNoReservedBind, combineBinds } from '../../utils/sql';
import { AbstractDataType } from './data-types';
import { AbstractQueryInterfaceTypeScript } from './query-interface-typescript';

const _ = require('lodash');

const DataTypes = require('../../data-types');
const { Transaction } = require('../../transaction');
const { QueryTypes } = require('../../query-types');

/**
 * The interface that Sequelize uses to talk to all databases
 */
export class AbstractQueryInterface extends AbstractQueryInterfaceTypeScript {
  constructor(sequelize, queryGenerator) {
    super({ sequelize, queryGenerator });
  }

  /**
   * Create a database
   *
   * @param {string} database  Database name to create
   * @param {object} [options] Query options
   * @param {string} [options.charset] Database default character set, MYSQL only
   * @param {string} [options.collate] Database default collation
   * @param {string} [options.encoding] Database default character set, PostgreSQL only
   * @param {string} [options.ctype] Database character classification, PostgreSQL only
   * @param {string} [options.template] The name of the template from which to create the new database, PostgreSQL only
   *
   * @returns {Promise}
   */
  async createDatabase(database, options) {
    options = options || {};
    const sql = this.queryGenerator.createDatabaseQuery(database, options);

    return await this.sequelize.queryRaw(sql, options);
  }

  /**
   * Drop a database
   *
   * @param {string} database  Database name to drop
   * @param {object} [options] Query options
   *
   * @returns {Promise}
   */
  async dropDatabase(database, options) {
    const sql = this.queryGenerator.dropDatabaseQuery(database);

    return await this.sequelize.queryRaw(sql, options);
  }

  async listDatabases(options) {
    const sql = this.queryGenerator.listDatabasesQuery();

    return await this.sequelize.queryRaw(sql, { ...options, type: QueryTypes.SELECT });
  }

  /**
   * Drop a schema
   *
   * @param {string} schema    Schema name to drop
   * @param {object} [options] Query options
   *
   * @returns {Promise}
   */
  async dropSchema(schema, options) {
    const query = this.queryGenerator.dropSchemaQuery(schema);

    let sql;
    if (typeof query === 'object') {
      options = { ...options, bind: query.bind };
      sql = query.query;
    } else {
      sql = query;
    }

    return await this.sequelize.queryRaw(sql, options);
  }

  /**
   * Drop all schemas
   *
   * @param {object} [options] Query options
   *
   * @returns {Promise}
   */
  async dropAllSchemas(options) {
    options = options || {};

    if (!this.queryGenerator.dialect.supports.schemas) {
      return this.sequelize.drop(options);
    }

    const schemas = await this.showAllSchemas(options);

    return Promise.all(schemas.map(schemaName => this.dropSchema(schemaName, options)));
  }

  /**
   * Show all schemas
   *
   * @param {object} [options] Query options
   *
   * @returns {Promise<Array>}
   */
  async showAllSchemas(options) {
    const showSchemasSql = this.queryGenerator.listSchemasQuery(options);

    const schemaNames = await this.sequelize.queryRaw(showSchemasSql, {
      ...options,
      raw: true,
      type: this.sequelize.QueryTypes.SELECT,
    });

    return schemaNames.flatMap(value => (value.schema_name ? value.schema_name : value));
  }

  /**
   * Return database version
   *
   * @param {object}    [options]      Query options
   * @param {QueryType} [options.type] Query type
   *
   * @returns {Promise}
   * @private
   */
  // TODO: rename to getDatabaseVersion
  async databaseVersion(options) {
    return await this.sequelize.queryRaw(
      this.queryGenerator.versionQuery(),
      { ...options, type: QueryTypes.VERSION },
    );
  }

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

    if (model) {
      options.uniqueKeys = options.uniqueKeys || model.uniqueKeys;
    }

    attributes = _.mapValues(
      attributes,
      attribute => this.sequelize.normalizeAttribute(attribute),
    );

    // Postgres requires special SQL commands for ENUM/ENUM[]
    await this.ensureEnums(tableName, attributes, options, model);

    const modelTable = model?.table;

    if (
      !tableName.schema
      && (options.schema || modelTable?.schema)
    ) {
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
   * Returns a promise that will resolve to true if the table exists in the database, false otherwise.
   *
   * @param {TableName} tableName - The name of the table
   * @param {QueryOptions} options - Query options
   * @returns {Promise<boolean>}
   */
  async tableExists(tableName, options) {
    const sql = this.queryGenerator.tableExistsQuery(tableName);

    const out = await this.sequelize.query(sql, {
      ...options,
      type: QueryTypes.SHOWTABLES,
    });

    return out.length === 1;
  }

  /**
   * Drop a table from database
   *
   * @param {string} tableName Table name to drop
   * @param {object} options   Query options
   *
   * @returns {Promise}
   */
  async dropTable(tableName, options = {}) {
    options.cascade = options.cascade != null ? options.cascade
      // TODO: dropTable should not accept a "force" option, `sync()` should set `cascade` itself if its force option is true
      : (options.force && this.queryGenerator.dialect.supports.dropTable.cascade) ? true
      : undefined;

    const sql = this.queryGenerator.dropTableQuery(tableName, options);

    await this.sequelize.queryRaw(sql, options);
  }

  async _dropAllTables(tableNames, skip, options) {
    for (const tableName of tableNames) {
      // if tableName is not in the Array of tables names then don't drop it
      if (!skip.includes(tableName.tableName || tableName)) {
        await this.dropTable(tableName, {
          // enable "cascade" by default if supported by this dialect,
          // but let the user override the default
          cascade: this.queryGenerator.dialect.supports.dropTable.cascade ? true : undefined,
          ...options,
        });
      }
    }
  }

  /**
   * Drop all tables from database
   *
   * @param {object} [options] query options
   * @param {Array}  [options.skip] List of table to skip
   *
   * @returns {Promise}
   */
  async dropAllTables(options) {
    options = options || {};
    const skip = options.skip || [];

    const tableNames = await this.showAllTables(options);
    const foreignKeys = await this.getForeignKeysForTables(tableNames, options);

    for (const tableName of tableNames) {
      let normalizedTableName = tableName;
      if (_.isObject(tableName)) {
        normalizedTableName = `${tableName.schema}.${tableName.tableName}`;
      }

      for (const foreignKey of foreignKeys[normalizedTableName]) {
        await this.sequelize.queryRaw(this.queryGenerator.dropForeignKeyQuery(tableName, foreignKey));
      }
    }

    await this._dropAllTables(tableNames, skip, options);
  }

  /**
   * Rename a table
   *
   * @param {string} before    Current name of table
   * @param {string} after     New name from table
   * @param {object} [options] Query options
   *
   * @returns {Promise}
   */
  async renameTable(before, after, options) {
    options = options || {};
    const sql = this.queryGenerator.renameTableQuery(before, after);

    return await this.sequelize.queryRaw(sql, options);
  }

  /**
   * Get all tables in current database
   *
   * @param {object}    [options] Query options
   * @param {boolean}   [options.raw=true] Run query in raw mode
   * @param {QueryType} [options.type=QueryType.SHOWTABLE] query type
   *
   * @returns {Promise<Array>}
   * @private
   */
  async showAllTables(options) {
    options = {
      ...options,
      raw: true,
      type: QueryTypes.SHOWTABLES,
    };

    const showTablesSql = this.queryGenerator.showTablesQuery(this.sequelize.config.database);
    const tableNames = await this.sequelize.queryRaw(showTablesSql, options);

    return tableNames.flat();
  }

  /**
   * Describe a table structure
   *
   * This method returns an array of hashes containing information about all attributes in the table.
   *
   * ```js
   * {
   *    name: {
   *      type:         'VARCHAR(255)', // this will be 'CHARACTER VARYING' for pg!
   *      allowNull:    true,
   *      defaultValue: null
   *    },
   *    isBetaMember: {
   *      type:         'TINYINT(1)', // this will be 'BOOLEAN' for pg!
   *      allowNull:    false,
   *      defaultValue: false
   *    }
   * }
   * ```
   *
   * @param {TableName} tableName
   * @param {object} [options] Query options
   *
   * @returns {Promise<object>}
   */
  // TODO: allow TableNameOrModel for tableName
  async describeTable(tableName, options) {
    let table = {};

    if (typeof tableName === 'string') {
      table.tableName = tableName;
    }

    if (typeof tableName === 'object' && tableName !== null) {
      table = tableName;
    }

    if (typeof options === 'string') {
      noSchemaParameter();
      table.schema = options;
    }

    if (typeof options === 'object' && options !== null) {
      if (options.schema) {
        noSchemaParameter();
        table.schema = options.schema;
      }

      if (options.schemaDelimiter) {
        noSchemaDelimiterParameter();
        table.delimiter = options.schemaDelimiter;
      }
    }

    const sql = this.queryGenerator.describeTableQuery(table);
    options = { ...options, type: QueryTypes.DESCRIBE };

    try {
      const data = await this.sequelize.queryRaw(sql, options);
      /*
       * If no data is returned from the query, then the table name may be wrong.
       * Query generators that use information_schema for retrieving table info will just return an empty result set,
       * it will not throw an error like built-ins do (e.g. DESCRIBE on MySql).
       */
      if (_.isEmpty(data)) {
        throw new Error(`No description found for table ${table.tableName}${table.schema ? ` in schema ${table.schema}` : ''}. Check the table name and schema; remember, they _are_ case sensitive.`);
      }

      return data;
    } catch (error) {
      if (error.original && error.original.code === 'ER_NO_SUCH_TABLE') {
        throw new Error(`No description found for table ${table.tableName}${table.schema ? ` in schema ${table.schema}` : ''}. Check the table name and schema; remember, they _are_ case sensitive.`);
      }

      throw error;
    }
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
      throw new Error('addColumn takes at least 3 arguments (table, attribute name, attribute definition)');
    }

    attribute = this.sequelize.normalizeAttribute(attribute);

    if (
      attribute.type instanceof AbstractDataType
      // we don't give a context if it already has one, because it could come from a Model.
      && !attribute.type.usageContext
    ) {
      attribute.type.attachUsageContext({ tableName: table, columnName: key, sequelize: this.sequelize });
    }

    const { ifNotExists, ...rawQueryOptions } = options;
    const addColumnQueryOptions = ifNotExists ? { ifNotExists } : undefined;

    return await this.sequelize.queryRaw(this.queryGenerator.addColumnQuery(table, key, attribute, addColumnQueryOptions), rawQueryOptions);
  }

  /**
   * Remove a column from a table
   *
   * @param {string} tableName      Table to remove column from
   * @param {string} attributeName  Column name to remove
   * @param {object} [options]      Query options
   */
  async removeColumn(tableName, attributeName, options) {
    options = options || {};

    const { ifExists, ...rawQueryOptions } = options;
    const removeColumnQueryOptions = ifExists ? { ifExists } : undefined;

    return this.sequelize.queryRaw(this.queryGenerator.removeColumnQuery(tableName, attributeName, removeColumnQueryOptions), rawQueryOptions);
  }

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
    options = options || {};

    const query = this.queryGenerator.attributesToSQL({
      [attributeName]: this.normalizeAttribute(dataTypeOrOptions),
    }, {
      context: 'changeColumn',
      table: tableName,
    });
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
    options = options || {};
    const data = (await this.assertTableHasColumn(tableName, attrNameBefore, options))[attrNameBefore];

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

    options = cloneDeep(options);
    options.fields = attributes;
    const sql = this.queryGenerator.addIndexQuery(tableName, options, rawTablename);

    return await this.sequelize.queryRaw(sql, { ...options, supportsSearchPath: false });
  }

  /**
   * Show indexes on a table
   *
   * @param {TableNameOrModel} tableName
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
   * Returns all foreign key constraints of requested tables
   *
   * @param {string[]} tableNames table names
   * @param {object} [options] Query options
   *
   * @returns {Promise}
   */
  async getForeignKeysForTables(tableNames, options) {
    if (tableNames.length === 0) {
      return {};
    }

    options = { ...options, type: QueryTypes.FOREIGNKEYS };

    const results = await Promise.all(tableNames.map(tableName => this.sequelize.queryRaw(this.queryGenerator.getForeignKeysQuery(tableName, this.sequelize.config.database), options)));

    const result = {};

    for (let [i, tableName] of tableNames.entries()) {
      if (_.isObject(tableName)) {
        tableName = `${tableName.schema}.${tableName.tableName}`;
      }

      result[tableName] = Array.isArray(results[i])
        ? results[i].map(r => r.constraint_name)
        : [results[i] && results[i].constraint_name];

      result[tableName] = result[tableName].filter(_.identity);
    }

    return result;
  }

  /**
   * Get foreign key references details for the table
   *
   * Those details contains constraintSchema, constraintName, constraintCatalog
   * tableCatalog, tableSchema, tableName, columnName,
   * referencedTableCatalog, referencedTableCatalog, referencedTableSchema, referencedTableName, referencedColumnName.
   * Remind: constraint informations won't return if it's sqlite.
   *
   * @param {string} tableName table name
   * @param {object} [options]  Query options
   */
  async getForeignKeyReferencesForTable(tableName, options) {
    const queryOptions = {
      ...options,
      type: QueryTypes.FOREIGNKEYS,
    };
    const query = this.queryGenerator.getForeignKeysQuery(tableName, this.sequelize.config.database);

    return this.sequelize.queryRaw(query, queryOptions);
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
    options = options || {};
    const sql = this.queryGenerator.removeIndexQuery(tableName, indexNameOrAttributes, options);

    return await this.sequelize.queryRaw(sql, options);
  }

  /**
   * Add a constraint to a table
   *
   * Available constraints:
   * - UNIQUE
   * - DEFAULT (MSSQL only)
   * - CHECK (MySQL - Ignored by the database engine )
   * - FOREIGN KEY
   * - PRIMARY KEY
   *
   * @example <caption>UNIQUE</caption>
   * queryInterface.addConstraint('Users', {
   *   fields: ['email'],
   *   type: 'unique',
   *   name: 'custom_unique_constraint_name'
   * });
   *
   * @example <caption>CHECK</caption>
   * queryInterface.addConstraint('Users', {
   *   fields: ['roles'],
   *   type: 'check',
   *   where: {
   *      roles: ['user', 'admin', 'moderator', 'guest']
   *   }
   * });
   *
   * @example <caption>Default - MSSQL only</caption>
   * queryInterface.addConstraint('Users', {
   *    fields: ['roles'],
   *    type: 'default',
   *    defaultValue: 'guest'
   * });
   *
   * @example <caption>Primary Key</caption>
   * queryInterface.addConstraint('Users', {
   *    fields: ['username'],
   *    type: 'primary key',
   *    name: 'custom_primary_constraint_name'
   * });
   *
   * @example <caption>Foreign Key</caption>
   * queryInterface.addConstraint('Posts', {
   *   fields: ['username'],
   *   type: 'foreign key',
   *   name: 'custom_fkey_constraint_name',
   *   references: { //Required field
   *     table: 'target_table_name',
   *     field: 'target_column_name'
   *   },
   *   onDelete: 'cascade',
   *   onUpdate: 'cascade'
   * });
   *
   * @example <caption>Composite Foreign Key</caption>
   * queryInterface.addConstraint('TableName', {
   *   fields: ['source_column_name', 'other_source_column_name'],
   *   type: 'foreign key',
   *   name: 'custom_fkey_constraint_name',
   *   references: { //Required field
   *     table: 'target_table_name',
   *     fields: ['target_column_name', 'other_target_column_name']
   *   },
   *   onDelete: 'cascade',
   *   onUpdate: 'cascade'
   * });
   *
   * @param {string} tableName                   Table name where you want to add a constraint
   * @param {object} options                     An object to define the constraint name, type etc
   * @param {string} options.type                Type of constraint. One of the values in available constraints(case insensitive)
   * @param {Array}  options.fields              Array of column names to apply the constraint over
   * @param {string} [options.name]              Name of the constraint. If not specified, sequelize automatically creates a named constraint based on constraint type, table & column names
   * @param {string} [options.defaultValue]      The value for the default constraint
   * @param {object} [options.where]             Where clause/expression for the CHECK constraint
   * @param {object} [options.references]        Object specifying target table, column name to create foreign key constraint
   * @param {string} [options.references.table]  Target table name
   * @param {string} [options.references.field]  Target column name
   * @param {string} [options.references.fields] Target column names for a composite primary key. Must match the order of fields in options.fields.
   * @param {string} [options.deferrable]        Sets the constraint to be deferred or immediately checked. See Sequelize.Deferrable. PostgreSQL Only
   *
   * @returns {Promise}
   */
  async addConstraint(tableName, options) {
    if (!options.fields) {
      throw new Error('Fields must be specified through options.fields');
    }

    if (!options.type) {
      throw new Error('Constraint type must be specified through options.type');
    }

    options = cloneDeep(options);

    const sql = this.queryGenerator.addConstraintQuery(tableName, options);

    return await this.sequelize.queryRaw(sql, options);
  }

  async showConstraint(tableName, constraintName, options) {
    const sql = this.queryGenerator.showConstraintsQuery(tableName, constraintName);

    return await this.sequelize.queryRaw(sql, { ...options, type: QueryTypes.SHOWCONSTRAINTS });
  }

  /**
   * Remove a constraint from a table
   *
   * @param {string} tableName       Table name to drop constraint from
   * @param {string} constraintName  Constraint name
   * @param {object} options         Query options
   */
  async removeConstraint(tableName, constraintName, options) {
    return this.sequelize.queryRaw(this.queryGenerator.removeConstraintQuery(tableName, constraintName), options);
  }

  async insert(instance, tableName, values, options) {
    if (options?.bind) {
      assertNoReservedBind(options.bind);
    }

    options = cloneDeep(options);
    const modelDefinition = instance?.constructor.modelDefinition;

    options.hasTrigger = modelDefinition?.options.hasTrigger;
    const { query, bind } = this.queryGenerator.insertQuery(
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
        map(modelDefinition.primaryKeysAttributeNames, pkAttrName => modelDefinition.attributes.get(pkAttrName).columnName),
      );

      const uniqueColumnNames = Object.values(model.getIndexes()).filter(c => c.unique && c.fields.length > 0).map(c => c.fields);
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
        options.upsertKeys.length === 0
        || _.intersection(options.updateOnDuplicate, primaryKeys).length > 0
      ) {
        options.upsertKeys = primaryKeys;
      }

      options.upsertKeys = _.uniq(options.upsertKeys);
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

    const modelDefinition = instance?.constructor.modelDefinition;

    options = { ...options };
    options.hasTrigger = modelDefinition?.options.hasTrigger;

    const { query, bind } = this.queryGenerator.updateQuery(
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

    options = cloneDeep(options);
    if (typeof where === 'object') {
      where = cloneDeep(where);
    }

    const { bind, query } = this.queryGenerator.updateQuery(tableName, values, where, options, columnDefinitions);
    const table = _.isObject(tableName) ? tableName : { tableName };
    const model = options.model ? options.model : _.find(this.sequelize.modelManager.models, { tableName: table.tableName });

    options.type = QueryTypes.BULKUPDATE;
    options.model = model;
    options.bind = combineBinds(options.bind, bind);

    return await this.sequelize.queryRaw(query, options);
  }

  async delete(instance, tableName, identifier, options) {
    const cascades = [];

    const sql = this.queryGenerator.deleteQuery(tableName, identifier, {}, instance.constructor);

    options = { ...options };

    // unlike bind, replacements are handled by QueryGenerator, not QueryRaw
    delete options.replacements;

    // Check for a restrict field
    if (Boolean(instance.constructor) && Boolean(instance.constructor.associations)) {
      const keys = Object.keys(instance.constructor.associations);
      const length = keys.length;
      let association;

      for (let i = 0; i < length; i++) {
        association = instance.constructor.associations[keys[i]];
        if (association.options && association.options.onDelete
          && association.options.onDelete.toLowerCase() === 'cascade'
          && association.options.hooks === true) {
          cascades.push(association.accessors.get);
        }
      }
    }

    for (const cascade of cascades) {
      let instances = await instance[cascade](options);
      // Check for hasOne relationship with non-existing associate ("has zero")
      if (!instances) {
        continue;
      }

      if (!Array.isArray(instances)) {
        instances = [instances];
      }

      for (const _instance of instances) {
        await _instance.destroy(options);
      }
    }

    options.instance = instance;

    return await this.sequelize.queryRaw(sql, options);
  }

  /**
   * Delete multiple records from a table
   *
   * @param {string}  tableName            table name from where to delete records
   * @param {object}  where                where conditions to find records to delete
   * @param {object}  [options]            options
   * @param {boolean} [options.truncate]   Use truncate table command
   * @param {boolean} [options.cascade=false]         Only used in conjunction with TRUNCATE. Truncates  all tables that have foreign-key references to the named table, or to any tables added to the group due to CASCADE.
   * @param {boolean} [options.restartIdentity=false] Only used in conjunction with TRUNCATE. Automatically restart sequences owned by columns of the truncated table.
   * @param {Model}   [model]              Model
   *
   * @returns {Promise}
   */
  async bulkDelete(tableName, where, options, model) {
    options = cloneDeep(options);
    options = _.defaults(options, { limit: null });

    if (options.truncate === true) {
      return this.sequelize.queryRaw(
        this.queryGenerator.truncateTableQuery(tableName, options),
        options,
      );
    }

    if (typeof identifier === 'object') {
      where = cloneDeep(where);
    }

    const sql = this.queryGenerator.deleteQuery(tableName, where, options, model);

    // unlike bind, replacements are handled by QueryGenerator, not QueryRaw
    delete options.replacements;

    return await this.sequelize.queryRaw(
      sql,
      options,
    );
  }

  async select(model, tableName, optionsArg) {
    const options = { ...optionsArg, type: QueryTypes.SELECT, model };

    const sql = this.queryGenerator.selectQuery(tableName, options, model);

    // unlike bind, replacements are handled by QueryGenerator, not QueryRaw
    delete options.replacements;

    return await this.sequelize.queryRaw(sql, options);
  }

  async increment(model, tableName, where, incrementAmountsByField, extraAttributesToBeUpdated, options) {
    return this.#arithmeticQuery('+', model, tableName, where, incrementAmountsByField, extraAttributesToBeUpdated, options);
  }

  async decrement(model, tableName, where, incrementAmountsByField, extraAttributesToBeUpdated, options) {
    return this.#arithmeticQuery('-', model, tableName, where, incrementAmountsByField, extraAttributesToBeUpdated, options);
  }

  async #arithmeticQuery(operator, model, tableName, where, incrementAmountsByField, extraAttributesToBeUpdated, options) {
    options = cloneDeep(options);
    options.model = model;

    const sql = this.queryGenerator.arithmeticQuery(operator, tableName, where, incrementAmountsByField, extraAttributesToBeUpdated, options);

    options.type = QueryTypes.UPDATE;

    // unlike bind, replacements are handled by QueryGenerator, not QueryRaw
    delete options.replacements;

    return await this.sequelize.queryRaw(sql, options);
  }

  async rawSelect(tableName, options, attributeSelector, Model) {
    options = cloneDeep(options);
    options = _.defaults(options, {
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
    if ((dataType instanceof DataTypes.DECIMAL || dataType instanceof DataTypes.FLOAT) && result !== null) {
      return Number.parseFloat(result);
    }

    // TODO: BIGINT is not safely representable as an int!
    //  Use the DataType's parse method instead.
    if ((dataType instanceof DataTypes.INTEGER || dataType instanceof DataTypes.BIGINT) && result !== null) {
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
    const sql = this.queryGenerator.createTrigger(tableName, triggerName, timingType, fireOnArray, functionName, functionParams, optionsArray);
    options = options || {};
    if (sql) {
      return await this.sequelize.queryRaw(sql, options);
    }
  }

  async dropTrigger(tableName, triggerName, options) {
    const sql = this.queryGenerator.dropTrigger(tableName, triggerName);
    options = options || {};

    if (sql) {
      return await this.sequelize.queryRaw(sql, options);
    }
  }

  async renameTrigger(tableName, oldTriggerName, newTriggerName, options) {
    const sql = this.queryGenerator.renameTrigger(tableName, oldTriggerName, newTriggerName);
    options = options || {};

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
    const sql = this.queryGenerator.createFunction(functionName, params, returnType, language, body, optionsArray, options);
    options = options || {};

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
    options = options || {};

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
    options = options || {};

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

  async setIsolationLevel(transaction, value, options) {
    if (!transaction || !(transaction instanceof Transaction)) {
      throw new Error('Unable to set isolation level for a transaction without transaction object!');
    }

    if (transaction.parent || !value) {
      // Not possible to set a separate isolation level for savepoints
      return;
    }

    options = { ...options, transaction: transaction.parent || transaction };

    const sql = this.queryGenerator.setIsolationLevelQuery(value, {
      parent: transaction.parent,
    });

    if (!sql) {
      return;
    }

    return await this.sequelize.queryRaw(sql, options);
  }

  async startTransaction(transaction, options) {
    if (!transaction || !(transaction instanceof Transaction)) {
      throw new Error('Unable to start a transaction without transaction object!');
    }

    options = { ...options, transaction: transaction.parent || transaction };
    options.transaction.name = transaction.parent ? transaction.name : undefined;
    const sql = this.queryGenerator.startTransactionQuery(transaction);

    return await this.sequelize.queryRaw(sql, options);
  }

  async deferConstraints(transaction, options) {
    options = { ...options, transaction: transaction.parent || transaction };

    const sql = this.queryGenerator.deferConstraintsQuery(options);

    if (sql) {
      return await this.sequelize.queryRaw(sql, options);
    }
  }

  async commitTransaction(transaction, options) {
    if (!transaction || !(transaction instanceof Transaction)) {
      throw new Error('Unable to commit a transaction without transaction object!');
    }

    if (transaction.parent) {
      // Savepoints cannot be committed
      return;
    }

    options = {
      ...options,
      transaction: transaction.parent || transaction,
      supportsSearchPath: false,
      completesTransaction: true,
    };

    const sql = this.queryGenerator.commitTransactionQuery(transaction);
    const promise = this.sequelize.queryRaw(sql, options);

    transaction.finished = 'commit';

    return await promise;
  }

  async rollbackTransaction(transaction, options) {
    if (!transaction || !(transaction instanceof Transaction)) {
      throw new Error('Unable to rollback a transaction without transaction object!');
    }

    options = {
      ...options,
      transaction: transaction.parent || transaction,
      supportsSearchPath: false,
      completesTransaction: true,
    };
    options.transaction.name = transaction.parent ? transaction.name : undefined;
    const sql = this.queryGenerator.rollbackTransactionQuery(transaction);
    const promise = this.sequelize.queryRaw(sql, options);

    transaction.finished = 'rollback';

    return await promise;
  }
}
