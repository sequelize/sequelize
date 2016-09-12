'use strict';

const url = require('url');
const Path = require('path');
const retry = require('retry-as-promised');
const clsBluebird = require('cls-bluebird');
const Utils = require('./utils');
const Model = require('./model');
const DataTypes = require('./data-types');
const Deferrable = require('./deferrable');
const ModelManager = require('./model-manager');
const QueryInterface = require('./query-interface');
const Transaction = require('./transaction');
const QueryTypes = require('./query-types');
const sequelizeErrors = require('./errors');
const Promise = require('./promise');
const Hooks = require('./hooks');
const Association = require('./associations/index');
const Validator = require('./utils/validator-extras').validator;
const _ = require('lodash');

/**
 * This is the main class, the entry point to sequelize. To use it, you just need to import sequelize:
 *
 * ```js
 * const Sequelize = require('sequelize');
 * ```
 *
 * In addition to sequelize, the connection library for the dialect you want to use should also be installed in your project. You don't need to import it however, as sequelize will take care of that.
 *
 * @class Sequelize
 */

 /**
  * Instantiate sequelize with name of database, username and password
  *
  * #### Example usage
  *
  * ```javascript
  * // without password and options
  * const sequelize = new Sequelize('database', 'username')
  *
  * // without options
  * const sequelize = new Sequelize('database', 'username', 'password')
  *
  * // without password / with blank password
  * const sequelize = new Sequelize('database', 'username', null, {})
  *
  * // with password and options
  * const sequelize = new Sequelize('my_database', 'john', 'doe', {})
  *
  * // with uri (see below)
  * const sequelize = new Sequelize('mysql://localhost:3306/database', {})
  * ```
  *
  * @name Sequelize
  * @constructor
  *
  * @param {String}   database The name of the database
  * @param {String}   [username=null] The username which is used to authenticate against the database.
  * @param {String}   [password=null] The password which is used to authenticate against the database. Supports SQLCipher encryption for SQLite.
  * @param {Object}   [options={}] An object with options.
  * @param {String}   [options.host='localhost'] The host of the relational database.
  * @param {Integer}  [options.port=] The port of the relational database.
  * @param {String}   [options.username=null] The username which is used to authenticate against the database.
  * @param {String}   [options.password=null] The password which is used to authenticate against the database.
  * @param {String}   [options.database=null] The name of the database
  * @param {String}   [options.dialect='mysql'] The dialect of the database you are connecting to. One of mysql, postgres, sqlite and mssql.
  * @param {String}   [options.dialectModulePath=null] If specified, load the dialect library from this path. For example, if you want to use pg.js instead of pg when connecting to a pg database, you should specify 'pg.js' here
  * @param {Object}   [options.dialectOptions] An object of additional options, which are passed directly to the connection library
  * @param {String}   [options.storage] Only used by sqlite. Defaults to ':memory:'
  * @param {String}   [options.protocol='tcp'] The protocol of the relational database.
  * @param {Object}   [options.define={}] Default options for model definitions. See sequelize.define for options
  * @param {Object}   [options.query={}] Default options for sequelize.query
  * @param {Object}   [options.set={}] Default options for sequelize.set
  * @param {Object}   [options.sync={}] Default options for sequelize.sync
  * @param {String}   [options.timezone='+00:00'] The timezone used when converting a date from the database into a JavaScript date. The timezone is also used to SET TIMEZONE when connecting to the server, to ensure that the result of NOW, CURRENT_TIMESTAMP and other time related functions have in the right timezone. For best cross platform performance use the format +/-HH:MM. Will also accept string versions of timezones used by moment.js (e.g. 'America/Los_Angeles'); this is useful to capture daylight savings time changes.
  * @param {Function} [options.logging=console.log] A function that gets executed every time Sequelize would log something.
  * @param {Boolean}  [options.benchmark=false] Pass query execution time in milliseconds as second argument to logging function (options.logging).
  * @param {Boolean}  [options.omitNull=false] A flag that defines if null values should be passed to SQL queries or not.
  * @param {Boolean}  [options.native=false] A flag that defines if native library shall be used or not. Currently only has an effect for postgres
  * @param {Boolean}  [options.replication=false] Use read / write replication. To enable replication, pass an object, with two properties, read and write. Write should be an object (a single server for handling writes), and read an array of object (several servers to handle reads). Each read/write server can have the following properties: `host`, `port`, `username`, `password`, `database`
  * @param {Object}   [options.pool={}] Should sequelize use a connection pool. Default is true
  * @param {Integer}  [options.pool.max] Maximum number of connection in pool. Default is 5
  * @param {Integer}  [options.pool.min] Minimum number of connection in pool. Default is 0
  * @param {Integer}  [options.pool.idle] The maximum time, in milliseconds, that a connection can be idle before being released
  * @param {Function} [options.pool.validateConnection] A function that validates a connection. Called with client. The default function checks that client is an object, and that its state is not disconnected
  * @param {Boolean}  [options.quoteIdentifiers=true] Set to `false` to make table names and attributes case-insensitive on Postgres and skip double quoting of them.
  * @param {String}   [options.transactionType='DEFERRED'] Set the default transaction type. See `Sequelize.Transaction.TYPES` for possible options. Sqlite only.
  * @param {String}   [options.isolationLevel] Set the default transaction isolation level. See `Sequelize.Transaction.ISOLATION_LEVELS` for possible options.
  * @param {Object}   [options.retry] Set of flags that control when a query is automatically retried.
  * @param {Array}    [options.retry.match] Only retry a query if the error matches one of these strings.
  * @param {Integer}  [options.retry.max] How many times a failing query is automatically retried.  Set to 0 to disable retrying on SQL_BUSY error.
  * @param {Boolean}  [options.typeValidation=false] Run built in type validators on insert and update, e.g. validate that arguments passed to integer fields are integer-like.
  */

/**
 * Instantiate sequelize with an URI
 * @name Sequelize
 * @constructor
 *
 * @param {String} uri A full database URI
 * @param {object} [options={}] See above for possible options
 */

/**
 * Instantiate sequelize with an options object
 * @name Sequelize
 * @constructor
 *
 * @param {object} [options={}] See above for possible options
 */
class Sequelize {

  constructor(database, username, password, options) {
    let config;

    if (arguments.length === 1 && typeof database === 'object') {
      // new Sequelize({ ... options })
      options = database;
      config = _.pick(options, 'host', 'port', 'database', 'username', 'password');
    } else if (arguments.length === 1 && typeof database === 'string' || arguments.length === 2 && typeof username === 'object') {
      // new Sequelize(URI, { ... options })

      config = {};
      options = username || {};

      const urlParts = url.parse(arguments[0]);

      // SQLite don't have DB in connection url
      if (urlParts.pathname) {
        config.database = urlParts.pathname.replace(/^\//, '');
      }

      options.dialect = urlParts.protocol.replace(/:$/, '');
      options.host = urlParts.hostname;

      if (urlParts.port) {
        options.port = urlParts.port;
      }

      if (urlParts.auth) {
        const authParts = urlParts.auth.split(':');

        config.username = authParts[0];

        if (authParts.length > 1)
          config.password = authParts.slice(1).join(':');
      }
    } else {
      // new Sequelize(database, username, password, { ... options })
      options = options || {};
      config = {database, username, password};
    }

    Sequelize.runHooks('beforeInit', config, options);

    this.options = Utils._.extend({
      dialect: null,
      dialectModulePath: null,
      host: 'localhost',
      protocol: 'tcp',
      define: {},
      query: {},
      sync: {},
      timezone:'+00:00',
      logging: console.log,
      omitNull: false,
      native: false,
      replication: false,
      ssl: undefined,
      pool: {},
      quoteIdentifiers: true,
      hooks: {},
      retry: {max: 5, match: ['SQLITE_BUSY: database is locked']},
      transactionType: Transaction.TYPES.DEFERRED,
      isolationLevel: null,
      databaseVersion: 0,
      typeValidation: false,
      benchmark: false
    }, options || {});

    if (!this.options.dialect) {
      throw new Error('Dialect needs to be explicitly supplied as of v4.0.0');
    }

    if (this.options.dialect === 'postgresql') {
      this.options.dialect = 'postgres';
    }

    if (this.options.dialect === 'sqlite' && this.options.timezone !== '+00:00') {
      throw new Error('Setting a custom timezone is not supported by SQLite, dates are always returned as UTC. Please remove the custom timezone parameter.');
    }

    if (this.options.logging === true) {
      Utils.deprecate('The logging-option should be either a function or false. Default: console.log');
      this.options.logging = console.log;
    }

    this.options.hooks = this.replaceHookAliases(this.options.hooks);

    if (['', null, false].indexOf(config.password) > -1 || typeof config.password === 'undefined') {
      config.password = null;
    }

    this.config = {
      database: config.database,
      username: config.username,
      password: config.password,
      host: config.host || this.options.host,
      port: config.port || this.options.port,
      pool: this.options.pool,
      protocol: this.options.protocol,
      native: this.options.native,
      ssl: this.options.ssl,
      replication: this.options.replication,
      dialectModulePath: this.options.dialectModulePath,
      keepDefaultTimezone: this.options.keepDefaultTimezone,
      dialectOptions: this.options.dialectOptions
    };

    let Dialect;
    // Requiring the dialect in a switch-case to keep the
    // require calls static. (Browserify fix)
    switch (this.getDialect()){
      case 'mssql':
        Dialect = require('./dialects/mssql');
        break;
      case 'mysql':
        Dialect = require('./dialects/mysql');
        break;
      case 'postgres':
        Dialect = require('./dialects/postgres');
        break;
      case 'sqlite':
        Dialect = require('./dialects/sqlite');
        break;
      default:
        throw new Error('The dialect ' + this.getDialect() + ' is not supported. Supported dialects: mssql, mysql, postgres, and sqlite.');
    }
    this.dialect = new Dialect(this);

    this.dialect.QueryGenerator.typeValidation = options.typeValidation;

    /**
     * Models are stored here under the name given to `sequelize.define`
     * @property models
     */
    this.models = {};
    this.modelManager = new ModelManager(this);
    this.connectionManager = this.dialect.connectionManager;

    this.importCache = {};

    this.test = {
      _trackRunningQueries: false,
      _runningQueries: 0,
      trackRunningQueries() {
        this._trackRunningQueries = true;
      },
      verifyNoRunningQueries() {
        if (this._runningQueries > 0) throw new Error('Expected 0 running queries. '+this._runningQueries+' queries still running');
      }
    };

    Sequelize.runHooks('afterInit', this);
  }

  get connectorManager() {
    return this.transactionManager.getConnectorManager();
  }

  refreshTypes() {
    this.connectionManager.refreshTypeParser(DataTypes);
  }

  /**
   * Returns the specified dialect.
   *
   * @return {String} The specified dialect.
   */
  getDialect() {
    return this.options.dialect;
  }

  /**
   * Returns an instance of QueryInterface.

   * @method getQueryInterface
   * @return {QueryInterface} An instance (singleton) of QueryInterface.
   *
   * @see {QueryInterface}
   */
  getQueryInterface() {
    this.queryInterface = this.queryInterface || new QueryInterface(this);
    return this.queryInterface;
  }

  /**
   * Define a new model, representing a table in the DB.
   *
   * The table columns are define by the hash that is given as the second argument. Each attribute of the hash represents a column. A short table definition might look like this:
   *
   * ```js
   * sequelize.define('modelName', {
   *     columnA: {
   *         type: Sequelize.BOOLEAN,
   *         validate: {
   *           is: ["[a-z]",'i'],        // will only allow letters
   *           max: 23,                  // only allow values <= 23
   *           isIn: {
   *             args: [['en', 'zh']],
   *             msg: "Must be English or Chinese"
   *           }
   *         },
   *         field: 'column_a'
   *         // Other attributes here
   *     },
   *     columnB: Sequelize.STRING,
   *     columnC: 'MY VERY OWN COLUMN TYPE'
   * })
   *
   * sequelize.models.modelName // The model will now be available in models under the name given to define
   * ```
   *
   *
   * As shown above, column definitions can be either strings, a reference to one of the datatypes that are predefined on the Sequelize constructor, or an object that allows you to specify both the type of the column, and other attributes such as default values, foreign key constraints and custom setters and getters.
   *
   * For a list of possible data types, see http://docs.sequelizejs.com/en/latest/docs/models-definition/#data-types
   *
   * For more about getters and setters, see http://docs.sequelizejs.com/en/latest/docs/models-definition/#getters-setters
   *
   * For more about instance and class methods, see http://docs.sequelizejs.com/en/latest/docs/models-definition/#expansion-of-models
   *
   * For more about validation, see http://docs.sequelizejs.com/en/latest/docs/models-definition/#validations
   *
   * @see {DataTypes}
   * @see {Hooks}
   * @param {String} modelName The name of the model. The model will be stored in `sequelize.models` under this name
   * @param {Object} attributes An object, where each attribute is a column of the table. See Model.init()
   * @param {Object} [options] These options are merged with the default define options provided to the Sequelize constructor and passed to Model.init()
   *
   * @return {Model}
   */
  define(modelName, attributes, options) { // testhint options:none
    options = options || {};

    options.modelName = modelName;
    options.sequelize = this;

    const model = class extends Model {};

    model.init(attributes, options);

    return model;
  }

  /**
   * Fetch a Model which is already defined
   *
   * @param {String} modelName The name of a model defined with Sequelize.define
   * @throws Will throw an error if the model is not defined (that is, if sequelize#isDefined returns false)
   * @return {Model}
   */
  model(modelName) {
    if (!this.isDefined(modelName)) {
      throw new Error(modelName + ' has not been defined');
    }

    return this.modelManager.getModel(modelName);
  }

  /**
   * Checks whether a model with the given name is defined
   *
   * @param {String} modelName The name of a model defined with Sequelize.define
   * @return {Boolean}
   */
  isDefined(modelName) {
    const models = this.modelManager.models;
    return models.filter(model => model.name === modelName).length !== 0;
  }

  /**
   * Imports a model defined in another file
   *
   * Imported models are cached, so multiple calls to import with the same path will not load the file multiple times
   *
   * See https://github.com/sequelize/express-example for a short example of how to define your models in separate files so that they can be imported by sequelize.import
   * @param {String} path The path to the file that holds the model you want to import. If the part is relative, it will be resolved relatively to the calling file
   * @return {Model}
   */
  import(path) {
    // is it a relative path?
    if(Path.normalize(path) !== Path.resolve(path)){
      // make path relative to the caller
      const callerFilename = Utils.stack()[1].getFileName();
      const callerPath = Path.dirname(callerFilename);

      path = Path.resolve(callerPath, path);
    }

    if (!this.importCache[path]) {
      let defineCall = arguments.length > 1 ? arguments[1] : require(path);
      if (typeof defineCall === 'object') {
        // ES6 module compatability
        defineCall = defineCall.default;
      }
      this.importCache[path] = defineCall(this, DataTypes);
    }

    return this.importCache[path];
  }

  /**
   * Execute a query on the DB, with the possibility to bypass all the sequelize goodness.
   *
   * By default, the function will return two arguments: an array of results, and a metadata object, containing number of affected rows etc. Use `.spread` to access the results.
   *
   * If you are running a type of query where you don't need the metadata, for example a `SELECT` query, you can pass in a query type to make sequelize format the results:
   *
   * ```js
   * sequelize.query('SELECT...').spread((results, metadata) => {
   *   // Raw query - use spread
   * });
   *
   * sequelize.query('SELECT...', { type: sequelize.QueryTypes.SELECT }).then(results => {
   *   // SELECT query - use then
   * })
   * ```
   *
   * @method query
   * @param {String}          sql
   * @param {Object}          [options={}] Query options.
   * @param {Boolean}         [options.raw] If true, sequelize will not try to format the results of the query, or build an instance of a model from the result
   * @param {Transaction}     [options.transaction=null] The transaction that the query should be executed under
   * @param {String}          [options.type='RAW'] The type of query you are executing. The query type affects how results are formatted before they are passed back. The type is a string, but `Sequelize.QueryTypes` is provided as convenience shortcuts.
   * @param {Boolean}         [options.nest=false] If true, transforms objects with `.` separated property names into nested objects using [dottie.js](https://github.com/mickhansen/dottie.js). For example { 'user.username': 'john' } becomes { user: { username: 'john' }}. When `nest` is true, the query type is assumed to be `'SELECT'`, unless otherwise specified
   * @param {Boolean}         [options.plain=false] Sets the query type to `SELECT` and return a single row
   * @param {Object|Array}    [options.replacements] Either an object of named parameter replacements in the format `:param` or an array of unnamed replacements to replace `?` in your SQL.
   * @param {Object|Array}    [options.bind] Either an object of named bind parameter in the format `_param` or an array of unnamed bind parameter to replace `$1, $2, ...` in your SQL.
   * @param {Boolean}         [options.useMaster=false] Force the query to use the write pool, regardless of the query type.
   * @param {Function}        [options.logging=false] A function that gets executed while running the query to log the sql.
   * @param {Instance}        [options.instance] A sequelize instance used to build the return instance
   * @param {Model}           [options.model] A sequelize model used to build the returned model instances (used to be called callee)
   * @param {Object}          [options.retry] Set of flags that control when a query is automatically retried.
   * @param {Array}           [options.retry.match] Only retry a query if the error matches one of these strings.
   * @param {Integer}         [options.retry.max] How many times a failing query is automatically retried.
   * @param {String}          [options.searchPath=DEFAULT] An optional parameter to specify the schema search_path (Postgres only)
   * @param {Boolean}         [options.supportsSearchPath] If false do not prepend the query with the search_path (Postgres only)
   * @param {Boolean}          [options.mapToModel=false] Map returned fields to model's fields if `options.model` or `options.instance` is present. Mapping will occur before building the model instance.
   * @param {Object}          [options.fieldMap] Map returned fields to arbitrary names for `SELECT` query type.
   *
   * @return {Promise}
   *
   * @see {Model#build} for more information about instance option.
   */
  query(sql, options) {
    if (arguments.length > 2) {
      // TODO: Remove this note in the next major version (4.0)
      throw new Error('Sequelize.query was refactored to only use the parameters `sql` and `options`. Please read the changelog about BC.');
    }

    options = _.assign({}, this.options.query, options);

    if (options.instance && !options.model) {
      options.model = options.instance.constructor;
    }

    // Map raw fields to model field names using the `fieldAttributeMap`
    if (options.model && options.mapToModel && !Utils._.isEmpty(options.model.fieldAttributeMap)) {
      options.fieldMap =  options.model.fieldAttributeMap;
    }

    if (typeof sql === 'object') {
      if (sql.values !== undefined) {
        if (options.replacements !== undefined) {
          throw new Error('Both `sql.values` and `options.replacements` cannot be set at the same time');
        }

        options.replacements = sql.values;
      }

      if (sql.bind !== undefined) {
        if (options.bind !== undefined) {
          throw new Error('Both `sql.bind` and `options.bind` cannot be set at the same time');
        }

        options.bind = sql.bind;
      }

      if (sql.query !== undefined) {
        sql = sql.query;
      }
    }

    sql = sql.trim();

    if (!options.instance && !options.model) {
      options.raw = true;
    }

    if (options.replacements && options.bind) {
      throw new Error('Both `replacements` and `bind` cannot be set at the same time');
    }
    if (options.replacements) {
      if (Array.isArray(options.replacements)) {
        sql = Utils.format([sql].concat(options.replacements), this.options.dialect);
      }
      else {
        sql = Utils.formatNamedParameters(sql, options.replacements, this.options.dialect);
      }
    }
    let bindParameters;
    if (options.bind) {
      const bindSql = this.dialect.Query.formatBindParameters(sql, options.bind, this.options.dialect);
      sql = bindSql[0];
      bindParameters = bindSql[1];
    }

    options = _.defaults(options, {
      logging: this.options.hasOwnProperty('logging') ? this.options.logging : console.log,
      searchPath: this.options.hasOwnProperty('searchPath') ? this.options.searchPath : 'DEFAULT'
    });

    if (options.transaction === undefined && Sequelize._cls) {
      options.transaction = Sequelize._cls.get('transaction');
    }

    if (!options.type) {
      if (options.model || options.nest || options.plain) {
        options.type = QueryTypes.SELECT;
      } else {
        options.type = QueryTypes.RAW;
      }
    }

    if (options.transaction && options.transaction.finished) {
      const error = new Error(options.transaction.finished+' has been called on this transaction('+options.transaction.id+'), you can no longer use it. (The rejected query is attached as the \'sql\' property of this error)');
      error.sql = sql;
      return Promise.reject(error);
    }

    if (this.test._trackRunningQueries) {
      this.test._runningQueries++;
    }

    //if dialect doesn't support search_path or dialect option
    //to prepend searchPath is not true delete the searchPath option
    if (!this.dialect.supports.searchPath || !this.options.dialectOptions || !this.options.dialectOptions.prependSearchPath ||
      options.supportsSearchPath === false) {
      delete options.searchPath;
    } else if (!options.searchPath) {
      //if user wants to always prepend searchPath (dialectOptions.preprendSearchPath = true)
      //then set to DEFAULT if none is provided
      options.searchPath = 'DEFAULT';
    }

    return Promise.resolve(
      options.transaction ? options.transaction.connection : this.connectionManager.getConnection(options)
    ).then(connection => {

      const query = new this.dialect.Query(connection, this, options);
      return retry(() => query.run(sql, bindParameters).finally(() => {
        if (!options.transaction) {
          return this.connectionManager.releaseConnection(connection);
        }
      }), Utils._.extend(this.options.retry, options.retry || {}));
    }).finally(() => {
      if (this.test._trackRunningQueries) {
        this.test._runningQueries--;
      }
    });
  }

  /**
   * Execute a query which would set an environment or user variable. The variables are set per connection, so this function needs a transaction.
   * Only works for MySQL.
   *
   * @method set
   * @param {Object}        variables Object with multiple variables.
   * @param {Object}        options Query options.
   * @param {Transaction}   options.transaction The transaction that the query should be executed under
   *
   * @return {Promise}
   */
  set(variables, options) {

    // Prepare options
    options = Utils._.extend({}, this.options.set, typeof options === 'object' && options || {});

    if (this.options.dialect !== 'mysql') {
      throw new Error('sequelize.set is only supported for mysql');
    }
    if (!options.transaction || !(options.transaction instanceof Transaction) ) {
      throw new TypeError('options.transaction is required');
    }

    // Override some options, since this isn't a SELECT
    options.raw = true;
    options.plain = true;
    options.type = 'SET';

    // Generate SQL Query
    const query =
      'SET '+
      Utils._.map(variables, (v, k) => '@'+k +' := '+ (typeof v === 'string' ? '"'+v+'"' : v)).join(', ');

    return this.query(query, options);
  }

  /**
   * Escape value.
   *
   * @param {String} value
   * @return {String}
   */
  escape(value) {
    return this.getQueryInterface().escape(value);
  }

  /**
   * Create a new database schema.
   *
   * Note,that this is a schema in the [postgres sense of the word](http://www.postgresql.org/docs/9.1/static/ddl-schemas.html),
   * not a database table. In mysql and sqlite, this command will do nothing.
   *
   * @see {Model#schema}
   * @param {String} schema Name of the schema
   * @param {Object} options={}
   * @param {Boolean|function} options.logging A function that logs sql queries, or false for no logging
   * @return {Promise}
   */
  createSchema(schema, options) {
    return this.getQueryInterface().createSchema(schema, options);
  }

  /**
   * Show all defined schemas
   *
   * Note,that this is a schema in the [postgres sense of the word](http://www.postgresql.org/docs/9.1/static/ddl-schemas.html),
   * not a database table. In mysql and sqlite, this will show all tables.
   * @param {Object} options={}
   * @param {Boolean|function} options.logging A function that logs sql queries, or false for no logging
   * @return {Promise}
   */
  showAllSchemas(options) {
    return this.getQueryInterface().showAllSchemas(options);
  }

  /**
   * Drop a single schema
   *
   * Note,that this is a schema in the [postgres sense of the word](http://www.postgresql.org/docs/9.1/static/ddl-schemas.html),
   * not a database table. In mysql and sqlite, this drop a table matching the schema name
   * @param {String} schema Name of the schema
   * @param {Object} options={}
   * @param {Boolean|function} options.logging A function that logs sql queries, or false for no logging
   * @return {Promise}
   */
  dropSchema(schema, options) {
    return this.getQueryInterface().dropSchema(schema, options);
  }

  /**
   * Drop all schemas
   *
   * Note,that this is a schema in the [postgres sense of the word](http://www.postgresql.org/docs/9.1/static/ddl-schemas.html),
   * not a database table. In mysql and sqlite, this is the equivalent of drop all tables.
   * @param {Object} options={}
   * @param {Boolean|function} options.logging A function that logs sql queries, or false for no logging
   * @return {Promise}
   */
  dropAllSchemas(options) {
    return this.getQueryInterface().dropAllSchemas(options);
  }

  /**
   * Sync all defined models to the DB.
   *
   * @param {Object} [options={}]
   * @param {Boolean} [options.force=false] If force is true, each DAO will do DROP TABLE IF EXISTS ..., before it tries to create its own table
   * @param {RegEx} [options.match] Match a regex against the database name before syncing, a safety check for cases where force: true is used in tests but not live code
   * @param {Boolean|function} [options.logging=console.log] A function that logs sql queries, or false for no logging
   * @param {String} [options.schema='public'] The schema that the tables should be created in. This can be overriden for each table in sequelize.define
   * @param  {String} [options.searchPath=DEFAULT] An optional parameter to specify the schema search_path (Postgres only)
   * @param {Boolean} [options.hooks=true] If hooks is true then beforeSync, afterSync, beforBulkSync, afterBulkSync hooks will be called
   * @return {Promise}
   */
  sync(options) {

    options = _.clone(options) || {};
    options.hooks = options.hooks === undefined ? true : !!options.hooks;
    options = Utils._.defaults(options, this.options.sync, this.options);

    if (options.match) {
      if (!options.match.test(this.config.database)) {
        return Promise.reject(new Error('Database does not match sync match parameter'));
      }
    }

    return Promise.try(() => {
      if (options.hooks) {
        return this.runHooks('beforeBulkSync', options);
      }
    }).then(() => {
      if (options.force) {
        return this.drop(options);
      }
    }).then(() => {
      const models = [];

      // Topologically sort by foreign key constraints to give us an appropriate
      // creation order
      this.modelManager.forEachModel(model => {
        if (model) {
          models.push(model);
        } else {
          // DB should throw an SQL error if referencing inexistant table
        }
      });

      return Promise.each(models, model => model.sync(options));
    }).then(() => {
      if (options.hooks) {
        return this.runHooks('afterBulkSync', options);
      }
    }).return(this);
  }

  /**
   * Truncate all tables defined through the sequelize models. This is done
   * by calling Model.truncate() on each model.
   *
   * @param {object} [options] The options passed to Model.destroy in addition to truncate
   * @param {Boolean|function} [options.transaction]
   * @param {Boolean|function} [options.logging] A function that logs sql queries, or false for no logging
   * @return {Promise}
   *
   * @see {Model#truncate} for more information
   */
  truncate(options) {
    const models = [];

    this.modelManager.forEachModel(model => {
      if (model) {
        models.push(model);
      }
    }, { reverse: false });

    const truncateModel = model => model.truncate(options);

    if (options && options.cascade) {
      return Promise.each(models, truncateModel);
    } else {
      return Promise.map(models, truncateModel);
    }
  }

  /**
   * Drop all tables defined through this sequelize instance. This is done by calling Model.drop on each model
   * @see {Model#drop} for options
   *
   * @param {object} options  The options passed to each call to Model.drop
   * @param {Boolean|function} options.logging A function that logs sql queries, or false for no logging
   * @return {Promise}
   */
  drop(options) {
    const models = [];

    this.modelManager.forEachModel(model => {
      if (model) {
        models.push(model);
      }
    }, { reverse: false });

    return Promise.each(models, model => model.drop(options));
  }

  /**
   * Test the connection by trying to authenticate
   *
   * @fires success If authentication was successful
   * @error 'Invalid credentials' if the authentication failed (even if the database did not respond at all...)
   * @alias validate
   * @return {Promise}
   */
  authenticate(options) {
    return this.query('SELECT 1+1 AS result', Utils._.assign({ raw: true, plain: true }, options)).return();
  }

  databaseVersion(options) {
    return this.getQueryInterface().databaseVersion(options);
  }

  /**
   * Creates a object representing a database function. This can be used in search queries, both in where and order parts, and as default values in column definitions.
   * If you want to refer to columns in your function, you should use `sequelize.col`, so that the columns are properly interpreted as columns and not a strings.
   *
   * Convert a user's username to upper case
   * ```js
   * instance.updateAttributes({
   *   username: self.sequelize.fn('upper', self.sequelize.col('username'))
   * })
   * ```
   *
   * @see {Model#find}
   * @see {Model#findAll}
   * @see {Model#define}
   * @see {Sequelize#col}
   * @method fn
   *
   * @param {String} fn The function you want to call
   * @param {any} args All further arguments will be passed as arguments to the function
   *
   * @since v2.0.0-dev3
   * @return {Sequelize.fn}
   */
  static fn(fn) {
    return new Utils.Fn(fn, Utils.sliceArgs(arguments, 1));
  }

  /**
   * Creates a object representing a column in the DB. This is often useful in conjunction with `sequelize.fn`, since raw string arguments to fn will be escaped.
   * @see {Sequelize#fn}
   *
   * @method col
   * @param {String} col The name of the column
   * @since v2.0.0-dev3
   * @return {Sequelize.col}
   */
  static col(col) {
    return new Utils.Col(col);
  }

  /**
   * Creates a object representing a call to the cast function.
   *
   * @method cast
   * @param {any} val The value to cast
   * @param {String} type The type to cast it to
   * @since v2.0.0-dev3
   * @return {Sequelize.cast}
   */
  static cast(val, type) {
    return new Utils.Cast(val, type);
  }

  /**
   * Creates a object representing a literal, i.e. something that will not be escaped.
   *
   * @method literal
   * @param {any} val
   * @alias asIs
   * @since v2.0.0-dev3
   * @return {Sequelize.literal}
   */
  static literal(val) {
    return new Utils.Literal(val);
  }

  /**
   * An AND query
   * @see {Model#find}
   *
   * @method and
   * @param {String|Object} args Each argument will be joined by AND
   * @since v2.0.0-dev3
   * @return {Sequelize.and}
   */
  static and() {
    return { $and: Utils.sliceArgs(arguments) };
  }

  /**
   * An OR query
   * @see {Model#find}
   *
   * @method or
   * @param {String|Object} args Each argument will be joined by OR
   * @since v2.0.0-dev3
   * @return {Sequelize.or}
   */
  static or() {
    return { $or: Utils.sliceArgs(arguments) };
  }

  /**
   * Creates an object representing nested where conditions for postgres's json data-type.
   * @see {Model#find}
   *
   * @method json
   * @param {String|Object} conditions A hash containing strings/numbers or other nested hash, a string using dot notation or a string using postgres json syntax.
   * @param {String|Number|Boolean} [value] An optional value to compare against. Produces a string of the form "<json path> = '<value>'".
   * @return {Sequelize.json}
   */
  static json(conditionsOrPath, value) {
    return new Utils.Json(conditionsOrPath, value);
  }

  /**
   * A way of specifying attr = condition.
   *
   * The attr can either be an object taken from `Model.rawAttributes` (for example `Model.rawAttributes.id` or `Model.rawAttributes.name`). The
   * attribute should be defined in your model definition. The attribute can also be an object from one of the sequelize utility functions (`sequelize.fn`, `sequelize.col` etc.)
   *
   * For string attributes, use the regular `{ where: { attr: something }}` syntax. If you don't want your string to be escaped, use `sequelize.literal`.
   *
   * @see {Model#find}
   *
   * @param {Object} attr The attribute, which can be either an attribute object from `Model.rawAttributes` or a sequelize object, for example an instance of `sequelize.fn`. For simple string attributes, use the POJO syntax
   * @param {string} [comparator='=']
   * @param {String|Object} logic The condition. Can be both a simply type, or a further condition (`$or`, `$and`, `.literal` etc.)
   * @method where
   * @alias condition
   * @since v2.0.0-dev3
   * @return {Sequelize.where}
   */
  static where(attr, comparator, logic) {
    return new Utils.Where(attr, comparator, logic);
  }

  /**
   * Start a transaction. When using transactions, you should pass the transaction in the options argument in order for the query to happen under that transaction
   *
   * ```js
   * sequelize.transaction().then(transaction => {
   *   return User.find(..., {transaction})
   *     .then(user => user.updateAttributes(..., {transaction}))
   *     .then(() => transaction.commit())
   *     .catch(() => transaction.rollback());
   * })
   * ```
   *
   * A syntax for automatically committing or rolling back based on the promise chain resolution is also supported:
   *
   * ```js
   * sequelize.transaction(transaction => { // Note that we use a callback rather than a promise.then()
   *   return User.find(..., {transaction})
   *     .then(user => user.updateAttributes(..., {transaction}))
   * }).then(() => {
   *   // Committed
   * }).catch(err => {
   *   // Rolled back
   *   console.error(err);
   * });
   * ```
   *
   * If you have [CLS](https://github.com/othiym23/node-continuation-local-storage) enabled, the transaction will automatically be passed to any query that runs within the callback.
   * To enable CLS, add it do your project, create a namespace and set it on the sequelize constructor:
   *
   * ```js
   * const cls = require('continuation-local-storage');
   * const ns = cls.createNamespace('....');
   * const Sequelize = require('sequelize');
   * Sequelize.useCLS(ns);
   * ```
   * Note, that CLS is enabled for all sequelize instances, and all instances will share the same namespace
   *
   * @see {Transaction}
   * @param {Object}   [options={}]
   * @param {Boolean}  [options.autocommit]
   * @param {String}   [options.type='DEFERRED'] See `Sequelize.Transaction.TYPES` for possible options. Sqlite only.
   * @param {String}   [options.isolationLevel] See `Sequelize.Transaction.ISOLATION_LEVELS` for possible options
   * @param {Function} [options.logging=false] A function that gets executed while running the query to log the sql.
   * @return {Promise}
   * @fires error If there is an uncaught error during the transaction
   * @fires success When the transaction has ended (either committed or rolled back)
   */
  transaction(options, autoCallback) {
    if (typeof options === 'function') {
      autoCallback = options;
      options = undefined;
    }
    // testhint argsConform.end

    const transaction = new Transaction(this, options);

    if (!autoCallback) return transaction.prepareEnvironment().return(transaction);

    // autoCallback provided
    return Sequelize._clsRun(() => {
      return transaction.prepareEnvironment()
        .then(() => autoCallback(transaction))
        .tap(() => transaction.commit())
        .catch(err => {
          // Rollback transaction if not already finished (commit, rollback, etc)
          // and reject with original error (ignore any error in rollback)
          return Promise.try(() => {
            if (!transaction.finished) return transaction.rollback().catch(function() {});
          }).throw(err);
        });
    });
  }

  /**
   * Use CLS with Sequelize.
   * CLS namespace provided is stored as `Sequelize._cls`
   * and bluebird Promise is patched to use the namespace, using `cls-bluebird` module.
   *
   * @param {Object}   ns   CLS namespace
   * @returns {Object}      Sequelize constructor
   */
  static useCLS(ns) {
    // check `ns` is valid CLS namespace
    if (!ns || typeof ns !== 'object' || typeof ns.bind !== 'function' || typeof ns.run !== 'function') throw new Error('Must provide CLS namespace');

    // save namespace as `Sequelize._cls`
    this._cls = ns;

    // patch bluebird to bind all promise callbacks to CLS namespace
    clsBluebird(ns, Promise);

    // return Sequelize for chaining
    return this;
  }

  /**
   * Run function in CLS context.
   * If no CLS context in use, just runs the function normally
   *
   * @private
   * @param {Function} fn Function to run
   * @returns {*} Return value of function
   */
  static _clsRun(fn) {
    var ns = Sequelize._cls;
    if (!ns) return fn();

    var res;
    ns.run((context) => res = fn(context));
    return res;
  }

  /*
   * Getter/setter for `Sequelize.cls`
   * To maintain backward compatibility with Sequelize v3.x
   * Calling the
   */
  static get cls() {
    Utils.deprecate('Sequelize.cls is deprecated and will be removed in a future version. Keep track of the CLS namespace you use in your own code.');
    return this._cls;
  }

  static set cls(ns) {
    Utils.deprecate('Sequelize.cls should not be set directly. Use Sequelize.useCLS().');
    this.useCLS(ns);
  }

  log() {
    let options;
    let args = Utils.sliceArgs(arguments);
    const last = Utils._.last(args);

    if (last && Utils._.isPlainObject(last) && last.hasOwnProperty('logging')) {
      options = last;

      // remove options from set of logged arguments
      args.splice(args.length-1, 1);
    } else {
      options = this.options;
    }

    if (options.logging) {
      if (options.logging === true) {
        console.log('DEPRECATION WARNING: The logging-option should be either a function or false. Default: console.log');
        options.logging = console.log;
      }

      // second argument is sql-timings, when benchmarking option enabled
      if ((this.options.benchmark || options.benchmark) && options.logging === console.log) {
        args = [args[0] + ' Elapsed time: ' + args[1] + 'ms'];
      }

      options.logging.apply(null, args);
    }
  }

  /**
   * Close all connections used by this sequelize instance, and free all references so the instance can be garbage collected.
   *
   * Normally this is done on process exit, so you only need to call this method if you are creating multiple instances, and want
   * to garbage collect some of them.
   */
  close() {
    this.connectionManager.close();
  }

  normalizeDataType(Type) {
    let type = typeof Type === 'function' ? new Type() : Type;
    const dialectTypes = this.dialect.DataTypes || {};

    if (dialectTypes[type.key]) {
      type = dialectTypes[type.key].extend(type);
    }

    if (type instanceof DataTypes.ARRAY && dialectTypes[type.type.key]) {
      type.type = dialectTypes[type.type.key].extend(type.type);
    }
    return type;
  }
  normalizeAttribute(attribute) {
    if (!Utils._.isPlainObject(attribute)) {
      attribute = { type: attribute };
    }

    if (!attribute.type) return attribute;

    attribute.type = this.normalizeDataType(attribute.type);

    if (attribute.hasOwnProperty('defaultValue')) {
      if (typeof attribute.defaultValue === 'function' && (
          attribute.defaultValue === DataTypes.NOW ||
          attribute.defaultValue === DataTypes.UUIDV1 ||
          attribute.defaultValue === DataTypes.UUIDV4
      )) {
        attribute.defaultValue = new attribute.defaultValue();
      }
    }

    if (attribute.type instanceof DataTypes.ENUM) {
      // The ENUM is a special case where the type is an object containing the values
      if (attribute.values) {
        attribute.type.values = attribute.type.options.values = attribute.values;
      } else {
        attribute.values = attribute.type.values;
      }

      if (!attribute.values.length) {
        throw new Error('Values for ENUM have not been defined.');
      }
    }

    return attribute;
  }
}

// Aliases
Sequelize.prototype.fn = Sequelize.fn;
Sequelize.prototype.col = Sequelize.col;
Sequelize.prototype.cast = Sequelize.cast;
Sequelize.prototype.literal = Sequelize.asIs = Sequelize.prototype.asIs = Sequelize.literal;
Sequelize.prototype.and = Sequelize.and;
Sequelize.prototype.or = Sequelize.or;
Sequelize.prototype.json = Sequelize.json;
Sequelize.prototype.where = Sequelize.condition = Sequelize.prototype.condition = Sequelize.where;
Sequelize.prototype.validate = Sequelize.prototype.authenticate;

/**
 * Sequelize version number.
 * @property version
 */
Sequelize.version = require('../package.json').version;

Sequelize.options = {hooks: {}};

/**
 * A reference to Sequelize constructor from sequelize. Useful for accessing DataTypes, Errors etc.
 * @property Sequelize
 * @see {Sequelize}
 */
Sequelize.prototype.Sequelize = Sequelize;

/**
 * @private
 */
Sequelize.prototype.Utils = Sequelize.Utils = Utils;

/**
 * A handy reference to the bluebird Promise class
 * @property Promise
 */
Sequelize.prototype.Promise = Sequelize.Promise = Promise;

/**
 * Available query types for use with `sequelize.query`
 * @property QueryTypes
 */
Sequelize.prototype.QueryTypes = Sequelize.QueryTypes = QueryTypes;

/**
 * Exposes the validator.js object, so you can extend it with custom validation functions. The validator is exposed both on the instance, and on the constructor.
 * @property Validator
 * @see https://github.com/chriso/validator.js
 */
Sequelize.prototype.Validator = Sequelize.Validator = Validator;

Sequelize.prototype.Model = Sequelize.Model = Model;

Sequelize.DataTypes = DataTypes;
for (const dataType in DataTypes) {
  Sequelize[dataType] = DataTypes[dataType];
}

/**
 * A reference to the sequelize transaction class. Use this to access isolationLevels and types when creating a transaction
 * @property Transaction
 * @see {Transaction}
 * @see {Sequelize#transaction}
 */
Sequelize.prototype.Transaction = Sequelize.Transaction = Transaction;

/**
 * A reference to the deferrable collection. Use this to access the different deferrable options.
 * @property Deferrable
 * @see {Deferrable}
 * @see {Sequelize#transaction}
 */
Sequelize.prototype.Deferrable = Sequelize.Deferrable = Deferrable;

/**
 * A reference to the sequelize association class.
 * @property Association
 * @see {Association}
 */
Sequelize.prototype.Association = Sequelize.Association = Association;

/**
 * Provide alternative version of `inflection` module to be used by `Utils.pluralize` etc.
 * @param {Object} _inflection - `inflection` module
 */
Sequelize.useInflection = Utils.useInflection;

/**
 * Allow hooks to be defined on Sequelize + on sequelize instance as universal hooks to run on all models
 * and on Sequelize/sequelize methods e.g. Sequelize(), Sequelize#define()
 */
Hooks.applyTo(Sequelize);
Hooks.applyTo(Sequelize.prototype);

/**
 * A general error class
 * @property Error
 * @see {Errors#BaseError}
 */
Sequelize.prototype.Error = Sequelize.Error =
  sequelizeErrors.BaseError;

/**
 * Emitted when a validation fails
 * @property ValidationError
 * @see {Errors#ValidationError}
 */
Sequelize.prototype.ValidationError = Sequelize.ValidationError =
  sequelizeErrors.ValidationError;

/**
 * Describes a validation error on an instance path
 * @property ValidationErrorItem
 * @see {Errors#ValidationErrorItem}
 */
Sequelize.prototype.ValidationErrorItem = Sequelize.ValidationErrorItem =
  sequelizeErrors.ValidationErrorItem;

/**
 * A base class for all database related errors.
 * @see {Errors#DatabaseError}
 */
Sequelize.prototype.DatabaseError = Sequelize.DatabaseError =
  sequelizeErrors.DatabaseError;

/**
 * Thrown when a database query times out because of a deadlock
 * @see {Errors#TimeoutError}
 */
Sequelize.prototype.TimeoutError = Sequelize.TimeoutError =
  sequelizeErrors.TimeoutError;

/**
 * Thrown when a unique constraint is violated in the database
 * @see {Errors#UniqueConstraintError}
 */
Sequelize.prototype.UniqueConstraintError = Sequelize.UniqueConstraintError =
  sequelizeErrors.UniqueConstraintError;

/**
 * Thrown when an exclusion constraint is violated in the database
 * @see {Errors#ExclusionConstraintError}
 */
Sequelize.prototype.ExclusionConstraintError = Sequelize.ExclusionConstraintError =
  sequelizeErrors.ExclusionConstraintError;

/**
 * Thrown when a foreign key constraint is violated in the database
 * @see {Errors#ForeignKeyConstraintError}
 */
Sequelize.prototype.ForeignKeyConstraintError = Sequelize.ForeignKeyConstraintError =
  sequelizeErrors.ForeignKeyConstraintError;

/**
 * A base class for all connection related errors.
 * @see {Errors#ConnectionError}
 */
Sequelize.prototype.ConnectionError = Sequelize.ConnectionError =
  sequelizeErrors.ConnectionError;

/**
 * Thrown when a connection to a database is refused
 * @see {Errors#ConnectionRefusedError}
 */
Sequelize.prototype.ConnectionRefusedError = Sequelize.ConnectionRefusedError =
  sequelizeErrors.ConnectionRefusedError;

/**
 * Thrown when a connection to a database is refused due to insufficient access
 * @see {Errors#AccessDeniedError}
 */
Sequelize.prototype.AccessDeniedError = Sequelize.AccessDeniedError =
  sequelizeErrors.AccessDeniedError;

/**
 * Thrown when a connection to a database has a hostname that was not found
 * @see {Errors#HostNotFoundError}
 */
Sequelize.prototype.HostNotFoundError = Sequelize.HostNotFoundError =
  sequelizeErrors.HostNotFoundError;

/**
 * Thrown when a connection to a database has a hostname that was not reachable
 * @see {Errors#HostNotReachableError}
 */
Sequelize.prototype.HostNotReachableError = Sequelize.HostNotReachableError =
  sequelizeErrors.HostNotReachableError;

/**
 * Thrown when a connection to a database has invalid values for any of the connection parameters
 * @see {Errors#InvalidConnectionError}
 */
Sequelize.prototype.InvalidConnectionError = Sequelize.InvalidConnectionError =
  sequelizeErrors.InvalidConnectionError;

/**
 * Thrown when a connection to a database times out
 * @see {Errors#ConnectionTimedOutError}
 */
Sequelize.prototype.ConnectionTimedOutError = Sequelize.ConnectionTimedOutError =
  sequelizeErrors.ConnectionTimedOutError;

/**
 * Thrown when a some problem occurred with Instance methods (see message for details)
 * @see {Errors#InstanceError}
 */
Sequelize.prototype.InstanceError = Sequelize.InstanceError =
  sequelizeErrors.InstanceError;

/**
  * Thrown when a record was not found, Usually used with rejectOnEmpty mode (see message for details)
  * @see {Errors#RecordNotFoundError}
  */
Sequelize.prototype.EmptyResultError = Sequelize.EmptyResultError =
  sequelizeErrors.EmptyResultError;

module.exports = Sequelize;
module.exports.Sequelize = Sequelize;
module.exports.default = Sequelize;
