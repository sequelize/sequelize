'use strict';

const _ = require('lodash');

const Utils = require('./utils');
const DataTypes = require('./data-types');
const SQLiteQueryInterface = require('./dialects/sqlite/query-interface');
const MSSQLQueryInterface = require('./dialects/mssql/query-interface');
const MySQLQueryInterface = require('./dialects/mysql/query-interface');
const PostgresQueryInterface = require('./dialects/postgres/query-interface');
const Transaction = require('./transaction');
const Promise = require('./promise');
const QueryTypes = require('./query-types');
const Op = require('./operators');

/**
 * The interface that Sequelize uses to talk to all databases
 *
 * @class QueryInterface
 */
class QueryInterface {
  constructor(sequelize) {
    this.sequelize = sequelize;
    this.QueryGenerator = this.sequelize.dialect.QueryGenerator;
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
    const sql = this.QueryGenerator.createDatabaseQuery(database, options);
    return await this.sequelize.query(sql, options);
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
    options = options || {};
    const sql = this.QueryGenerator.dropDatabaseQuery(database);
    return await this.sequelize.query(sql, options);
  }

  /**
   * Create a schema
   *
   * @param {string} schema    Schema name to create
   * @param {object} [options] Query options
   *
   * @returns {Promise}
   */
  async createSchema(schema, options) {
    options = options || {};
    const sql = this.QueryGenerator.createSchema(schema);
    return await this.sequelize.query(sql, options);
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
    options = options || {};
    const sql = this.QueryGenerator.dropSchema(schema);
    return await this.sequelize.query(sql, options);
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

    if (!this.QueryGenerator._dialect.supports.schemas) {
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
    options = Object.assign({}, options, {
      raw: true,
      type: this.sequelize.QueryTypes.SELECT
    });

    const showSchemasSql = this.QueryGenerator.showSchemasQuery(options);

    const schemaNames = await this.sequelize.query(showSchemasSql, options);

    return _.flatten(schemaNames.map(value => value.schema_name ? value.schema_name : value));
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
  async databaseVersion(options) {
    return await this.sequelize.query(
      this.QueryGenerator.versionQuery(),
      Object.assign({}, options, { type: QueryTypes.VERSION })
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
   *       type: Sequelize.INTEGER,
   *       primaryKey: true,
   *       autoIncrement: true
   *     },
   *     createdAt: {
   *       type: Sequelize.DATE
   *     },
   *     updatedAt: {
   *       type: Sequelize.DATE
   *     },
   *     attr1: Sequelize.STRING,
   *     attr2: Sequelize.INTEGER,
   *     attr3: {
   *       type: Sequelize.BOOLEAN,
   *       defaultValue: false,
   *       allowNull: false
   *     },
   *     //foreign key usage
   *     attr4: {
   *       type: Sequelize.INTEGER,
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
  async createTable(tableName, attributes, options, model) {
    let sql = '';

    options = _.clone(options) || {};

    if (options && options.uniqueKeys) {
      _.forOwn(options.uniqueKeys, uniqueKey => {
        if (uniqueKey.customIndex === undefined) {
          uniqueKey.customIndex = true;
        }
      });
    }

    if (model) {
      options.uniqueKeys = options.uniqueKeys || model.uniqueKeys;
    }

    attributes = _.mapValues(
      attributes,
      attribute => this.sequelize.normalizeAttribute(attribute)
    );

    // Postgres requires special SQL commands for ENUM/ENUM[]
    if (this.sequelize.options.dialect === 'postgres') {
      await PostgresQueryInterface.ensureEnums(this, tableName, attributes, options, model);
    }

    if (
      !tableName.schema &&
      (options.schema || !!model && model._schema)
    ) {
      tableName = this.QueryGenerator.addSchema({
        tableName,
        _schema: !!model && model._schema || options.schema
      });
    }

    attributes = this.QueryGenerator.attributesToSQL(attributes, { table: tableName, context: 'createTable' });
    sql = this.QueryGenerator.createTableQuery(tableName, attributes, options);

    return await this.sequelize.query(sql, options);
  }

  /**
   * Drop a table from database
   *
   * @param {string} tableName Table name to drop
   * @param {object} options   Query options
   *
   * @returns {Promise}
   */
  async dropTable(tableName, options) {
    // if we're forcing we should be cascading unless explicitly stated otherwise
    options = _.clone(options) || {};
    options.cascade = options.cascade || options.force || false;

    let sql = this.QueryGenerator.dropTableQuery(tableName, options);

    await this.sequelize.query(sql, options);
    const promises = [];

    // Since postgres has a special case for enums, we should drop the related
    // enum type within the table and attribute
    if (this.sequelize.options.dialect === 'postgres') {
      const instanceTable = this.sequelize.modelManager.getModel(tableName, { attribute: 'tableName' });

      if (instanceTable) {
        const getTableName = (!options || !options.schema || options.schema === 'public' ? '' : `${options.schema}_`) + tableName;

        const keys = Object.keys(instanceTable.rawAttributes);
        const keyLen = keys.length;

        for (let i = 0; i < keyLen; i++) {
          if (instanceTable.rawAttributes[keys[i]].type instanceof DataTypes.ENUM) {
            sql = this.QueryGenerator.pgEnumDrop(getTableName, keys[i]);
            options.supportsSearchPath = false;
            promises.push(this.sequelize.query(sql, Object.assign({}, options, { raw: true })));
          }
        }
      }
    }

    const obj = await Promise.all(promises);

    return obj[0];
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

    const dropAllTables = async tableNames => {
      for (const tableName of tableNames) {
        // if tableName is not in the Array of tables names then don't drop it
        if (!skip.includes(tableName.tableName || tableName)) {
          await this.dropTable(tableName, Object.assign({}, options, { cascade: true }) );
        }
      }
    };

    const tableNames = await this.showAllTables(options);
    if (this.sequelize.options.dialect === 'sqlite') {
      const result = await this.sequelize.query('PRAGMA foreign_keys;', options);
      const foreignKeysAreEnabled = result.foreign_keys === 1;

      if (foreignKeysAreEnabled) {
        await this.sequelize.query('PRAGMA foreign_keys = OFF', options);
        await dropAllTables(tableNames);
        await this.sequelize.query('PRAGMA foreign_keys = ON', options);
      } else {
        await dropAllTables(tableNames);
      }
    } else {
      const foreignKeys = await this.getForeignKeysForTables(tableNames, options);

      for (const tableName of tableNames) {
        let normalizedTableName = tableName;
        if (_.isObject(tableName)) {
          normalizedTableName = `${tableName.schema}.${tableName.tableName}`;
        }

        for (const foreignKey of foreignKeys[normalizedTableName]) {
          await this.sequelize.query(this.QueryGenerator.dropForeignKeyQuery(tableName, foreignKey));
        }
      }
      await dropAllTables(tableNames);
    }
  }

  /**
   * Drop specified enum from database (Postgres only)
   *
   * @param {string} [enumName]  Enum name to drop
   * @param {object} options Query options
   *
   * @returns {Promise}
   * @private
   */
  async dropEnum(enumName, options) {
    if (this.sequelize.getDialect() !== 'postgres') {
      return;
    }

    options = options || {};

    return this.sequelize.query(
      this.QueryGenerator.pgEnumDrop(null, null, this.QueryGenerator.pgEscapeAndQuote(enumName)),
      Object.assign({}, options, { raw: true })
    );
  }

  /**
   * Drop all enums from database (Postgres only)
   *
   * @param {object} options Query options
   *
   * @returns {Promise}
   * @private
   */
  async dropAllEnums(options) {
    if (this.sequelize.getDialect() !== 'postgres') {
      return;
    }

    options = options || {};

    const enums = await this.pgListEnums(null, options);

    return await Promise.all(enums.map(result => this.sequelize.query(
      this.QueryGenerator.pgEnumDrop(null, null, this.QueryGenerator.pgEscapeAndQuote(result.enum_name)),
      Object.assign({}, options, { raw: true })
    )));
  }

  /**
   * List all enums (Postgres only)
   *
   * @param {string} [tableName]  Table whose enum to list
   * @param {object} [options]    Query options
   *
   * @returns {Promise}
   * @private
   */
  pgListEnums(tableName, options) {
    options = options || {};
    const sql = this.QueryGenerator.pgListEnums(tableName);
    return this.sequelize.query(sql, Object.assign({}, options, { plain: false, raw: true, type: QueryTypes.SELECT }));
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
    const sql = this.QueryGenerator.renameTableQuery(before, after);
    return await this.sequelize.query(sql, options);
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
    options = Object.assign({}, options, {
      raw: true,
      type: QueryTypes.SHOWTABLES
    });

    const showTablesSql = this.QueryGenerator.showTablesQuery(this.sequelize.config.database);
    const tableNames = await this.sequelize.query(showTablesSql, options);
    return _.flatten(tableNames);
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
   * @param {string} tableName table name
   * @param {object} [options] Query options
   *
   * @returns {Promise<object>}
   */
  async describeTable(tableName, options) {
    let schema = null;
    let schemaDelimiter = null;

    if (typeof options === 'string') {
      schema = options;
    } else if (typeof options === 'object' && options !== null) {
      schema = options.schema || null;
      schemaDelimiter = options.schemaDelimiter || null;
    }

    if (typeof tableName === 'object' && tableName !== null) {
      schema = tableName.schema;
      tableName = tableName.tableName;
    }

    const sql = this.QueryGenerator.describeTableQuery(tableName, schema, schemaDelimiter);
    options = Object.assign({}, options, { type: QueryTypes.DESCRIBE });

    try {
      const data = await this.sequelize.query(sql, options);
      /*
       * If no data is returned from the query, then the table name may be wrong.
       * Query generators that use information_schema for retrieving table info will just return an empty result set,
       * it will not throw an error like built-ins do (e.g. DESCRIBE on MySql).
       */
      if (_.isEmpty(data)) {
        throw new Error(`No description found for "${tableName}" table. Check the table name and schema; remember, they _are_ case sensitive.`);
      }

      return data;
    } catch (e) {
      if (e.original && e.original.code === 'ER_NO_SUCH_TABLE') {
        throw new Error(`No description found for "${tableName}" table. Check the table name and schema; remember, they _are_ case sensitive.`);
      }

      throw e;
    }
  }

  /**
   * Add a new column to a table
   *
   * ```js
   * queryInterface.addColumn('tableA', 'columnC', Sequelize.STRING, {
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
  async addColumn(table, key, attribute, options) {
    if (!table || !key || !attribute) {
      throw new Error('addColumn takes at least 3 arguments (table, attribute name, attribute definition)');
    }

    options = options || {};
    attribute = this.sequelize.normalizeAttribute(attribute);
    return await this.sequelize.query(this.QueryGenerator.addColumnQuery(table, key, attribute), options);
  }

  /**
   * Remove a column from a table
   *
   * @param {string} tableName      Table to remove column from
   * @param {string} attributeName  Column name to remove
   * @param {object} [options]      Query options
   *
   * @returns {Promise}
   */
  async removeColumn(tableName, attributeName, options) {
    options = options || {};
    switch (this.sequelize.options.dialect) {
      case 'sqlite':
        // sqlite needs some special treatment as it cannot drop a column
        return await SQLiteQueryInterface.removeColumn(this, tableName, attributeName, options);
      case 'mssql':
        // mssql needs special treatment as it cannot drop a column with a default or foreign key constraint
        return await MSSQLQueryInterface.removeColumn(this, tableName, attributeName, options);
      case 'mysql':
      case 'mariadb':
        // mysql/mariadb need special treatment as it cannot drop a column with a foreign key constraint
        return await MySQLQueryInterface.removeColumn(this, tableName, attributeName, options);
      default:
        return await this.sequelize.query(this.QueryGenerator.removeColumnQuery(tableName, attributeName), options);
    }
  }

  /**
   * Change a column definition
   *
   * @param {string} tableName          Table name to change from
   * @param {string} attributeName      Column name
   * @param {object} dataTypeOrOptions  Attribute definition for new column
   * @param {object} [options]          Query options
   *
   * @returns {Promise}
   */
  async changeColumn(tableName, attributeName, dataTypeOrOptions, options) {
    const attributes = {};
    options = options || {};

    if (Object.values(DataTypes).includes(dataTypeOrOptions)) {
      attributes[attributeName] = { type: dataTypeOrOptions, allowNull: true };
    } else {
      attributes[attributeName] = dataTypeOrOptions;
    }

    attributes[attributeName] = this.sequelize.normalizeAttribute(attributes[attributeName]);

    if (this.sequelize.options.dialect === 'sqlite') {
      // sqlite needs some special treatment as it cannot change a column
      return SQLiteQueryInterface.changeColumn(this, tableName, attributes, options);
    }
    const query = this.QueryGenerator.attributesToSQL(attributes, {
      context: 'changeColumn',
      table: tableName
    });
    const sql = this.QueryGenerator.changeColumnQuery(tableName, query);

    return await this.sequelize.query(sql, options);
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
    let data = await this.describeTable(tableName, options);
    if (!data[attrNameBefore]) {
      throw new Error(`Table ${tableName} doesn't have the column ${attrNameBefore}`);
    }

    data = data[attrNameBefore] || {};

    const _options = {};

    _options[attrNameAfter] = {
      attribute: attrNameAfter,
      type: data.type,
      allowNull: data.allowNull,
      defaultValue: data.defaultValue
    };

    // fix: a not-null column cannot have null as default value
    if (data.defaultValue === null && !data.allowNull) {
      delete _options[attrNameAfter].defaultValue;
    }

    if (this.sequelize.options.dialect === 'sqlite') {
      // sqlite needs some special treatment as it cannot rename a column
      return SQLiteQueryInterface.renameColumn(this, tableName, attrNameBefore, attrNameAfter, options);
    }
    const sql = this.QueryGenerator.renameColumnQuery(
      tableName,
      attrNameBefore,
      this.QueryGenerator.attributesToSQL(_options)
    );
    return await this.sequelize.query(sql, options);
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

    options = Utils.cloneDeep(options);
    options.fields = attributes;
    const sql = this.QueryGenerator.addIndexQuery(tableName, options, rawTablename);
    return await this.sequelize.query(sql, Object.assign({}, options, { supportsSearchPath: false }));
  }

  /**
   * Show indexes on a table
   *
   * @param {string} tableName table name
   * @param {object} [options]   Query options
   *
   * @returns {Promise<Array>}
   * @private
   */
  async showIndex(tableName, options) {
    const sql = this.QueryGenerator.showIndexesQuery(tableName, options);
    return await this.sequelize.query(sql, Object.assign({}, options, { type: QueryTypes.SHOWINDEXES }));
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

    options = Object.assign({}, options || {}, { type: QueryTypes.FOREIGNKEYS });

    const results = await Promise.all(tableNames.map(tableName =>
      this.sequelize.query(this.QueryGenerator.getForeignKeysQuery(tableName, this.sequelize.config.database), options)));

    const result = {};

    tableNames.forEach((tableName, i) => {
      if (_.isObject(tableName)) {
        tableName = `${tableName.schema}.${tableName.tableName}`;
      }

      result[tableName] = Array.isArray(results[i])
        ? results[i].map(r => r.constraint_name)
        : [results[i] && results[i].constraint_name];

      result[tableName] = result[tableName].filter(_.identity);
    });

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
   *
   * @returns {Promise}
   */
  async getForeignKeyReferencesForTable(tableName, options) {
    const queryOptions = Object.assign({}, options, {
      type: QueryTypes.FOREIGNKEYS
    });
    const catalogName = this.sequelize.config.database;
    switch (this.sequelize.options.dialect) {
      case 'sqlite':
        // sqlite needs some special treatment.
        return await SQLiteQueryInterface.getForeignKeyReferencesForTable(this, tableName, queryOptions);
      case 'postgres':
      {
        // postgres needs some special treatment as those field names returned are all lowercase
        // in order to keep same result with other dialects.
        const query = this.QueryGenerator.getForeignKeyReferencesQuery(tableName, catalogName);
        const result = await this.sequelize.query(query, queryOptions);
        return result.map(Utils.camelizeObjectKeys);
      }
      case 'mssql':
      case 'mysql':
      case 'mariadb':
      default: {
        const query = this.QueryGenerator.getForeignKeysQuery(tableName, catalogName);
        return await this.sequelize.query(query, queryOptions);
      }
    }
  }

  /**
   * Remove an already existing index from a table
   *
   * @param {string} tableName                    Table name to drop index from
   * @param {string|string[]} indexNameOrAttributes  Index name or list of attributes that in the index
   * @param {object} [options]                    Query options
   *
   * @returns {Promise}
   */
  async removeIndex(tableName, indexNameOrAttributes, options) {
    options = options || {};
    const sql = this.QueryGenerator.removeIndexQuery(tableName, indexNameOrAttributes);
    return await this.sequelize.query(sql, options);
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
   * queryInterface.addConstraint('Users', ['email'], {
   *   type: 'unique',
   *   name: 'custom_unique_constraint_name'
   * });
   *
   * @example <caption>CHECK</caption>
   * queryInterface.addConstraint('Users', ['roles'], {
   *   type: 'check',
   *   where: {
   *      roles: ['user', 'admin', 'moderator', 'guest']
   *   }
   * });
   *
   * @example <caption>Default - MSSQL only</caption>
   * queryInterface.addConstraint('Users', ['roles'], {
   *    type: 'default',
   *    defaultValue: 'guest'
   * });
   *
   * @example <caption>Primary Key</caption>
   * queryInterface.addConstraint('Users', ['username'], {
   *    type: 'primary key',
   *    name: 'custom_primary_constraint_name'
   * });
   *
   * @example <caption>Foreign Key</caption>
   * queryInterface.addConstraint('Posts', ['username'], {
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
   * @param {string} tableName                  Table name where you want to add a constraint
   * @param {Array}  attributes                 Array of column names to apply the constraint over
   * @param {object} options                    An object to define the constraint name, type etc
   * @param {string} options.type               Type of constraint. One of the values in available constraints(case insensitive)
   * @param {string} [options.name]             Name of the constraint. If not specified, sequelize automatically creates a named constraint based on constraint type, table & column names
   * @param {string} [options.defaultValue]     The value for the default constraint
   * @param {object} [options.where]            Where clause/expression for the CHECK constraint
   * @param {object} [options.references]       Object specifying target table, column name to create foreign key constraint
   * @param {string} [options.references.table] Target table name
   * @param {string} [options.references.field] Target column name
   * @param {string} [rawTablename]             Table name, for backward compatibility
   *
   * @returns {Promise}
   */
  async addConstraint(tableName, attributes, options, rawTablename) {
    if (!Array.isArray(attributes)) {
      rawTablename = options;
      options = attributes;
      attributes = options.fields;
    }

    if (!options.type) {
      throw new Error('Constraint type must be specified through options.type');
    }

    if (!rawTablename) {
      // Map for backwards compat
      rawTablename = tableName;
    }

    options = Utils.cloneDeep(options);
    options.fields = attributes;

    if (this.sequelize.dialect.name === 'sqlite') {
      return await SQLiteQueryInterface.addConstraint(this, tableName, options, rawTablename);
    }
    const sql = this.QueryGenerator.addConstraintQuery(tableName, options, rawTablename);
    return await this.sequelize.query(sql, options);
  }

  async showConstraint(tableName, constraintName, options) {
    const sql = this.QueryGenerator.showConstraintsQuery(tableName, constraintName);
    return await this.sequelize.query(sql, Object.assign({}, options, { type: QueryTypes.SHOWCONSTRAINTS }));
  }

  /**
   * Remove a constraint from a table
   *
   * @param {string} tableName       Table name to drop constraint from
   * @param {string} constraintName  Constraint name
   * @param {object} options         Query options
   *
   * @returns {Promise}
   */
  async removeConstraint(tableName, constraintName, options) {
    options = options || {};

    switch (this.sequelize.options.dialect) {
      case 'mysql':
      case 'mariadb':
        //does not support DROP CONSTRAINT. Instead DROP PRIMARY, FOREIGN KEY, INDEX should be used
        return await MySQLQueryInterface.removeConstraint(this, tableName, constraintName, options);
      case 'sqlite':
        return await SQLiteQueryInterface.removeConstraint(this, tableName, constraintName, options);
      default:
        const sql = this.QueryGenerator.removeConstraintQuery(tableName, constraintName);
        return await this.sequelize.query(sql, options);
    }
  }

  async insert(instance, tableName, values, options) {
    options = Utils.cloneDeep(options);
    options.hasTrigger = instance && instance.constructor.options.hasTrigger;
    const sql = this.QueryGenerator.insertQuery(tableName, values, instance && instance.constructor.rawAttributes, options);

    options.type = QueryTypes.INSERT;
    options.instance = instance;

    const results = await this.sequelize.query(sql, options);
    if (instance) results[0].isNewRecord = false;

    return results;
  }

  /**
   * Upsert
   *
   * @param {string} tableName    table to upsert on
   * @param {object} insertValues values to be inserted, mapped to field name
   * @param {object} updateValues values to be updated, mapped to field name
   * @param {object} where        various conditions
   * @param {Model}  model        Model to upsert on
   * @param {object} options      query options
   *
   * @returns {Promise<boolean,?number>} Resolves an array with <created, primaryKey>
   */
  async upsert(tableName, insertValues, updateValues, where, model, options) {
    const wheres = [];
    const attributes = Object.keys(insertValues);
    let indexes = [];
    let indexFields;

    options = _.clone(options);

    if (!Utils.isWhereEmpty(where)) {
      wheres.push(where);
    }

    // Lets combine unique keys and indexes into one
    indexes = _.map(model.uniqueKeys, value => {
      return value.fields;
    });

    model._indexes.forEach(value => {
      if (value.unique) {
        // fields in the index may both the strings or objects with an attribute property - lets sanitize that
        indexFields = value.fields.map(field => {
          if (_.isPlainObject(field)) {
            return field.attribute;
          }
          return field;
        });
        indexes.push(indexFields);
      }
    });

    for (const index of indexes) {
      if (_.intersection(attributes, index).length === index.length) {
        where = {};
        for (const field of index) {
          where[field] = insertValues[field];
        }
        wheres.push(where);
      }
    }

    where = { [Op.or]: wheres };

    options.type = QueryTypes.UPSERT;
    options.raw = true;

    const sql = this.QueryGenerator.upsertQuery(tableName, insertValues, updateValues, where, model, options);
    const result = await this.sequelize.query(sql, options);
    switch (this.sequelize.options.dialect) {
      case 'postgres':
        return [result.created, result.primary_key];
      case 'mssql':
        return [
          result.$action === 'INSERT',
          result[model.primaryKeyField]
        ];
        // MySQL returns 1 for inserted, 2 for updated
        // http://dev.mysql.com/doc/refman/5.0/en/insert-on-duplicate.html.
      case 'mysql':
      case 'mariadb':
        return [result === 1, undefined];
      default:
        return [result, undefined];
    }
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
    options = _.clone(options) || {};
    options.type = QueryTypes.INSERT;

    const results = await this.sequelize.query(
      this.QueryGenerator.bulkInsertQuery(tableName, records, options, attributes),
      options
    );

    return results[0];
  }

  async update(instance, tableName, values, identifier, options) {
    options = _.clone(options || {});
    options.hasTrigger = !!(instance && instance._modelOptions && instance._modelOptions.hasTrigger);

    const sql = this.QueryGenerator.updateQuery(tableName, values, identifier, options, instance.constructor.rawAttributes);

    options.type = QueryTypes.UPDATE;

    options.instance = instance;
    return await this.sequelize.query(sql, options);
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
   * @param {object} identifier    A hash with conditions OR an ID as integer OR a string with conditions
   * @param {object} [options]     Various options, please see Model.bulkCreate options
   * @param {object} [attributes]  Attributes on return objects if supported by SQL dialect
   *
   * @returns {Promise}
   */
  async bulkUpdate(tableName, values, identifier, options, attributes) {
    options = Utils.cloneDeep(options);
    if (typeof identifier === 'object') identifier = Utils.cloneDeep(identifier);

    const sql = this.QueryGenerator.updateQuery(tableName, values, identifier, options, attributes);
    const table = _.isObject(tableName) ? tableName : { tableName };
    const model = _.find(this.sequelize.modelManager.models, { tableName: table.tableName });

    options.type = QueryTypes.BULKUPDATE;
    options.model = model;
    return await this.sequelize.query(sql, options);
  }

  async delete(instance, tableName, identifier, options) {
    const cascades = [];
    const sql = this.QueryGenerator.deleteQuery(tableName, identifier, {}, instance.constructor);

    options = _.clone(options) || {};

    // Check for a restrict field
    if (!!instance.constructor && !!instance.constructor.associations) {
      const keys = Object.keys(instance.constructor.associations);
      const length = keys.length;
      let association;

      for (let i = 0; i < length; i++) {
        association = instance.constructor.associations[keys[i]];
        if (association.options && association.options.onDelete &&
          association.options.onDelete.toLowerCase() === 'cascade' &&
          association.options.useHooks === true) {
          cascades.push(association.accessors.get);
        }
      }
    }

    for (const cascade of cascades) {
      let instances = await instance[cascade](options);
      // Check for hasOne relationship with non-existing associate ("has zero")
      if (!instances) continue;
      if (!Array.isArray(instances)) instances = [instances];
      for (const _instance of instances) await _instance.destroy(options);
    }
    options.instance = instance;
    return await this.sequelize.query(sql, options);
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
    options = Utils.cloneDeep(options);
    options = _.defaults(options, { limit: null });

    if (options.truncate === true) {
      return this.sequelize.query(
        this.QueryGenerator.truncateTableQuery(tableName, options),
        options
      );
    }

    if (typeof identifier === 'object') where = Utils.cloneDeep(where);

    return await this.sequelize.query(
      this.QueryGenerator.deleteQuery(tableName, where, options, model),
      options
    );
  }

  async select(model, tableName, optionsArg) {
    const options = Object.assign({}, optionsArg, { type: QueryTypes.SELECT, model });

    return await this.sequelize.query(
      this.QueryGenerator.selectQuery(tableName, options, model),
      options
    );
  }

  async increment(model, tableName, where, incrementAmountsByField, extraAttributesToBeUpdated, options) {
    options = Utils.cloneDeep(options);

    const sql = this.QueryGenerator.arithmeticQuery('+', tableName, where, incrementAmountsByField, extraAttributesToBeUpdated, options);

    options.type = QueryTypes.UPDATE;
    options.model = model;

    return await this.sequelize.query(sql, options);
  }

  async decrement(model, tableName, where, incrementAmountsByField, extraAttributesToBeUpdated, options) {
    options = Utils.cloneDeep(options);

    const sql = this.QueryGenerator.arithmeticQuery('-', tableName, where, incrementAmountsByField, extraAttributesToBeUpdated, options);

    options.type = QueryTypes.UPDATE;
    options.model = model;

    return await this.sequelize.query(sql, options);
  }

  async rawSelect(tableName, options, attributeSelector, Model) {
    options = Utils.cloneDeep(options);
    options = _.defaults(options, {
      raw: true,
      plain: true,
      type: QueryTypes.SELECT
    });

    const sql = this.QueryGenerator.selectQuery(tableName, options, Model);

    if (attributeSelector === undefined) {
      throw new Error('Please pass an attribute selector!');
    }

    const data = await this.sequelize.query(sql, options);
    if (!options.plain) {
      return data;
    }

    const result = data ? data[attributeSelector] : null;

    if (!options || !options.dataType) {
      return result;
    }

    const dataType = options.dataType;

    if (dataType instanceof DataTypes.DECIMAL || dataType instanceof DataTypes.FLOAT) {
      if (result !== null) {
        return parseFloat(result);
      }
    }
    if (dataType instanceof DataTypes.INTEGER || dataType instanceof DataTypes.BIGINT) {
      return parseInt(result, 10);
    }
    if (dataType instanceof DataTypes.DATE) {
      if (result !== null && !(result instanceof Date)) {
        return new Date(result);
      }
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
    options
  ) {
    const sql = this.QueryGenerator.createTrigger(tableName, triggerName, timingType, fireOnArray, functionName, functionParams, optionsArray);
    options = options || {};
    if (sql) {
      return await this.sequelize.query(sql, options);
    }
  }

  async dropTrigger(tableName, triggerName, options) {
    const sql = this.QueryGenerator.dropTrigger(tableName, triggerName);
    options = options || {};

    if (sql) {
      return await this.sequelize.query(sql, options);
    }
  }

  async renameTrigger(tableName, oldTriggerName, newTriggerName, options) {
    const sql = this.QueryGenerator.renameTrigger(tableName, oldTriggerName, newTriggerName);
    options = options || {};

    if (sql) {
      return await this.sequelize.query(sql, options);
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
    const sql = this.QueryGenerator.createFunction(functionName, params, returnType, language, body, optionsArray, options);
    options = options || {};

    if (sql) {
      return await this.sequelize.query(sql, options);
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
    const sql = this.QueryGenerator.dropFunction(functionName, params);
    options = options || {};

    if (sql) {
      return await this.sequelize.query(sql, options);
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
    const sql = this.QueryGenerator.renameFunction(oldFunctionName, params, newFunctionName);
    options = options || {};

    if (sql) {
      return await this.sequelize.query(sql, options);
    }
  }

  // Helper methods useful for querying

  /**
   * Escape an identifier (e.g. a table or attribute name)
   *
   * @param {string} identifier identifier to quote
   * @param {boolean} [force]   If force is true,the identifier will be quoted even if the `quoteIdentifiers` option is false.
   *
   * @private
   */
  quoteIdentifier(identifier, force) {
    return this.QueryGenerator.quoteIdentifier(identifier, force);
  }

  quoteTable(identifier) {
    return this.QueryGenerator.quoteTable(identifier);
  }

  /**
   * Quote array of identifiers at once
   *
   * @param {string[]} identifiers array of identifiers to quote
   * @param {boolean} [force]   If force is true,the identifier will be quoted even if the `quoteIdentifiers` option is false.
   *
   * @private
   */
  quoteIdentifiers(identifiers, force) {
    return this.QueryGenerator.quoteIdentifiers(identifiers, force);
  }

  /**
   * Escape a value (e.g. a string, number or date)
   *
   * @param {string} value string to escape
   *
   * @private
   */
  escape(value) {
    return this.QueryGenerator.escape(value);
  }

  async setIsolationLevel(transaction, value, options) {
    if (!transaction || !(transaction instanceof Transaction)) {
      throw new Error('Unable to set isolation level for a transaction without transaction object!');
    }

    if (transaction.parent || !value) {
      // Not possible to set a separate isolation level for savepoints
      return;
    }

    options = Object.assign({}, options, {
      transaction: transaction.parent || transaction
    });

    const sql = this.QueryGenerator.setIsolationLevelQuery(value, {
      parent: transaction.parent
    });

    if (!sql) return;

    return await this.sequelize.query(sql, options);
  }

  async startTransaction(transaction, options) {
    if (!transaction || !(transaction instanceof Transaction)) {
      throw new Error('Unable to start a transaction without transaction object!');
    }

    options = Object.assign({}, options, {
      transaction: transaction.parent || transaction
    });
    options.transaction.name = transaction.parent ? transaction.name : undefined;
    const sql = this.QueryGenerator.startTransactionQuery(transaction);

    return await this.sequelize.query(sql, options);
  }

  async deferConstraints(transaction, options) {
    options = Object.assign({}, options, {
      transaction: transaction.parent || transaction
    });

    const sql = this.QueryGenerator.deferConstraintsQuery(options);

    if (sql) {
      return await this.sequelize.query(sql, options);
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

    options = Object.assign({}, options, {
      transaction: transaction.parent || transaction,
      supportsSearchPath: false,
      completesTransaction: true
    });

    const sql = this.QueryGenerator.commitTransactionQuery(transaction);
    const promise = this.sequelize.query(sql, options);

    transaction.finished = 'commit';

    return await promise;
  }

  async rollbackTransaction(transaction, options) {
    if (!transaction || !(transaction instanceof Transaction)) {
      throw new Error('Unable to rollback a transaction without transaction object!');
    }

    options = Object.assign({}, options, {
      transaction: transaction.parent || transaction,
      supportsSearchPath: false,
      completesTransaction: true
    });
    options.transaction.name = transaction.parent ? transaction.name : undefined;
    const sql = this.QueryGenerator.rollbackTransactionQuery(transaction);
    const promise = this.sequelize.query(sql, options);

    transaction.finished = 'rollback';

    return await promise;
  }
}

module.exports = QueryInterface;
module.exports.QueryInterface = QueryInterface;
module.exports.default = QueryInterface;
