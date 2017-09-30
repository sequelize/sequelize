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
const Op = require('./operators');

/**
 * This is the main class, the entry point to sequelize. To use it, you just need to import sequelize:
 *
 * ```js
 * const Sequelize = require('sequelize');
 * ```
 *
 * In addition to sequelize, the connection library for the dialect you want to use should also be installed in your project. You don't need to import it however, as sequelize will take care of that.
 */
class Sequelize {

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
   * // with database, username, and password in the options object
   * const sequelize = new Sequelize({ database, username, password });
   *
   * // with uri
   * const sequelize = new Sequelize('mysql://localhost:3306/database', {})
   * ```
   *
   * @param {String}   [database] The name of the database
   * @param {String}   [username=null] The username which is used to authenticate against the database.
   * @param {String}   [password=null] The password which is used to authenticate against the database. Supports SQLCipher encryption for SQLite.
   * @param {Object}   [options={}] An object with options.
   * @param {String}   [options.host='localhost'] The host of the relational database.
   * @param {Integer}  [options.port=] The port of the relational database.
   * @param {String}   [options.username=null] The username which is used to authenticate against the database.
   * @param {String}   [options.password=null] The password which is used to authenticate against the database.
   * @param {String}   [options.database=null] The name of the database
   * @param {String}   [options.dialect] The dialect of the database you are connecting to. One of mysql, postgres, sqlite and mssql.
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
   * @param {Object}   [options.pool] sequelize connection pool configuration
   * @param {Integer}  [options.pool.max=5] Maximum number of connection in pool
   * @param {Integer}  [options.pool.min=0] Minimum number of connection in pool
   * @param {Integer}  [options.pool.idle=10000] The maximum time, in milliseconds, that a connection can be idle before being released. Use with combination of evict for proper working, for more details read https://github.com/coopernurse/node-pool/issues/178#issuecomment-327110870
   * @param {Integer}  [options.pool.acquire=10000] The maximum time, in milliseconds, that pool will try to get connection before throwing error
   * @param {Integer}  [options.pool.evict=10000] The time interval, in milliseconds, for evicting stale connections. Set it to 0 to disable this feature.
   * @param {Boolean}  [options.pool.handleDisconnects=true] Controls if pool should handle connection disconnect automatically without throwing errors
   * @param {Function} [options.pool.validate] A function that validates a connection. Called with client. The default function checks that client is an object, and that its state is not disconnected
   * @param {Boolean}  [options.quoteIdentifiers=true] Set to `false` to make table names and attributes case-insensitive on Postgres and skip double quoting of them.  WARNING: Setting this to false may expose vulnerabilities and is not recommended!
   * @param {String}   [options.transactionType='DEFERRED'] Set the default transaction type. See `Sequelize.Transaction.TYPES` for possible options. Sqlite only.
   * @param {String}   [options.isolationLevel] Set the default transaction isolation level. See `Sequelize.Transaction.ISOLATION_LEVELS` for possible options.
   * @param {Object}   [options.retry] Set of flags that control when a query is automatically retried.
   * @param {Array}    [options.retry.match] Only retry a query if the error matches one of these strings.
   * @param {Integer}  [options.retry.max] How many times a failing query is automatically retried.  Set to 0 to disable retrying on SQL_BUSY error.
   * @param {Boolean}  [options.typeValidation=false] Run built in type validators on insert and update, e.g. validate that arguments passed to integer fields are integer-like.
   * @param {Object|Boolean} [options.operatorsAliases=true] String based operator alias, default value is true which will enable all operators alias. Pass object to limit set of aliased operators or false to disable completely.
   *
   */
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

      options.dialect = urlParts.protocol.replace(/:$/, '');
      options.host = urlParts.hostname;

      if (options.dialect === 'sqlite' && urlParts.pathname && urlParts.pathname.indexOf('/:memory') !== 0) {
        const path = Path.join(options.host, urlParts.pathname);
        options.storage = options.storage || path;
      }

      if (urlParts.pathname) {
        config.database = urlParts.pathname.replace(/^\//, '');
      }

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

    this.options = _.extend({
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
      benchmark: false,
      operatorsAliases: true
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
    switch (this.getDialect()) {
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
    if (this.options.operatorsAliases === true) {
      Utils.deprecate('String based operators are now deprecated. Please use Symbol based operators for better security, read more at http://docs.sequelizejs.com/manual/tutorial/querying.html#operators');
      this.dialect.QueryGenerator.setOperatorsAliases(Op.LegacyAliases); //Op.LegacyAliases should be removed and replaced by Op.Aliases by v5.0 use
    } else {
      this.dialect.QueryGenerator.setOperatorsAliases(this.options.operatorsAliases);
    }

    this.queryInterface = new QueryInterface(this);

    /**
     * Models are stored here under the name given to `sequelize.define`
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
   * @memberOf Sequelize
   * @return {QueryInterface} An instance (singleton) of QueryInterface.
   */
  getQueryInterface() {
    this.queryInterface = this.queryInterface || new QueryInterface(this);
    return this.queryInterface;
  }

  /**
   * Define a new model, representing a table in the DB.
   *
   * The table columns are defined by the object that is given as the second argument. Each key of the object represents a column
   *
   * @param {String} modelName The name of the model. The model will be stored in `sequelize.models` under this name
   * @param {Object} attributes An object, where each attribute is a column of the table. See {@link Model.init}
   * @param {Object} [options] These options are merged with the default define options provided to the Sequelize constructor and passed to Model.init()
   *
   * @see {@link Model.init} for a more comprehensive specification of the `options` and `attributes` objects.
   * @see <a href="../manual/tutorial/models-definition.html">The manual section about defining models</a>
   * @see {@link DataTypes} For a list of possible data types
   *
   * @return {Model}
   *
   * @example
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
   */
  define(modelName, attributes, options) {
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
    if (Path.normalize(path) !== Path.resolve(path)) {
      // make path relative to the caller
      const callerFilename = Utils.stack()[1].getFileName();
      const callerPath = Path.dirname(callerFilename);

      path = Path.resolve(callerPath, path);
    }

    if (!this.importCache[path]) {
      let defineCall = arguments.length > 1 ? arguments[1] : require(path);
      if (typeof defineCall === 'object') {
        // ES6 module compatibility
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
   * @param {QueryTypes}      [options.type='RAW'] The type of query you are executing. The query type affects how results are formatted before they are passed back. The type is a string, but `Sequelize.QueryTypes` is provided as convenience shortcuts.
   * @param {Boolean}         [options.nest=false] If true, transforms objects with `.` separated property names into nested objects using [dottie.js](https://github.com/mickhansen/dottie.js). For example { 'user.username': 'john' } becomes { user: { username: 'john' }}. When `nest` is true, the query type is assumed to be `'SELECT'`, unless otherwise specified
   * @param {Boolean}         [options.plain=false] Sets the query type to `SELECT` and return a single row
   * @param {Object|Array}    [options.replacements] Either an object of named parameter replacements in the format `:param` or an array of unnamed replacements to replace `?` in your SQL.
   * @param {Object|Array}    [options.bind] Either an object of named bind parameter in the format `_param` or an array of unnamed bind parameter to replace `$1, $2, ...` in your SQL.
   * @param {Boolean}         [options.useMaster=false] Force the query to use the write pool, regardless of the query type.
   * @param {Function}        [options.logging=false] A function that gets executed while running the query to log the sql.
   * @param {new Model()}       [options.instance] A sequelize instance used to build the return instance
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
   * @see {@link Model.build} for more information about instance option.
   */

  query(sql, options) {
    let bindParameters;

    return Promise.try(() => {
      options = _.assign({}, this.options.query, options);

      if (options.instance && !options.model) {
        options.model = options.instance.constructor;
      }

      // map raw fields to model attributes
      if (options.mapToModel) {
        options.fieldMap = _.get(options, 'model.fieldAttributeMap', {});
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
        } else {
          sql = Utils.formatNamedParameters(sql, options.replacements, this.options.dialect);
        }
      }

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
      return options.transaction ? options.transaction.connection : this.connectionManager.getConnection(options);
    }).then(connection => {
      const query = new this.dialect.Query(connection, this, options);
      const retryOptions = _.extend(this.options.retry, options.retry || {});

      return retry(() => query.run(sql, bindParameters), retryOptions)
        .finally(() => {
          if (!options.transaction) {
            return this.connectionManager.releaseConnection(connection);
          }
        });
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
   * @memberof Sequelize
   * @return {Promise}
   */
  set(variables, options) {

    // Prepare options
    options = _.extend({}, this.options.set, typeof options === 'object' && options || {});

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
      _.map(variables, (v, k) => '@'+k +' := '+ (typeof v === 'string' ? '"'+v+'"' : v)).join(', ');

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
   * Note, that this is a schema in the [postgres sense of the word](http://www.postgresql.org/docs/9.1/static/ddl-schemas.html),
   * not a database table. In mysql and sqlite, this command will do nothing.
   *
   * @see {@link Model.schema}
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
   * Note, that this is a schema in the [postgres sense of the word](http://www.postgresql.org/docs/9.1/static/ddl-schemas.html),
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
   * Note, that this is a schema in the [postgres sense of the word](http://www.postgresql.org/docs/9.1/static/ddl-schemas.html),
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
   * @param {Boolean} [options.force=false] If force is true, each Model will run `DROP TABLE IF EXISTS`, before it tries to create its own table
   * @param {RegExp} [options.match] Match a regex against the database name before syncing, a safety check for cases where force: true is used in tests but not live code
   * @param {Boolean|function} [options.logging=console.log] A function that logs sql queries, or false for no logging
   * @param {String} [options.schema='public'] The schema that the tables should be created in. This can be overriden for each table in sequelize.define
   * @param {String} [options.searchPath=DEFAULT] An optional parameter to specify the schema search_path (Postgres only)
   * @param {Boolean} [options.hooks=true] If hooks is true then beforeSync, afterSync, beforeBulkSync, afterBulkSync hooks will be called
   * @param {Boolean} [options.alter=false] Alters tables to fit models. Not recommended for production use. Deletes data in columns that were removed or had their type changed in the model.
   * @return {Promise}
   */
  sync(options) {

    options = _.clone(options) || {};
    options.hooks = options.hooks === undefined ? true : !!options.hooks;
    options = _.defaults(options, this.options.sync, this.options);

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
   * @see {@link Model.truncate} for more information
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
   * @see {@link Model.drop} for options
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
   * @error 'Invalid credentials' if the authentication failed (even if the database did not respond at all...)
   * @return {Promise}
   */
  authenticate(options) {
    return this.query('SELECT 1+1 AS result', _.assign({ raw: true, plain: true }, options)).return();
  }

  databaseVersion(options) {
    return this.getQueryInterface().databaseVersion(options);
  }

  /**
   * Creates an object representing a database function. This can be used in search queries, both in where and order parts, and as default values in column definitions.
   * If you want to refer to columns in your function, you should use `sequelize.col`, so that the columns are properly interpreted as columns and not a strings.
   *
   * Convert a user's username to upper case
   * ```js
   * instance.updateAttributes({
   *   username: self.sequelize.fn('upper', self.sequelize.col('username'))
   * })
   * ```
   *
   * @see {@link Model.findAll}
   * @see {@link Sequelize.define}
   * @see {@link Sequelize.col}
   * @method fn
   *
   * @param {String} fn The function you want to call
   * @param {any} args All further arguments will be passed as arguments to the function
   *
   * @since v2.0.0-dev3
   * @memberof Sequelize
   * @return {Sequelize.fn}
   * @example <caption>Convert a user's username to upper case</caption>
   * instance.updateAttributes({
   *   username: self.sequelize.fn('upper', self.sequelize.col('username'))
   * })
   */
  static fn(fn) {
    return new Utils.Fn(fn, Utils.sliceArgs(arguments, 1));
  }

  /**
   * Creates an object which represents a column in the DB, this allows referencing another column in your query. This is often useful in conjunction with `sequelize.fn`, since raw string arguments to fn will be escaped.
   * @see {@link Sequelize#fn}
   *
   * @method col
   * @param {String} col The name of the column
   * @since v2.0.0-dev3
   * @memberof Sequelize
   * @return {Sequelize.col}
   */
  static col(col) {
    return new Utils.Col(col);
  }

  /**
   * Creates an object representing a call to the cast function.
   *
   * @method cast
   * @param {any} val The value to cast
   * @param {String} type The type to cast it to
   * @since v2.0.0-dev3
   * @memberof Sequelize
   * @return {Sequelize.cast}
   */
  static cast(val, type) {
    return new Utils.Cast(val, type);
  }

  /**
   * Creates an object representing a literal, i.e. something that will not be escaped.
   *
   * @method literal
   * @param {any} val
   * @alias asIs
   * @since v2.0.0-dev3
   * @memberof Sequelize
   * @return {Sequelize.literal}
   */
  static literal(val) {
    return new Utils.Literal(val);
  }

  /**
   * An AND query
   * @see {@link Model.findAll}
   *
   * @method and
   * @param {String|Object} args Each argument will be joined by AND
   * @since v2.0.0-dev3
   * @memberof Sequelize
   * @return {Sequelize.and}
   */
  static and() {
    return { [Op.and]: Utils.sliceArgs(arguments) };
  }

  /**
   * An OR query
   * @see {@link Model.findAll}
   *
   * @method or
   * @param {String|Object} args Each argument will be joined by OR
   * @since v2.0.0-dev3
   * @memberof Sequelize
   * @return {Sequelize.or}
   */
  static or() {
    return { [Op.or]: Utils.sliceArgs(arguments) };
  }

  /**
   * Creates an object representing nested where conditions for postgres's json data-type.
   * @see {@link Model.findAll}
   *
   * @method json
   * @param {String|Object} conditions A hash containing strings/numbers or other nested hash, a string using dot notation or a string using postgres json syntax.
   * @param {String|Number|Boolean} [value] An optional value to compare against. Produces a string of the form "<json path> = '<value>'".
   * @memberof Sequelize
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
   * @see {@link Model.findAll}
   *
   * @param {Object} attr The attribute, which can be either an attribute object from `Model.rawAttributes` or a sequelize object, for example an instance of `sequelize.fn`. For simple string attributes, use the POJO syntax
   * @param {string} [comparator='=']
   * @param {String|Object} logic The condition. Can be both a simply type, or a further condition (`or`, `and`, `.literal` etc.)
   * @alias condition
   * @since v2.0.0-dev3
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
   * @see {@link Transaction}
   * @param {Object}   [options={}]
   * @param {Boolean}  [options.autocommit]
   * @param {String}   [options.type='DEFERRED'] See `Sequelize.Transaction.TYPES` for possible options. Sqlite only.
   * @param {String}   [options.isolationLevel] See `Sequelize.Transaction.ISOLATION_LEVELS` for possible options
   * @param {Function} [options.logging=false] A function that gets executed while running the query to log the sql.
   * @param {Function} [autoCallback] The callback is called with the transaction object, and should return a promise. If the promise is resolved, the transaction commits; if the promise rejects, the transaction rolls back
   * @return {Promise}
   */
  transaction(options, autoCallback) {
    if (typeof options === 'function') {
      autoCallback = options;
      options = undefined;
    }

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
            if (!transaction.finished) return transaction.rollback().catch(() => {});
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
    const ns = Sequelize._cls;
    if (!ns) return fn();

    let res;
    ns.run(context => res = fn(context));
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
    const last = _.last(args);

    if (last && _.isPlainObject(last) && last.hasOwnProperty('logging')) {
      options = last;

      // remove options from set of logged arguments if options.logging is equal to console.log
      if (options.logging === console.log) {
        args.splice(args.length-1, 1);
      }
    } else {
      options = this.options;
    }

    if (options.logging) {
      if (options.logging === true) {
        Utils.deprecate('The logging-option should be either a function or false. Default: console.log');
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
   *
   * @return {Promise}
   */
  close() {
    return this.connectionManager.close();
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
    if (!_.isPlainObject(attribute)) {
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
 */
Sequelize.version = require('../package.json').version;

Sequelize.options = {hooks: {}};

/**
 * A reference to Sequelize constructor from sequelize. Useful for accessing DataTypes, Errors etc.
 * @see {@link Sequelize}
 */
Sequelize.prototype.Sequelize = Sequelize;

/**
 * @private
 */
Sequelize.prototype.Utils = Sequelize.Utils = Utils;

/**
 * A handy reference to the bluebird Promise class
 */
Sequelize.prototype.Promise = Sequelize.Promise = Promise;

/**
 * Available query types for use with `sequelize.query`
 * @see {@link QueryTypes}
 */
Sequelize.prototype.QueryTypes = Sequelize.QueryTypes = QueryTypes;


/**
 * Operators symbols to be used for querying data
 * @see  {@link Operators}
 */
Sequelize.prototype.Op = Sequelize.Op = Op;

/**
 * Exposes the validator.js object, so you can extend it with custom validation functions. The validator is exposed both on the instance, and on the constructor.
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
 * @see {@link Transaction}
 * @see {@link Sequelize.transaction}
 */
Sequelize.prototype.Transaction = Sequelize.Transaction = Transaction;

/**
 * A reference to the deferrable collection. Use this to access the different deferrable options.
 * @see {@link Transaction.Deferrable}
 * @see {@link Sequelize#transaction}
 */
Sequelize.prototype.Deferrable = Sequelize.Deferrable = Deferrable;

/**
 * A reference to the sequelize association class.
 * @see {@link Association}
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
 * Expose various errors available
 */
for (const error of Object.keys(sequelizeErrors)) {
  if (sequelizeErrors[error] === sequelizeErrors.BaseError) {
    Sequelize.prototype.Error = Sequelize.Error = sequelizeErrors.BaseError;
  } else {
    Sequelize.prototype[error] = Sequelize[error] = sequelizeErrors[error];
  }
}

module.exports = Sequelize;
module.exports.Sequelize = Sequelize;
module.exports.default = Sequelize;
