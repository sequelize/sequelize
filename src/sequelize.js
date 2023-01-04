'use strict';

import isPlainObject from 'lodash/isPlainObject';
import retry from 'retry-as-promised';
import { normalizeDataType } from './dialects/abstract/data-types-utils';
import { SequelizeTypeScript } from './sequelize-typescript';
import { withSqliteForeignKeysOff } from './dialects/sqlite/sqlite-utils';
import { isString } from './utils/check.js';
import { noSequelizeDataType } from './utils/deprecations';
import { isModelStatic, isSameInitialModel } from './utils/model-utils';
import { Cast, Col, Fn, Json, Literal, Where } from './utils/sequelize-method';
import { injectReplacements, mapBindParameters } from './utils/sql';
import { useInflection } from './utils/string';
import { parseConnectionString } from './utils/url';
import { importModels } from './import-models.js';

const _ = require('lodash');
const { Model } = require('./model');
const DataTypes = require('./data-types');
const { Deferrable } = require('./deferrable');
const { ModelManager } = require('./model-manager');
const { Transaction, TRANSACTION_TYPES } = require('./transaction');
const { QueryTypes } = require('./query-types');
const { TableHints } = require('./table-hints');
const { IndexHints } = require('./index-hints');
const sequelizeErrors = require('./errors');
const { Association } = require('./associations/index');
const Validator = require('./utils/validator-extras').validator;
const { Op } = require('./operators');
const deprecations = require('./utils/deprecations');
const { AbstractQueryInterface } = require('./dialects/abstract/query-interface');
const { BelongsTo } = require('./associations/belongs-to');
const { HasOne } = require('./associations/has-one');
const { BelongsToMany } = require('./associations/belongs-to-many');
const { HasMany } = require('./associations/has-many');
require('./utils/dayjs');

/**
 * This is the main class, the entry point to sequelize.
 */
export class Sequelize extends SequelizeTypeScript {
  /**
   * Instantiate sequelize with name of database, username and password.
   *
   * @example
   * // without password / with blank password
   * const sequelize = new Sequelize('database', 'username', null, {
   *   dialect: 'mysql'
   * })
   *
   * // with password and options
   * const sequelize = new Sequelize('my_database', 'john', 'doe', {
   *   dialect: 'postgres'
   * })
   *
   * // with database, username, and password in the options object
   * const sequelize = new Sequelize({ database, username, password, dialect: 'mssql' });
   *
   * // with uri
   * const sequelize = new Sequelize('mysql://localhost:3306/database', {})
   *
   * // option examples
   * const sequelize = new Sequelize('database', 'username', 'password', {
   *   // the sql dialect of the database
   *   // currently supported: 'mysql', 'sqlite', 'postgres', 'mssql'
   *   dialect: 'mysql',
   *
   *   // custom host; default: localhost
   *   host: 'my.server.tld',
   *   // for postgres, you can also specify an absolute path to a directory
   *   // containing a UNIX socket to connect over
   *   // host: '/sockets/psql_sockets'.
   *
   *   // custom port; default: dialect default
   *   port: 12345,
   *
   *   // custom protocol; default: 'tcp'
   *   // postgres only, useful for Heroku
   *   protocol: null,
   *
   *   // disable logging or provide a custom logging function; default: console.log
   *   logging: false,
   *
   *   // you can also pass any dialect options to the underlying dialect library
   *   // - default is empty
   *   // - currently supported: 'mysql', 'postgres', 'mssql'
   *   dialectOptions: {
   *     socketPath: '/Applications/MAMP/tmp/mysql/mysql.sock',
   *     supportBigNumbers: true,
   *     bigNumberStrings: true
   *   },
   *
   *   // the storage engine for sqlite
   *   // - default ':memory:'
   *   storage: 'path/to/database.sqlite',
   *
   *   // disable inserting undefined values as NULL
   *   // - default: false
   *   omitNull: true,
   *
   *   // a flag for using a native library or not.
   *   // in the case of 'pg' -- set this to true will allow SSL support
   *   // - default: false
   *   native: true,
   *
   *   // A flag that defines if connection should be over ssl or not
   *   // - default: undefined
   *   ssl: true,
   *
   *   // Specify options, which are used when sequelize.define is called.
   *   // The following example:
   *   //   define: { timestamps: false }
   *   // is basically the same as:
   *   //   Model.init(attributes, { timestamps: false });
   *   //   sequelize.define(name, attributes, { timestamps: false });
   *   // so defining the timestamps for each model will be not necessary
   *   define: {
   *     underscored: false,
   *     freezeTableName: false,
   *     charset: 'utf8',
   *     dialectOptions: {
   *       collate: 'utf8_general_ci'
   *     },
   *     timestamps: true
   *   },
   *
   *   // similar for sync: you can define this to always force sync for models
   *   sync: { force: true },
   *
   *   // pool configuration used to pool database connections
   *   pool: {
   *     max: 5,
   *     idle: 30000,
   *     acquire: 60000,
   *   },
   *
   *   // isolation level of each transaction
   *   // defaults to dialect default
   *   isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ
   * })
   *
   * @param {string}   [database] The name of the database
   * @param {string}   [username=null] The username which is used to authenticate against the database.
   * @param {string}   [password=null] The password which is used to authenticate against the database. Supports SQLCipher encryption for SQLite.
   * @param {object}   [options={}] An object with options.
   * @param {string}   [options.host='localhost'] The host of the relational database.
   * @param {number}   [options.port] The port of the relational database.
   * @param {string}   [options.username=null] The username which is used to authenticate against the database.
   * @param {string}   [options.password=null] The password which is used to authenticate against the database.
   * @param {string}   [options.database=null] The name of the database.
   * @param {string}   [options.dialect] The dialect of the database you are connecting to. One of mysql, postgres, sqlite, db2, mariadb and mssql.
   * @param {string}   [options.dialectModule=null] If specified, use this dialect library. For example, if you want to use pg.js instead of pg when connecting to a pg database, you should specify 'require("pg.js")' here
   * @param {string}   [options.dialectModulePath=null] If specified, load the dialect library from this path. For example, if you want to use pg.js instead of pg when connecting to a pg database, you should specify '/path/to/pg.js' here
   * @param {object}   [options.dialectOptions] An object of additional options, which are passed directly to the connection library
   * @param {string}   [options.storage] Only used by sqlite. Defaults to ':memory:'
   * @param {string}   [options.protocol='tcp'] The protocol of the relational database.
   * @param {object}   [options.define={}] Default options for model definitions. See {@link Model.init}.
   * @param {object}   [options.query={}] Default options for sequelize.query
   * @param {string}   [options.schema=null] A schema to use
   * @param {object}   [options.set={}] Default options for sequelize.set
   * @param {object}   [options.sync={}] Default options for sequelize.sync
   * @param {string}   [options.timezone='+00:00'] The timezone used when converting a date from the database into a JavaScript date. The timezone is also used to SET TIMEZONE when connecting to the server, to ensure that the result of NOW, CURRENT_TIMESTAMP and other time related functions have in the right timezone. For best cross platform performance use the format +/-HH:MM. Will also accept string versions of timezones supported by Intl.Locale (e.g. 'America/Los_Angeles'); this is useful to capture daylight savings time changes.
   * @param {boolean}  [options.keepDefaultTimezone=false] A flag that defines if the default timezone is used to convert dates from the database.
   * @param {string|boolean} [options.clientMinMessages='warning'] (Deprecated) The PostgreSQL `client_min_messages` session parameter. Set to `false` to not override the database's default.
   * @param {boolean}  [options.standardConformingStrings=true] The PostgreSQL `standard_conforming_strings` session parameter. Set to `false` to not set the option. WARNING: Setting this to false may expose vulnerabilities and is not recommended!
   * @param {Function} [options.logging=console.log] A function that gets executed every time Sequelize would log something. Function may receive multiple parameters but only first one is printed by `console.log`. To print all values use `(...msg) => console.log(msg)`
   * @param {boolean}  [options.benchmark=false] Pass query execution time in milliseconds as second argument to logging function (options.logging).
   * @param {string}   [options.queryLabel] A label to annotate queries in log output.
   * @param {boolean}  [options.omitNull=false] A flag that defines if null values should be passed as values to CREATE/UPDATE SQL queries or not.
   * @param {boolean}  [options.native=false] A flag that defines if native library shall be used or not. Currently only has an effect for postgres
   * @param {boolean}  [options.ssl=undefined] A flag that defines if connection should be over ssl or not
   * @param {boolean}  [options.replication=false] Use read / write replication. To enable replication, pass an object, with two properties, read and write. Write should be an object (a single server for handling writes), and read an array of object (several servers to handle reads). Each read/write server can have the following properties: `host`, `port`, `username`, `password`, `database`.  Connection strings can be used instead of objects.
   * @param {object}   [options.pool] sequelize connection pool configuration
   * @param {number}   [options.pool.max=5] Maximum number of connection in pool
   * @param {number}   [options.pool.min=0] Minimum number of connection in pool
   * @param {number}   [options.pool.idle=10000] The maximum time, in milliseconds, that a connection can be idle before being released.
   * @param {number}   [options.pool.acquire=60000] The maximum time, in milliseconds, that pool will try to get connection before throwing error
   * @param {number}   [options.pool.evict=1000] The time interval, in milliseconds, after which sequelize-pool will remove idle connections.
   * @param {Function} [options.pool.validate] A function that validates a connection. Called with client. The default function checks that client is an object, and that its state is not disconnected
   * @param {number}   [options.pool.maxUses=Infinity] The number of times a connection can be used before discarding it for a replacement, [`used for eventual cluster rebalancing`](https://github.com/sequelize/sequelize-pool).
   * @param {boolean}  [options.quoteIdentifiers=true] Set to `false` to make table names and attributes case-insensitive on Postgres and skip double quoting of them.  WARNING: Setting this to false may expose vulnerabilities and is not recommended!
   * @param {string}   [options.transactionType='DEFERRED'] Set the default transaction type. See `Sequelize.Transaction.TYPES` for possible options. Sqlite only.
   * @param {string}   [options.isolationLevel] Set the default transaction isolation level. See `Sequelize.Transaction.ISOLATION_LEVELS` for possible options.
   * @param {object}   [options.retry] Set of flags that control when a query is automatically retried. Accepts all options for [`retry-as-promised`](https://github.com/mickhansen/retry-as-promised).
   * @param {Array}    [options.retry.match] Only retry a query if the error matches one of these strings.
   * @param {number}   [options.retry.max] How many times a failing query is automatically retried.  Set to 0 to disable retrying on SQL_BUSY error.
   * @param {number}   [options.retry.timeout] Maximum duration, in milliseconds, to retry until an error is thrown.
   * @param {number}   [options.retry.backoffBase=100] Initial backoff duration, in milliseconds.
   * @param {number}   [options.retry.backoffExponent=1.1] Exponent to increase backoff duration after each retry.
   * @param {Function} [options.retry.report] Function that is executed after each retry, called with a message and the current retry options.
   * @param {string}   [options.retry.name='unknown'] Name used when composing error/reporting messages.
   * @param {boolean}  [options.noTypeValidation=false] Run built-in type validators on insert and update, and select with where clause, e.g. validate that arguments passed to integer fields are integer-like.
   * @param {object}   [options.operatorsAliases] String based operator alias. Pass object to limit set of aliased operators.
   * @param {object}   [options.hooks] An object of global hook functions that are called before and after certain lifecycle events. Global hooks will run after any model-specific hooks defined for the same event (See `Sequelize.Model.init()` for a list).  Additionally, `beforeConnect()`, `afterConnect()`, `beforeDisconnect()`, and `afterDisconnect()` hooks may be defined here.
   * @param {boolean}  [options.minifyAliases=false] A flag that defines if aliases should be minified (mostly useful to avoid Postgres alias character limit of 64)
   * @param {boolean}  [options.logQueryParameters=false] A flag that defines if show bind parameters in log.
   */
  constructor(database, username, password, options) {
    super();

    if (arguments.length === 1 && _.isPlainObject(database)) {
      // new Sequelize({ ... options })
      options = database;
    } else if (arguments.length === 1 && typeof database === 'string' || arguments.length === 2 && _.isPlainObject(username)) {
      // new Sequelize(URI, { ... options })
      options = username ? { ...username } : Object.create(null);

      _.defaultsDeep(options, parseConnectionString(arguments[0]));
    } else {
      // new Sequelize(database, username, password, { ... options })
      options = options ? { ...options } : Object.create(null);

      _.defaults(options, {
        database,
        username,
        password,
      });
    }

    Sequelize.hooks.runSync('beforeInit', options);

    // @ts-expect-error -- doesn't exist
    if (options.pool === false) {
      throw new Error('Support for pool:false was removed in v4.0');
    }

    this.options = {
      dialect: null,
      dialectModule: null,
      dialectModulePath: null,
      dialectOptions: Object.create(null),
      host: 'localhost',
      protocol: 'tcp',
      define: {},
      query: {},
      sync: {},
      timezone: '+00:00',
      keepDefaultTimezone: false,
      standardConformingStrings: true,
      logging: console.debug,
      omitNull: false,
      native: false,
      replication: false,
      ssl: undefined,
      // TODO [=7]: print a deprecation warning if quoteIdentifiers is set to false
      quoteIdentifiers: true,
      hooks: {},
      retry: {
        max: 5,
        match: [
          'SQLITE_BUSY: database is locked',
        ],
      },
      transactionType: TRANSACTION_TYPES.DEFERRED,
      isolationLevel: null,
      databaseVersion: null,
      noTypeValidation: false,
      benchmark: false,
      minifyAliases: false,
      logQueryParameters: false,
      disableClsTransactions: false,
      ...options,
      pool: _.defaults(options.pool || {}, {
        max: 5,
        min: 0,
        idle: 10_000,
        acquire: 60_000,
        evict: 1000,
      }),
    };

    // TODO: remove & assign property directly once this constructor has been migrated to the SequelizeTypeScript class
    if (!this.options.disableClsTransactions) {
      this._setupTransactionCls();
    }

    if (!this.options.dialect) {
      throw new Error('Dialect needs to be explicitly supplied as of v4.0.0');
    }

    if (this.options.dialect === 'postgresql') {
      this.options.dialect = 'postgres';
    }

    //     if (this.options.define.hooks) {
    //       throw new Error(`The "define" Sequelize option cannot be used to add hooks to all models. Please remove the "hooks" property from the "define" option you passed to the Sequelize constructor.
    // Instead of using this option, you can listen to the same event on all models by adding the listener to the Sequelize instance itself, since all model hooks are forwarded to the Sequelize instance.`);
    //     }

    if (this.options.logging === true) {
      deprecations.noTrueLogging();
      this.options.logging = console.debug;
    }

    if (options.hooks) {
      this.hooks.addListeners(options.hooks);
    }

    // ==========================================
    //  REPLICATION CONFIG NORMALIZATION
    // ==========================================

    let Dialect;
    // Requiring the dialect in a switch-case to keep the
    // require calls static. (Browserify fix)
    switch (this.getDialect()) {
      case 'mariadb':
        Dialect = require('./dialects/mariadb').MariaDbDialect;
        break;
      case 'mssql':
        Dialect = require('./dialects/mssql').MssqlDialect;
        break;
      case 'mysql':
        Dialect = require('./dialects/mysql').MysqlDialect;
        break;
      case 'postgres':
        Dialect = require('./dialects/postgres').PostgresDialect;
        break;
      case 'sqlite':
        Dialect = require('./dialects/sqlite').SqliteDialect;
        break;
      case 'ibmi':
        Dialect = require('./dialects/ibmi').IBMiDialect;
        break;
      case 'db2':
        Dialect = require('./dialects/db2').Db2Dialect;
        break;
      case 'snowflake':
        Dialect = require('./dialects/snowflake').SnowflakeDialect;
        break;
      default:
        throw new Error(`The dialect ${this.getDialect()} is not supported. Supported dialects: mariadb, mssql, mysql, postgres, sqlite, ibmi, db2 and snowflake.`);
    }

    if (!this.options.port) {
      this.options.port = Dialect.getDefaultPort();
    } else {
      this.options.port = Number(this.options.port);
    }

    const connectionConfig = {
      database: this.options.database,
      username: this.options.username,
      password: this.options.password || null,
      host: this.options.host,
      port: this.options.port,
      protocol: this.options.protocol,
      ssl: this.options.ssl,
      dialectOptions: this.options.dialectOptions,
    };

    if (!this.options.replication) {
      this.options.replication = Object.create(null);
    }

    // Convert replication connection strings to objects
    if (isString(this.options.replication.write)) {
      this.options.replication.write = parseConnectionString(this.options.replication.write);
    }

    // Map main connection config
    this.options.replication.write = _.defaults(this.options.replication.write ?? {}, connectionConfig);
    this.options.replication.write.port = Number(this.options.replication.write.port);

    if (!this.options.replication.read) {
      this.options.replication.read = [];
    } else if (!Array.isArray(this.options.replication.read)) {
      this.options.replication.read = [this.options.replication.read];
    }

    this.options.replication.read = this.options.replication.read.map(readEntry => {
      if (isString(readEntry)) {
        readEntry = parseConnectionString(readEntry);
      }

      readEntry.port = Number(readEntry.port);

      // Apply defaults to each read config
      return _.defaults(readEntry, connectionConfig);
    });

    // ==========================================
    //  CONFIG
    // ==========================================

    this.config = {
      ...connectionConfig,
      pool: this.options.pool,
      native: this.options.native,
      replication: this.options.replication,
      dialectModule: this.options.dialectModule,
      dialectModulePath: this.options.dialectModulePath,
      keepDefaultTimezone: this.options.keepDefaultTimezone,
    };

    this.dialect = new Dialect(this);
    if ('typeValidation' in options) {
      throw new Error('The typeValidation has been renamed to noTypeValidation, and is false by default');
    }

    if (!this.dialect.supports.globalTimeZoneConfig && this.options.timezone !== '+00:00') {
      throw new Error(`Setting a custom timezone is not supported by ${this.dialect.name}, dates are always returned as UTC. Please remove the custom timezone option.`);
    }

    this.dialect.queryGenerator.noTypeValidation = options.noTypeValidation;

    if (_.isPlainObject(this.options.operatorsAliases)) {
      deprecations.noStringOperators();
      this.dialect.queryGenerator.setOperatorsAliases(this.options.operatorsAliases);
    } else if (typeof this.options.operatorsAliases === 'boolean') {
      deprecations.noBoolOperatorAliases();
    }

    this.queryInterface = this.dialect.queryInterface;

    /**
     * Models are stored here under the name given to `sequelize.define`
     */
    this.models = {};
    this.modelManager = new ModelManager(this);
    this.connectionManager = this.dialect.connectionManager;

    if (options.models) {
      this.addModels(options.models);
    }

    Sequelize.hooks.runSync('afterInit', this);
  }

  /**
   * Returns the specified dialect.
   *
   * @returns {string} The specified dialect.
   */
  getDialect() {
    return this.options.dialect;
  }

  /**
   * Returns the database name.
   *
   * @returns {string} The database name.
   */
  getDatabaseName() {
    return this.config.database;
  }

  /**
   * Returns an instance of AbstractQueryInterface.
   *
   * @returns {AbstractQueryInterface} An instance (singleton) of AbstractQueryInterface.
   */
  getQueryInterface() {
    return this.queryInterface;
  }

  /**
   * Define a new model, representing a table in the database.
   *
   * The table columns are defined by the object that is given as the second argument. Each key of the object represents a column
   *
   * @param {string} modelName The name of the model. The model will be stored in `sequelize.models` under this name
   * @param {object} attributes An object, where each attribute is a column of the table. See {@link Model.init}
   * @param {object} [options] These options are merged with the default define options provided to the Sequelize constructor and passed to Model.init()
   *
   * @see
   * {@link Model.init} for a more comprehensive specification of the `options` and `attributes` objects.
   * @see
   * <a href="/master/manual/model-basics.html">Model Basics</a> guide
   *
   * @returns {Model} Newly defined model
   *
   * @example
   * sequelize.define('modelName', {
   *   columnA: {
   *       type: DataTypes.BOOLEAN,
   *       validate: {
   *         is: ["[a-z]",'i'],        // will only allow letters
   *         max: 23,                  // only allow values <= 23
   *         isIn: {
   *           args: [['en', 'zh']],
   *           msg: "Must be English or Chinese"
   *         }
   *       },
   *       field: 'column_a'
   *   },
   *   columnB: DataTypes.STRING,
   *   columnC: 'MY VERY OWN COLUMN TYPE'
   * });
   *
   * sequelize.models.modelName // The model will now be available in models under the name given to define
   */
  define(modelName, attributes = {}, options = {}) {
    options.modelName = modelName;
    options.sequelize = this;

    const model = class extends Model {};

    model.init(attributes, options);

    return model;
  }

  /**
   * Fetch a Model which is already defined
   *
   * @param {string} modelName The name of a model defined with Sequelize.define
   *
   * @throws Will throw an error if the model is not defined (that is, if sequelize#isDefined returns false)
   * @returns {Model} Specified model
   */
  model(modelName) {
    if (!this.isDefined(modelName)) {
      throw new Error(`${modelName} has not been defined`);
    }

    return this.modelManager.getModel(modelName);
  }

  /**
   * Checks whether a model with the given name is defined
   *
   * @param {string} modelName The name of a model defined with Sequelize.define
   *
   * @returns {boolean} Returns true if model is already defined, otherwise false
   */
  isDefined(modelName) {
    return this.modelManager.models.some(model => model.name === modelName);
  }

  /**
   * Execute a query on the DB, optionally bypassing all the Sequelize goodness.
   *
   * By default, the function will return two arguments: an array of results, and a metadata object, containing number of affected rows etc.
   *
   * If you are running a type of query where you don't need the metadata, for example a `SELECT` query, you can pass in a query type to make sequelize format the results:
   *
   * ```js
   * const [results, metadata] = await sequelize.query('SELECT...'); // Raw query - use array destructuring
   *
   * const results = await sequelize.query('SELECT...', { type: sequelize.QueryTypes.SELECT }); // SELECT query - no destructuring
   * ```
   *
   * @param {string}          sql
   * @param {object}          [options={}] Query options.
   * @param {boolean}         [options.raw] If true, sequelize will not try to format the results of the query, or build an instance of a model from the result
   * @param {Transaction}     [options.transaction=null] The transaction that the query should be executed under
   * @param {QueryTypes}      [options.type='RAW'] The type of query you are executing. The query type affects how results are formatted before they are passed back. The type is a string, but `Sequelize.QueryTypes` is provided as convenience shortcuts.
   * @param {boolean}         [options.nest=false] If true, transforms objects with `.` separated property names into nested objects using [dottie.js](https://github.com/mickhansen/dottie.js). For example { 'user.username': 'john' } becomes { user: { username: 'john' }}. When `nest` is true, the query type is assumed to be `'SELECT'`, unless otherwise specified
   * @param {boolean}         [options.plain=false] Sets the query type to `SELECT` and return a single row
   * @param {object|Array}    [options.replacements] Either an object of named parameter replacements in the format `:param` or an array of unnamed replacements to replace `?` in your SQL.
   * @param {object|Array}    [options.bind] Either an object of named bind parameter in the format `_param` or an array of unnamed bind parameter to replace `$1, $2, ...` in your SQL.
   * @param {boolean}         [options.useMaster=false] Force the query to use the write pool, regardless of the query type.
   * @param {Function}        [options.logging=false] A function that gets executed while running the query to log the sql.
   * @param {Model}           [options.instance] A sequelize model instance whose Model is to be used to build the query result
   * @param {ModelStatic<Model>}    [options.model] A sequelize model used to build the returned model instances
   * @param {object}          [options.retry] Set of flags that control when a query is automatically retried. Accepts all options for [`retry-as-promised`](https://github.com/mickhansen/retry-as-promised).
   * @param {Array}           [options.retry.match] Only retry a query if the error matches one of these strings.
   * @param {Integer}         [options.retry.max] How many times a failing query is automatically retried.
   * @param {number}          [options.retry.timeout] Maximum duration, in milliseconds, to retry until an error is thrown.
   * @param {number}          [options.retry.backoffBase=100] Initial backoff duration, in milliseconds.
   * @param {number}          [options.retry.backoffExponent=1.1] Exponent to increase backoff duration after each retry.
   * @param {Function}        [options.retry.report] Function that is executed after each retry, called with a message and the current retry options.
   * @param {string}          [options.retry.name='unknown'] Name used when composing error/reporting messages.
   * @param {string}          [options.searchPath=DEFAULT] An optional parameter to specify the schema search_path (Postgres only)
   * @param {boolean}         [options.supportsSearchPath] If false do not prepend the query with the search_path (Postgres only)
   * @param {boolean}         [options.mapToModel=false] Map returned fields to model's fields if `options.model` or `options.instance` is present. Mapping will occur before building the model instance.
   * @param {object}          [options.fieldMap] Map returned fields to arbitrary names for `SELECT` query type.
   * @param {boolean}         [options.rawErrors=false] Set to `true` to cause errors coming from the underlying connection/database library to be propagated unmodified and unformatted. Else, the default behavior (=false) is to reinterpret errors as sequelize.errors.BaseError objects.
   *
   * @returns {Promise}
   *
   * @see {@link Model.build} for more information about instance option.
   */
  async query(sql, options) {
    options = { ...this.options.query, ...options };

    if (typeof sql === 'object') {
      throw new TypeError('"sql" cannot be an object. Pass a string instead, and pass bind and replacement parameters through the "options" parameter');
    }

    sql = sql.trim();

    if (options.replacements) {
      sql = injectReplacements(sql, this.dialect, options.replacements);
    }

    // queryRaw will throw if 'replacements' is specified, as a way to warn users that they are miusing the method.
    delete options.replacements;

    return this.queryRaw(sql, options);
  }

  async queryRaw(sql, options) {
    if (typeof sql !== 'string') {
      throw new TypeError('Sequelize#rawQuery requires a string as the first parameter.');
    }

    if (options != null && 'replacements' in options) {
      throw new TypeError(`Sequelize#rawQuery does not accept the "replacements" options.
Only bind parameters can be provided, in the dialect-specific syntax.
Use Sequelize#query if you wish to use replacements.`);
    }

    options = { ...this.options.query, ...options, bindParameterOrder: null };

    let bindParameters;
    let bindParameterOrder;
    if (options.bind != null) {
      const isBindArray = Array.isArray(options.bind);
      if (!isPlainObject(options.bind) && !isBindArray) {
        throw new TypeError('options.bind must be either a plain object (for named parameters) or an array (for numeric parameters)');
      }

      const mappedResult = mapBindParameters(sql, this.dialect);

      for (const parameterName of mappedResult.parameterSet) {
        if (isBindArray) {
          if (!/[1-9][0-9]*/.test(parameterName) || options.bind.length < Number(parameterName)) {
            throw new Error(`Query includes bind parameter "$${parameterName}", but no value has been provided for that bind parameter.`);
          }
        } else if (!(parameterName in options.bind)) {
          throw new Error(`Query includes bind parameter "$${parameterName}", but no value has been provided for that bind parameter.`);
        }
      }

      sql = mappedResult.sql;

      // used by dialects that support "INOUT" parameters to map the OUT parameters back the the name the dev used.
      options.bindParameterOrder = mappedResult.bindOrder;
      if (mappedResult.bindOrder == null) {
        bindParameters = options.bind;
      } else {
        bindParameters = mappedResult.bindOrder.map(key => {
          if (isBindArray) {
            return options.bind[key - 1];
          }

          return options.bind[key];
        });
      }
    }

    if (options.instance && !options.model) {
      options.model = options.instance.constructor;
    }

    if (!options.instance && !options.model) {
      options.raw = true;
    }

    // map raw fields to model attributes
    if (options.mapToModel) {
      // TODO: throw if model is not specified
      options.fieldMap = options.model?.fieldAttributeMap;
    }

    options = _.defaults(options, {
      logging: Object.prototype.hasOwnProperty.call(this.options, 'logging') ? this.options.logging : console.debug,
      searchPath: Object.prototype.hasOwnProperty.call(this.options, 'searchPath') ? this.options.searchPath : 'DEFAULT',
    });

    if (!options.type) {
      if (options.model || options.nest || options.plain) {
        options.type = QueryTypes.SELECT;
      } else {
        options.type = QueryTypes.RAW;
      }
    }

    // if dialect doesn't support search_path or dialect option
    // to prepend searchPath is not true delete the searchPath option
    if (
      !this.dialect.supports.searchPath
      || !this.options.dialectOptions
      || !this.options.dialectOptions.prependSearchPath
      || options.supportsSearchPath === false
    ) {
      delete options.searchPath;
    } else if (!options.searchPath) {
      // if user wants to always prepend searchPath (dialectOptions.preprendSearchPath = true)
      // then set to DEFAULT if none is provided
      options.searchPath = 'DEFAULT';
    }

    const checkTransaction = () => {
      if (options.transaction && options.transaction.finished && !options.completesTransaction) {
        const error = new Error(`${options.transaction.finished} has been called on this transaction(${options.transaction.id}), you can no longer use it. (The rejected query is attached as the 'sql' property of this error)`);
        error.sql = sql;
        throw error;
      }
    };

    const retryOptions = { ...this.options.retry, ...options.retry };

    return await retry(async () => {
      if (options.transaction === undefined) {
        options.transaction = this.getCurrentClsTransaction();
      }

      checkTransaction();

      const connection = await (options.transaction ? options.transaction.connection : this.connectionManager.getConnection({
        useMaster: options.useMaster,
        type: options.type === 'SELECT' ? 'read' : 'write',
      }));

      if (this.options.dialect === 'db2' && options.alter && options.alter.drop === false) {
        connection.dropTable = false;
      }

      const query = new this.dialect.Query(connection, this, options);

      try {
        await this.hooks.runAsync('beforeQuery', options, query);
        checkTransaction();

        return await query.run(sql, bindParameters);
      } finally {
        await this.hooks.runAsync('afterQuery', options, query);
        if (!options.transaction) {
          this.connectionManager.releaseConnection(connection);
        }
      }
    }, retryOptions);
  }

  /**
   * Execute a query which would set an environment or user variable. The variables are set per connection, so this function needs a transaction.
   * Only works for MySQL or MariaDB.
   *
   * @param {object}        variables Object with multiple variables.
   * @param {object}        [options] query options.
   * @param {Transaction}   [options.transaction] The transaction that the query should be executed under
   *
   * @memberof Sequelize
   *
   * @returns {Promise}
   */
  async set(variables, options) {

    // Prepare options
    options = { ...this.options.set, ...typeof options === 'object' && options };

    if (!['mysql', 'mariadb'].includes(this.options.dialect)) {
      throw new Error('sequelize.set is only supported for mysql or mariadb');
    }

    if (!options.transaction || !(options.transaction instanceof Transaction)) {
      throw new TypeError('options.transaction is required');
    }

    // Override some options, since this isn't a SELECT
    options.raw = true;
    options.plain = true;
    options.type = 'SET';

    // Generate SQL Query
    const query
      = `SET ${
        _.map(variables, (v, k) => `@${k} := ${typeof v === 'string' ? `"${v}"` : v}`).join(', ')}`;

    return await this.query(query, options);
  }

  /**
   * Escape value.
   *
   * @param {string} value string value to escape
   *
   * @returns {string}
   */
  escape(value) {
    return this.dialect.queryGenerator.escape(value);
  }

  /**
   * Create a new database schema.
   *
   * **Note:** this is a schema in the [postgres sense of the word](http://www.postgresql.org/docs/9.1/static/ddl-schemas.html),
   * not a database table. In mysql and sqlite, this command will do nothing.
   *
   * @see
   * {@link Model.schema}
   *
   * @param {string} schema Name of the schema
   * @param {object} [options={}] CreateSchemaQueryOptions
   * @param {string} [options.collate=null]
   * @param {string} [options.charset=null]
    *
   * @returns {Promise}
   */
  async createSchema(schema, options) {
    return await this.getQueryInterface().createSchema(schema, options);
  }

  /**
   * Show all defined schemas
   *
   * **Note:** this is a schema in the [postgres sense of the word](http://www.postgresql.org/docs/9.1/static/ddl-schemas.html),
   * not a database table. In mysql and sqlite, this will show all tables.
   *
   * @param {object} [options={}] query options
   * @param {boolean|Function} [options.logging] A function that logs sql queries, or false for no logging
   *
   * @returns {Promise}
   */
  async showAllSchemas(options) {
    return await this.getQueryInterface().showAllSchemas(options);
  }

  /**
   * Drop a single schema
   *
   * **Note:** this is a schema in the [postgres sense of the word](http://www.postgresql.org/docs/9.1/static/ddl-schemas.html),
   * not a database table. In mysql and sqlite, this drop a table matching the schema name
   *
   * @param {string} schema Name of the schema
   * @param {object} [options={}] query options
   * @param {boolean|Function} [options.logging] A function that logs sql queries, or false for no logging
   *
   * @returns {Promise}
   */
  async dropSchema(schema, options) {
    return await this.getQueryInterface().dropSchema(schema, options);
  }

  /**
   * Drop all schemas.
   *
   * **Note:** this is a schema in the [postgres sense of the word](http://www.postgresql.org/docs/9.1/static/ddl-schemas.html),
   * not a database table. In mysql and sqlite, this is the equivalent of drop all tables.
   *
   * @param {object} [options={}] query options
   * @param {boolean|Function} [options.logging] A function that logs sql queries, or false for no logging
   *
   * @returns {Promise}
   */
  async dropAllSchemas(options) {
    return await this.getQueryInterface().dropAllSchemas(options);
  }

  /**
   * Sync all defined models to the DB.
   *
   * @param {object} [options={}] sync options
   * @param {boolean} [options.force=false] If force is true, each Model will run `DROP TABLE IF EXISTS`, before it tries to create its own table
   * @param {RegExp} [options.match] Match a regex against the database name before syncing, a safety check for cases where force: true is used in tests but not live code
   * @param {boolean|Function} [options.logging=console.log] A function that logs sql queries, or false for no logging
   * @param {string} [options.schema='public'] The schema that the tables should be created in. This can be overridden for each table in sequelize.define
   * @param {string} [options.searchPath=DEFAULT] An optional parameter to specify the schema search_path (Postgres only)
   * @param {boolean} [options.hooks=true] If hooks is true then beforeSync, afterSync, beforeBulkSync, afterBulkSync hooks will be called
   * @param {boolean|object} [options.alter=false] Alters tables to fit models. Provide an object for additional configuration. Not recommended for production use. If not further configured deletes data in columns that were removed or had their type changed in the model.
   * @param {boolean} [options.alter.drop=true] Prevents any drop statements while altering a table when set to `false`
   *
   * @returns {Promise}
   */
  async sync(options) {
    options = {
      ...this.options,
      ...this.options.sync,
      ...options,
      hooks: options ? options.hooks !== false : true,
    };

    if (options.match && !options.match.test(this.config.database)) {
      throw new Error(`Database "${this.config.database}" does not match sync match parameter "${options.match}"`);
    }

    if (options.hooks) {
      await this.hooks.runAsync('beforeBulkSync', options);
    }

    if (options.force) {
      await this.drop(options);
    }

    // no models defined, just authenticate
    if (this.modelManager.models.length === 0) {
      await this.authenticate(options);
    } else {
      const models = this.modelManager.getModelsTopoSortedByForeignKey();
      if (models == null) {
        return this._syncModelsWithCyclicReferences(options);
      }

      // reverse to start with the one model that does not depend on anything
      models.reverse();

      // Topologically sort by foreign key constraints to give us an appropriate
      // creation order
      for (const model of models) {
        await model.sync(options);
      }
    }

    if (options.hooks) {
      await this.hooks.runAsync('afterBulkSync', options);
    }

    return this;
  }

  /**
   * Used instead of sync() when two models reference each-other, so their foreign keys cannot be created immediately.
   *
   * @param {object} options - sync options
   * @private
   */
  async _syncModelsWithCyclicReferences(options) {
    if (this.dialect.name === 'sqlite') {
      // Optimisation: no need to do this in two passes in SQLite because we can temporarily disable foreign keys
      await withSqliteForeignKeysOff(this, options, async () => {
        for (const model of this.modelManager.models) {
          await model.sync(options);
        }
      });

      return;
    }

    // create all tables, but don't create foreign key constraints
    for (const model of this.modelManager.models) {
      await model.sync({ ...options, withoutForeignKeyConstraints: true });
    }

    // add foreign key constraints
    for (const model of this.modelManager.models) {
      await model.sync({ ...options, force: false, alter: true });
    }
  }

  /**
   * Truncate all tables defined through the sequelize models.
   * This is done by calling `Model.truncate()` on each model.
   *
   * @param {object} [options] The options passed to Model.destroy in addition to truncate
   * @param {boolean|Function} [options.logging] A function that logs sql queries, or false for no logging
   * @returns {Promise}
   *
   * @see
   * {@link Model.truncate} for more information
   */
  async truncate(options) {
    const sortedModels = this.modelManager.getModelsTopoSortedByForeignKey();
    const models = sortedModels || this.modelManager.models;
    const hasCyclicDependencies = sortedModels == null;

    // we have cyclic dependencies, cascade must be enabled.
    if (hasCyclicDependencies && (!options || !options.cascade)) {
      throw new Error('Sequelize#truncate: Some of your models have cyclic references (foreign keys). You need to use the "cascade" option to be able to delete rows from models that have cyclic references.');
    }

    // TODO [>=7]: throw if options.cascade is specified but unsupported in the given dialect.
    if (hasCyclicDependencies && this.dialect.name === 'sqlite') {
      // Workaround: SQLite does not support options.cascade, but we can disable its foreign key constraints while we
      // truncate all tables.
      return withSqliteForeignKeysOff(this, options, async () => {
        await Promise.all(models.map(model => model.truncate(options)));
      });
    }

    if (options && options.cascade) {
      for (const model of models) {
        await model.truncate(options);
      }
    } else {
      await Promise.all(models.map(model => model.truncate(options)));
    }
  }

  /**
   * Drop all tables defined through this sequelize instance.
   * This is done by calling Model.drop on each model.
   *
   * @see
   * {@link Model.drop} for options
   *
   * @param {object} [options] The options passed to each call to Model.drop
   * @param {boolean|Function} [options.logging] A function that logs sql queries, or false for no logging
   *
   * @returns {Promise}
   */
  async drop(options) {
    // if 'cascade' is specified, we don't have to worry about cyclic dependencies.
    if (options && options.cascade) {
      for (const model of this.modelManager.models) {
        await model.drop(options);
      }
    }

    const sortedModels = this.modelManager.getModelsTopoSortedByForeignKey();

    // no cyclic dependency between models, we can delete them in an order that will not cause an error.
    if (sortedModels) {
      for (const model of sortedModels) {
        await model.drop(options);
      }
    }

    if (this.dialect.name === 'sqlite') {
      // Optimisation: no need to do this in two passes in SQLite because we can temporarily disable foreign keys
      await withSqliteForeignKeysOff(this, options, async () => {
        for (const model of this.modelManager.models) {
          await model.drop(options);
        }
      });

      return;
    }

    // has cyclic dependency: we first remove each foreign key, then delete each model.
    for (const model of this.modelManager.models) {
      const tableName = model.getTableName();
      const foreignKeys = await this.queryInterface.getForeignKeyReferencesForTable(tableName, options);

      await Promise.all(foreignKeys.map(foreignKey => {
        return this.queryInterface.removeConstraint(tableName, foreignKey.constraintName, options);
      }));
    }

    for (const model of this.modelManager.models) {
      await model.drop(options);
    }
  }

  /**
   * Test the connection by trying to authenticate. It runs `SELECT 1+1 AS result` query.
   *
   * @param {object} [options={}] query options
   *
   * @returns {Promise}
   */
  async authenticate(options) {
    options = {
      raw: true,
      plain: true,
      type: QueryTypes.SELECT,
      ...options,
    };

    await this.query(`SELECT 1+1 AS result${this.options.dialect === 'ibmi' ? ' FROM SYSIBM.SYSDUMMY1' : ''}`, options);

  }

  /**
   * Fetches the version of the database
   *
   * @param {object} [options] Query options
   *
   * @returns {Promise<string>} current version of the dialect
   */
  async fetchDatabaseVersion(options) {
    return await this.getQueryInterface().databaseVersion(options);
  }

  /**
   * Throws if the database version hasn't been loaded yet. It is automatically loaded the first time Sequelize connects to your database.
   *
   * You can use {@link Sequelize#authenticate} to cause a first connection.
   *
   * @returns {string} current version of the dialect that is internally loaded
   */
  getDatabaseVersion() {
    if (this.options.databaseVersion == null) {
      throw new Error('The current database version is unknown. Please call `sequelize.authenticate()` first to fetch it, or manually configure it through options.');
    }

    return this.options.databaseVersion;
  }

  /**
   * Get the fn for random based on the dialect
   *
   * @returns {Sequelize.fn}
   */
  random() {
    if (['postgres', 'sqlite', 'snowflake'].includes(this.getDialect())) {
      return this.fn('RANDOM');
    }

    return this.fn('RAND');
  }

  static fn = fn;

  static Fn = Fn;

  static col = col;

  static Col = Col;

  static cast = cast;

  static Cast = Cast;

  static literal = literal;

  static Literal = Literal;

  static json = json;

  static Json = Json;

  static where = where;

  static Where = Where;

  static and = and;

  static or = or;

  static isModelStatic = isModelStatic;

  static isSameInitialModel = isSameInitialModel;

  static importModels = importModels;

  log(...args) {
    let options;

    const last = _.last(args);

    if (last && _.isPlainObject(last) && Object.prototype.hasOwnProperty.call(last, 'logging')) {
      options = last;

      // remove options from set of logged arguments if options.logging is equal to console.log or console.debug
      // eslint-disable-next-line no-console -- intended console.log use
      if (options.logging === console.log || options.logging === console.debug) {
        args.splice(-1, 1);
      }
    } else {
      options = this.options;
    }

    if (options.logging) {
      if (options.logging === true) {
        deprecations.noTrueLogging();
        options.logging = console.debug;
      }

      // second argument is sql-timings, when benchmarking option enabled
      if ((this.options.benchmark || options.benchmark) && options.logging === console.debug) {
        args = [`${args[0]} Elapsed time: ${args[1]}ms`];
      }

      options.logging(...args);
    }
  }

  /**
   * Close all connections used by this sequelize instance, and free all references so the instance can be garbage collected.
   *
   * Normally this is done on process exit, so you only need to call this method if you are creating multiple instances, and want
   * to garbage collect some of them.
   *
   * @returns {Promise}
   */
  close() {
    return this.connectionManager.close();
  }

  normalizeDataType(Type) {
    return normalizeDataType(Type, this.dialect);
  }

  normalizeAttribute(attribute) {
    if (!_.isPlainObject(attribute)) {
      attribute = { type: attribute };
    } else {
      attribute = { ...attribute };
    }

    if (attribute.values) {
      throw new TypeError(`
The "values" property has been removed from column definitions. The following is no longer supported:

sequelize.define('MyModel', {
  roles: {
    type: DataTypes.ENUM,
    values: ['admin', 'user'],
  },
});

Instead, define enum values like this:

sequelize.define('MyModel', {
  roles: {
    type: DataTypes.ENUM(['admin', 'user']),
  },
});

Remove the "values" property to resolve this issue.
        `.trim());
    }

    if (!attribute.type) {
      return attribute;
    }

    attribute.type = this.normalizeDataType(attribute.type);

    return attribute;
  }
}

// Aliases
Sequelize.prototype.fn = Sequelize.fn;
Sequelize.prototype.col = Sequelize.col;
Sequelize.prototype.cast = Sequelize.cast;
Sequelize.prototype.literal = Sequelize.literal;
Sequelize.prototype.and = Sequelize.and;
Sequelize.prototype.or = Sequelize.or;
Sequelize.prototype.json = Sequelize.json;
Sequelize.prototype.where = Sequelize.where;
Sequelize.prototype.validate = Sequelize.prototype.authenticate;

/**
 * Sequelize version number.
 */
// To avoid any errors on startup when this field is unused, only resolve it as needed.
// this is to prevent any potential issues on startup with unusual environments (eg, bundled code)
// where relative paths may fail that are unnecessary.
Object.defineProperty(Sequelize, 'version', {
  enumerable: true,
  get() {
    return require('../package.json').version;
  },
});

/**
 * Operators symbols to be used for querying data
 *
 * @see  {@link Operators}
 */
Sequelize.Op = Op;

/**
 * Available table hints to be used for querying data in mssql for table hints
 *
 * @see {@link TableHints}
 */
Sequelize.TableHints = TableHints;

/**
 * Available index hints to be used for querying data in mysql for index hints
 *
 * @see {@link IndexHints}
 */
Sequelize.IndexHints = IndexHints;

/**
 * A reference to the sequelize transaction class. Use this to access isolationLevels and types when creating a transaction
 *
 * @see {@link Transaction}
 * @see {@link Sequelize.transaction}
 */
Sequelize.Transaction = Transaction;

Sequelize.GeoJsonType = require('./geo-json').GeoJsonType;

/**
 * A reference to Sequelize constructor from sequelize. Useful for accessing DataTypes, Errors etc.
 *
 * @see {@link Sequelize}
 */
Sequelize.prototype.Sequelize = Sequelize;

/**
 * Available query types for use with `sequelize.query`
 *
 * @see {@link QueryTypes}
 */
Sequelize.prototype.QueryTypes = Sequelize.QueryTypes = QueryTypes;

/**
 * Exposes the validator.js object, so you can extend it with custom validation functions. The validator is exposed both on the instance, and on the constructor.
 *
 * @see https://github.com/chriso/validator.js
 */
Sequelize.prototype.Validator = Sequelize.Validator = Validator;

Sequelize.Model = Model;

Sequelize.AbstractQueryInterface = AbstractQueryInterface;
Sequelize.BelongsTo = BelongsTo;
Sequelize.HasOne = HasOne;
Sequelize.HasMany = HasMany;
Sequelize.BelongsToMany = BelongsToMany;

Sequelize.DataTypes = DataTypes;
for (const dataTypeName in DataTypes) {
  Object.defineProperty(Sequelize, dataTypeName, {
    get() {
      noSequelizeDataType();

      return DataTypes[dataTypeName];
    },
  });
}

/**
 * A reference to the deferrable collection. Use this to access the different deferrable options.
 *
 * @see {@link Transaction.Deferrable}
 * @see {@link Sequelize#transaction}
 */
Sequelize.Deferrable = Deferrable;

/**
 * A reference to the sequelize association class.
 *
 * @see {@link Association}
 */
Sequelize.prototype.Association = Sequelize.Association = Association;

/**
 * Provide alternative version of `inflection` module to be used by `pluralize` etc.
 *
 * @param {object} _inflection - `inflection` module
 */
Sequelize.useInflection = useInflection;

/**
 * Expose various errors available
 */

// expose alias to BaseError
Sequelize.Error = sequelizeErrors.BaseError;

for (const error of Object.keys(sequelizeErrors)) {
  Sequelize[error] = sequelizeErrors[error];
}

/**
 * Creates an object representing a database function. This can be used in search queries, both in where and order parts, and as default values in column definitions.
 * If you want to refer to columns in your function, you should use `sequelize.col`, so that the columns are properly interpreted as columns and not a strings.
 *
 * @see Model.findAll
 * @see Sequelize.define
 * @see Sequelize.col
 *
 * @param {string} fn The function you want to call
 * @param {any} args All further arguments will be passed as arguments to the function
 *
 * @since v2.0.0-dev3
 * @memberof Sequelize
 * @returns {Sequelize.fn}
 *
 * @example <caption>Convert a user's username to upper case</caption>
 * instance.update({
 *   username: sequelize.fn('upper', sequelize.col('username'))
 * });
 */
export function fn(fn, ...args) {
  return new Fn(fn, args);
}

/**
 * Creates an object which represents a column in the DB, this allows referencing another column in your query. This is often useful in conjunction with `sequelize.fn`, since raw string arguments to fn will be escaped.
 *
 * @see Sequelize#fn
 *
 * @param {string} col The name of the column
 * @since v2.0.0-dev3
 * @memberof Sequelize
 *
 * @returns {Sequelize.col}
 */
export function col(col) {
  return new Col(col);
}

/**
 * Creates an object representing a call to the cast function.
 *
 * @param {any} val The value to cast
 * @param {string} type The type to cast it to
 * @since v2.0.0-dev3
 * @memberof Sequelize
 *
 * @returns {Sequelize.cast}
 */
export function cast(val, type) {
  return new Cast(val, type);
}

/**
 * Creates an object representing a literal, i.e. something that will not be escaped.
 *
 * @param {any} val literal value
 * @since v2.0.0-dev3
 * @memberof Sequelize
 *
 * @returns {Sequelize.literal}
 */
export function literal(val) {
  return new Literal(val);
}

/**
 * An AND query
 *
 * @see Model.findAll
 *
 * @param {...string|object} args Each argument will be joined by AND
 * @since v2.0.0-dev3
 * @memberof Sequelize
 *
 * @returns {Sequelize.and}
 */
export function and(...args) {
  return { [Op.and]: args };
}

/**
 * An OR query
 *
 * @see
 * {@link Model.findAll}
 *
 * @param {...string|object} args Each argument will be joined by OR
 * @since v2.0.0-dev3
 * @memberof Sequelize
 *
 * @returns {Sequelize.or}
 */
export function or(...args) {
  return { [Op.or]: args };
}

/**
 * Creates an object representing nested where conditions for postgres/sqlite/mysql json data-type.
 *
 * @see Model.findAll
 *
 * @param {string|object} conditionsOrPath A hash containing strings/numbers or other nested hash, a string using dot notation or a string using postgres/sqlite/mysql json syntax.
 * @param {string|number|boolean} [value] An optional value to compare against. Produces a string of the form "<json path> = '<value>'".
 * @memberof Sequelize
 *
 * @returns {Sequelize.json}
 */
export function json(conditionsOrPath, value) {
  return new Json(conditionsOrPath, value);
}

/**
 * A way of specifying attr = condition.
 *
 * The attr can either be an object taken from `Model.rawAttributes` (for example `Model.rawAttributes.id` or `Model.rawAttributes.name`). The
 * attribute should be defined in your model definition. The attribute can also be an object from one of the sequelize utility functions (`sequelize.fn`, `sequelize.col` etc.)
 *
 * For string attributes, use the regular `{ where: { attr: something }}` syntax. If you don't want your string to be escaped, use `sequelize.literal`.
 *
 * @see Model.findAll
 *
 * @param {object} attr The attribute, which can be either an attribute object from `Model.rawAttributes` or a sequelize object, for example an instance of `sequelize.fn`. For simple string attributes, use the POJO syntax
 * @param {symbol} [comparator='Op.eq'] operator
 * @param {string|object} logic The condition. Can be both a simply type, or a further condition (`or`, `and`, `.literal` etc.)
 * @since v2.0.0-dev3
 */
export function where(attr, comparator, logic) {
  return new Where(attr, comparator, logic);
}
