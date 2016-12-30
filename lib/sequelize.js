'use strict';

var url = require('url')
  , Path = require('path')
  , retry = require('retry-as-promised')
  , Utils = require('./utils')
  , Model = require('./model')
  , DataTypes = require('./data-types')
  , Deferrable = require('./deferrable')
  , ModelManager = require('./model-manager')
  , QueryInterface = require('./query-interface')
  , Transaction = require('./transaction')
  , QueryTypes = require('./query-types')
  , sequelizeErrors = require('./errors')
  , Promise = require('./promise')
  , Hooks = require('./hooks')
  , Instance = require('./instance')
  , Association = require('./associations/index')
  , _ = require('lodash');

/**
 * This is the main class, the entry point to sequelize. To use it, you just need to import sequelize:
 *
 * ```js
 * var Sequelize = require('sequelize');
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
 * var sequelize = new Sequelize('database', 'username')
 *
 * // without options
 * var sequelize = new Sequelize('database', 'username', 'password')
 *
 * // without password / with blank password
 * var sequelize = new Sequelize('database', 'username', null, {})
 *
 * // with password and options
 * var sequelize = new Sequelize('my_database', 'john', 'doe', {})
 *
 * // with uri (see below)
 * var sequelize = new Sequelize('mysql://localhost:3306/database', {})
 * ```
 *
 * @name Sequelize
 * @constructor
 *
 * @param {String}   database The name of the database
 * @param {String}   [username=null] The username which is used to authenticate against the database.
 * @param {String}   [password=null] The password which is used to authenticate against the database.
 * @param {Object}   [options={}] An object with options.
 * @param {String}   [options.host='localhost'] The host of the relational database.
 * @param {Integer}  [options.port=] The port of the relational database.
 * @param {String}   [options.username=null] The username which is used to authenticate against the database.
 * @param {String}   [options.password=null] The password which is used to authenticate against the database.
 * @param {String}   [options.database=null] The name of the database
 * @param {String}   [options.dialect='mysql'] The dialect of the database you are connecting to. One of mysql, postgres, sqlite, mariadb and mssql.
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
 * @param {Integer}  [options.pool.maxConnections]
 * @param {Integer}  [options.pool.minConnections]
 * @param {Integer}  [options.pool.maxIdleTime] The maximum time, in milliseconds, that a connection can be idle before being released
 * @param {Function} [options.pool.validateConnection] A function that validates a connection. Called with client. The default function checks that client is an object, and that its state is not disconnected
 * @param {Boolean}  [options.quoteIdentifiers=true] Set to `false` to make table names and attributes case-insensitive on Postgres and skip double quoting of them.
 * @param {String}   [options.transactionType='DEFERRED'] Set the default transaction type. See `Sequelize.Transaction.TYPES` for possible options. Sqlite only.
 * @param {String}   [options.isolationLevel='REPEATABLE_READ'] Set the default transaction isolation level. See `Sequelize.Transaction.ISOLATION_LEVELS` for possible options.
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
var Sequelize = function(database, username, password, options) {
  var config;

  if (arguments.length === 1 && typeof database === 'object') {
    // new Sequelize({ ... options })
    options = database;
    config = _.pick(options, 'host', 'port', 'database', 'username', 'password');
  } else if ((arguments.length === 1 && typeof database === 'string') || (arguments.length === 2 && typeof username === 'object')) {
    // new Sequelize(URI, { ... options })

    config = {};
    options = username || {};

    var urlParts = url.parse(arguments[0]);

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
      config.username = urlParts.auth.split(':')[0];
      config.password = urlParts.auth.split(':')[1];
    }
  } else {
    // new Sequelize(database, username, password, { ... options })
    options = options || {};
    config = {database: database, username: username, password: password};
  }

  Sequelize.runHooks('beforeInit', config, options);

  this.options = Utils._.extend({
    dialect: 'mysql',
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
    isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ,
    databaseVersion: 0,
    typeValidation: false,
    benchmark: false
  }, options || {});

  if (this.options.dialect === 'postgresql') {
    this.options.dialect = 'postgres';
  }

  if (this.options.dialect === 'sqlite' && this.options.timezone !== '+00:00') {
    throw new Error('Setting a custom timezone is not supported by SQLite, dates are always returned as UTC. Please remove the custom timezone parameter.');
  }

  if (this.options.logging === true) {
    console.log('DEPRECATION WARNING: The logging-option should be either a function or false. Default: console.log');
    this.options.logging = console.log;
  }

  this.options.hooks = this.replaceHookAliases(this.options.hooks);

  if ((['', null, false].indexOf(config.password) > -1) || (typeof config.password === 'undefined')) {
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

  var Dialect;
  // Requiring the dialect in a switch-case to keep the
  // require calls static. (Browserify fix)
  switch (this.getDialect()){
    case 'mariadb':
      Dialect = require('./dialects/mariadb');
      break;
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
      throw new Error('The dialect ' + this.getDialect() + ' is not supported. Supported dialects: mariadb, mssql, mysql, postgres, and sqlite.');
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
    $trackRunningQueries: false,
    $runningQueries: 0,
    trackRunningQueries: function() {
      this.$trackRunningQueries = true;
    },
    verifyNoRunningQueries: function() {
      if (this.$runningQueries > 0) throw new Error('Expected 0 running queries. '+this.$runningQueries+' queries still running');
    }
  };

  Sequelize.runHooks('afterInit', this);
};

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
 * A reference to sequelize utilities. Most users will not need to use these utils directly. However, you might want to use `Sequelize.Utils._`, which is a reference to the lodash library, if you don't already have it imported in your project.
 * @property Utils
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
Sequelize.prototype.Validator = Sequelize.Validator = require('validator');

Sequelize.prototype.Model = Sequelize.Model = Model;

/**
 * A reference to the sequelize class holding commonly used data types. The datatypes are used when defining a new model using `sequelize.define`
 * @property DataTypes
 */
Sequelize.DataTypes = DataTypes;

for (var dataType in DataTypes) {
  Sequelize[dataType] = DataTypes[dataType];
}

Object.defineProperty(Sequelize.prototype, 'connectorManager', {
  get: function() {
    return this.transactionManager.getConnectorManager();
  }
});

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
 * A reference to the sequelize instance class.
 * @property Instance
 * @see {Instance}
 */
Sequelize.prototype.Instance = Sequelize.Instance = Instance;

/**
 * A reference to the sequelize association class.
 * @property Association
 * @see {Association}
 */
Sequelize.prototype.Association = Sequelize.Association = Association;

/**
 * Allow hooks to be defined on Sequelize + on sequelize instance as universal hooks to run on all models
 * and on Sequelize/sequelize methods e.g. Sequelize(), Sequelize#define()
 */
Hooks.applyTo(Sequelize);

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


Sequelize.prototype.refreshTypes = function () {
  this.connectionManager.refreshTypeParser(DataTypes);
};

/**
 * Returns the specified dialect.
 *
 * @return {String} The specified dialect.
 */
Sequelize.prototype.getDialect = function() {
  return this.options.dialect;
};

/**
 * Returns an instance of QueryInterface.

 * @method getQueryInterface
 * @return {QueryInterface} An instance (singleton) of QueryInterface.
 *
 * @see {QueryInterface}
 */
Sequelize.prototype.getQueryInterface = function() {
  this.queryInterface = this.queryInterface || new QueryInterface(this);
  return this.queryInterface;
};

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
 * @param {String}                  modelName The name of the model. The model will be stored in `sequelize.models` under this name
 * @param {Object}                  attributes An object, where each attribute is a column of the table. Each column can be either a DataType, a string or a type-description object, with the properties described below:
 * @param {String|DataType|Object}  attributes.column The description of a database column
 * @param {String|DataType}         attributes.column.type A string or a data type
 * @param {Boolean}                 [attributes.column.allowNull=true] If false, the column will have a NOT NULL constraint, and a not null validation will be run before an instance is saved.
 * @param {Any}                     [attributes.column.defaultValue=null] A literal default value, a JavaScript function, or an SQL function (see `sequelize.fn`)
 * @param {String|Boolean}          [attributes.column.unique=false] If true, the column will get a unique constraint. If a string is provided, the column will be part of a composite unique index. If multiple columns have the same string, they will be part of the same unique index
 * @param {Boolean}                 [attributes.column.primaryKey=false]
 * @param {String}                  [attributes.column.field=null] If set, sequelize will map the attribute name to a different name in the database
 * @param {Boolean}                 [attributes.column.autoIncrement=false]
 * @param {String}                  [attributes.column.comment=null]
 * @param {String|Model}            [attributes.column.references=null] An object with reference configurations
 * @param {String|Model}            [attributes.column.references.model] If this column references another table, provide it here as a Model, or a string
 * @param {String}                  [attributes.column.references.key='id'] The column of the foreign table that this column references
 * @param {String}                  [attributes.column.onUpdate] What should happen when the referenced key is updated. One of CASCADE, RESTRICT, SET DEFAULT, SET NULL or NO ACTION
 * @param {String}                  [attributes.column.onDelete] What should happen when the referenced key is deleted. One of CASCADE, RESTRICT, SET DEFAULT, SET NULL or NO ACTION
 * @param {Function}                [attributes.column.get] Provide a custom getter for this column. Use `this.getDataValue(String)` to manipulate the underlying values.
 * @param {Function}                [attributes.column.set] Provide a custom setter for this column. Use `this.setDataValue(String, Value)` to manipulate the underlying values.
 * @param {Object}                  [attributes.validate] An object of validations to execute for this column every time the model is saved. Can be either the name of a validation provided by validator.js, a validation function provided by extending validator.js (see the `DAOValidator` property for more details), or a custom validation function. Custom validation functions are called with the value of the field, and can possibly take a second callback argument, to signal that they are asynchronous. If the validator is sync, it should throw in the case of a failed validation, it it is async, the callback should be called with the error text.

 * @param {Object}                  [options] These options are merged with the default define options provided to the Sequelize constructor
 * @param {Object}                  [options.defaultScope={}] Define the default search scope to use for this model. Scopes have the same form as the options passed to find / findAll
 * @param {Object}                  [options.scopes] More scopes, defined in the same way as defaultScope above. See `Model.scope` for more information about how scopes are defined, and what you can do with them
 * @param {Boolean}                 [options.omitNull] Don't persist null values. This means that all columns with null values will not be saved
 * @param {Boolean}                 [options.timestamps=true] Adds createdAt and updatedAt timestamps to the model.
 * @param {Boolean}                 [options.paranoid=false] Calling `destroy` will not delete the model, but instead set a `deletedAt` timestamp if this is true. Needs `timestamps=true` to work
 * @param {Boolean}                 [options.underscored=false] Converts all camelCased columns to underscored if true
 * @param {Boolean}                 [options.underscoredAll=false] Converts camelCased model names to underscored table names if true
 * @param {Boolean}                 [options.freezeTableName=false] If freezeTableName is true, sequelize will not try to alter the DAO name to get the table name. Otherwise, the model name will be pluralized
 * @param {Object}                  [options.name] An object with two attributes, `singular` and `plural`, which are used when this model is associated to others.
 * @param {String}                  [options.name.singular=inflection.singularize(modelName)]
 * @param {String}                  [options.name.plural=inflection.pluralize(modelName)]
 * @param {Array<Object>}           [options.indexes]
 * @param {String}                  [options.indexes[].name] The name of the index. Defaults to model name + _ + fields concatenated
 * @param {String}                  [options.indexes[].type] Index type. Only used by mysql. One of `UNIQUE`, `FULLTEXT` and `SPATIAL`
 * @param {String}                  [options.indexes[].method] The method to create the index by (`USING` statement in SQL). BTREE and HASH are supported by mysql and postgres, and postgres additionally supports GIST and GIN.
 * @param {Boolean}                 [options.indexes[].unique=false] Should the index by unique? Can also be triggered by setting type to `UNIQUE`
 * @param {Boolean}                 [options.indexes[].concurrently=false] PostgreSQL will build the index without taking any write locks. Postgres only
 * @param {Array<String|Object>}    [options.indexes[].fields] An array of the fields to index. Each field can either be a string containing the name of the field, a sequelize object (e.g `sequelize.fn`), or an object with the following attributes: `attribute` (field name), `length` (create a prefix index of length chars), `order` (the direction the column should be sorted in), `collate` (the collation (sort order) for the column)
 * @param {String|Boolean}          [options.createdAt] Override the name of the createdAt column if a string is provided, or disable it if false. Timestamps must be true. Not affected by underscored setting.
 * @param {String|Boolean}          [options.updatedAt] Override the name of the updatedAt column if a string is provided, or disable it if false. Timestamps must be true. Not affected by underscored setting.
 * @param {String|Boolean}          [options.deletedAt] Override the name of the deletedAt column if a string is provided, or disable it if false. Timestamps must be true. Not affected by underscored setting.
 * @param {String}                  [options.tableName] Defaults to pluralized model name, unless freezeTableName is true, in which case it uses model name verbatim
 * @param {Object}                  [options.getterMethods] Provide getter functions that work like those defined per column. If you provide a getter method with the same name as a column, it will be used to access the value of that column. If you provide a name that does not match a column, this function will act as a virtual getter, that can fetch multiple other values
 * @param {Object}                  [options.setterMethods] Provide setter functions that work like those defined per column. If you provide a setter method with the same name as a column, it will be used to update the value of that column. If you provide a name that does not match a column, this function will act as a virtual setter, that can act on and set other values, but will not be persisted
 * @param {Object}                  [options.instanceMethods] Provide functions that are added to each instance (DAO). If you override methods provided by sequelize, you can access the original method using `this.constructor.super_.prototype`, e.g. `this.constructor.super_.prototype.toJSON.apply(this, arguments)`
 * @param {Object}                  [options.classMethods] Provide functions that are added to the model (Model). If you override methods provided by sequelize, you can access the original method using `this.constructor.prototype`, e.g. `this.constructor.prototype.find.apply(this, arguments)`
 * @param {String}                  [options.schema='public']
 * @param {String}                  [options.engine]
 * @param {String}                  [options.charset]
 * @param {String}                  [options.comment]
 * @param {String}                  [options.collate]
 * @param {String}                  [options.initialAutoIncrement] Set the initial AUTO_INCREMENT value for the table in MySQL.
 * @param {Object}                  [options.hooks] An object of hook function that are called before and after certain lifecycle events. The possible hooks are: beforeValidate, afterValidate, validationFailed, beforeBulkCreate, beforeBulkDestroy, beforeBulkUpdate, beforeCreate, beforeDestroy, beforeUpdate, afterCreate, afterDestroy, afterUpdate, afterBulkCreate, afterBulkDestory and afterBulkUpdate. See Hooks for more information about hook functions and their signatures. Each property can either be a function, or an array of functions.
 * @param {Object}                  [options.validate] An object of model wide validations. Validations have access to all model values via `this`. If the validator function takes an argument, it is assumed to be async, and is called with a callback that accepts an optional error.
 *
 * @return {Model}
 */
Sequelize.prototype.define = function(modelName, attributes, options) { // testhint options:none
  options = options || {};
  var globalOptions = this.options;

  if (globalOptions.define) {
    options = Utils.merge(_.cloneDeep(globalOptions.define), options);
  }

  options = Utils.merge({
    name: {
      plural: Utils.inflection.pluralize(modelName),
      singular: Utils.inflection.singularize(modelName)
    },
    indexes: [],
    omitNul: globalOptions.omitNull
  }, options);

  // if you call "define" multiple times for the same modelName, do not clutter the factory
  if (this.isDefined(modelName)) {
    this.modelManager.removeModel(this.modelManager.getModel(modelName));
  }

  options.sequelize = this;

  options.modelName = modelName;
  this.runHooks('beforeDefine', attributes, options);
  modelName = options.modelName;
  delete options.modelName;

  var model = new Model(modelName, attributes, options);
  model = model.init(this.modelManager);
  this.modelManager.addModel(model);

  this.runHooks('afterDefine', model);

  return model;
};

/**
 * Fetch a Model which is already defined
 *
 * @param {String} modelName The name of a model defined with Sequelize.define
 * @throws Will throw an error if the model is not defined (that is, if sequelize#isDefined returns false)
 * @return {Model}
 */
Sequelize.prototype.model = function(modelName) {
  if (!this.isDefined(modelName)) {
    throw new Error(modelName + ' has not been defined');
  }

  return this.modelManager.getModel(modelName);
};

/**
 * Checks whether a model with the given name is defined
 *
 * @param {String} modelName The name of a model defined with Sequelize.define
 * @return {Boolean}
 */
Sequelize.prototype.isDefined = function(modelName) {
  var models = this.modelManager.models;
  return (models.filter(function(model) { return model.name === modelName; }).length !== 0);
};

/**
 * Imports a model defined in another file
 *
 * Imported models are cached, so multiple calls to import with the same path will not load the file multiple times
 *
 * See https://github.com/sequelize/express-example for a short example of how to define your models in separate files so that they can be imported by sequelize.import
 * @param {String} path The path to the file that holds the model you want to import. If the part is relative, it will be resolved relatively to the calling file
 * @return {Model}
 */
Sequelize.prototype.import = function(path) {
  // is it a relative path?
  if(Path.normalize(path) !== Path.resolve(path)){
    // make path relative to the caller
    var callerFilename = Utils.stack()[1].getFileName()
      , callerPath = Path.dirname(callerFilename);

    path = Path.resolve(callerPath, path);
  }

  if (!this.importCache[path]) {
    var defineCall = (arguments.length > 1 ? arguments[1] : require(path));
    if (typeof defineCall === 'object') {
      // Babel/ES6 module compatability
      defineCall = defineCall.default;
    }
    this.importCache[path] = defineCall(this, DataTypes);
  }

  return this.importCache[path];
};

/**
 * Execute a query on the DB, with the possibility to bypass all the sequelize goodness.
 *
 * By default, the function will return two arguments: an array of results, and a metadata object, containing number of affected rows etc. Use `.spread` to access the results.
 *
 * If you are running a type of query where you don't need the metadata, for example a `SELECT` query, you can pass in a query type to make sequelize format the results:
 *
 * ```js
 * sequelize.query('SELECT...').spread(function (results, metadata) {
 *   // Raw query - use spread
 * });
 *
 * sequelize.query('SELECT...', { type: sequelize.QueryTypes.SELECT }).then(function (results) {
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
 * @param {Object|Array}    [options.bind] Either an object of named bind parameter in the format `$param` or an array of unnamed bind parameter to replace `$1, $2, ...` in your SQL.
 * @param {Boolean}         [options.useMaster=false] Force the query to use the write pool, regardless of the query type.
 * @param {Function}        [options.logging=false] A function that gets executed while running the query to log the sql.
 * @param {Instance}        [options.instance] A sequelize instance used to build the return instance
 * @param {Model}           [options.model] A sequelize model used to build the returned model instances (used to be called callee)
 * @param {Object}          [options.retry] Set of flags that control when a query is automatically retried.
 * @param {Array}           [options.retry.match] Only retry a query if the error matches one of these strings.
 * @param {Integer}         [options.retry.max] How many times a failing query is automatically retried.
 * @param {String}          [options.searchPath=DEFAULT] An optional parameter to specify the schema search_path (Postgres only)
 * @param {Boolean}         [options.supportsSearchPath] If false do not prepend the query with the search_path (Postgres only)
 * @param {Object}          [options.mapToModel=false] Map returned fields to model's fields if `options.model` or `options.instance` is present. Mapping will occur before building the model instance.
 * @param {Object}          [options.fieldMap] Map returned fields to arbitrary names for `SELECT` query type.
 *
 * @return {Promise}
 *
 * @see {Model#build} for more information about instance option.
 */
Sequelize.prototype.query = function(sql, options) {
  if (arguments.length > 2) {
    // TODO: Remove this note in the next major version (4.0)
    throw new Error('Sequelize.query was refactored to only use the parameters `sql` and `options`. Please read the changelog about BC.');
  }

  var self = this;

  options = _.assign({}, this.options.query, options);

  if (options.instance && !options.model) {
    options.model = options.instance.Model;
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
  var bindParameters;
  if (options.bind) {
    var bindSql = self.dialect.Query.formatBindParameters(sql, options.bind, this.options.dialect);
    sql = bindSql[0];
    bindParameters = bindSql[1];
  }

  options = _.defaults(options, {
    logging: this.options.hasOwnProperty('logging') ? this.options.logging : console.log,
    searchPath: this.options.hasOwnProperty('searchPath') ? this.options.searchPath : 'DEFAULT',
  });

  if (options.transaction === undefined && Sequelize.cls) {
    options.transaction = Sequelize.cls.get('transaction');
  }

  if (!options.type) {
    if (options.model || options.nest || options.plain) {
      options.type = QueryTypes.SELECT;
    } else {
      options.type = QueryTypes.RAW;
    }
  }

  if (options.transaction && options.transaction.finished) {
    var error = new Error(options.transaction.finished+' has been called on this transaction('+options.transaction.id+'), you can no longer use it. (The rejected query is attached as the \'sql\' property of this error)');
    error.sql = sql;
    return Promise.reject(error);
  }

  if (this.test.$trackRunningQueries) {
    this.test.$runningQueries++;
  }

  //if dialect doesn't support search_path or dialect option
  //to prepend searchPath is not true delete the searchPath option
  if (!self.dialect.supports.searchPath || !this.options.dialectOptions || !this.options.dialectOptions.prependSearchPath ||
    options.supportsSearchPath === false) {
    delete options.searchPath;
  } else if (!options.searchPath) {
    //if user wants to always prepend searchPath (dialectOptions.preprendSearchPath = true)
    //then set to DEFAULT if none is provided
    options.searchPath = 'DEFAULT';
  }

  return Promise.resolve(
    options.transaction ? options.transaction.connection : self.connectionManager.getConnection(options)
  ).then(function (connection) {

    var query = new self.dialect.Query(connection, self, options);
    return retry(function() {
      return query.run(sql, bindParameters).finally(function() {
        if (options.transaction) return;
        return self.connectionManager.releaseConnection(connection);
      });
    }, Utils._.extend(self.options.retry, options.retry || {}));
  }).finally(function () {
    if (self.test.$trackRunningQueries) {
      self.test.$runningQueries--;
    }
  });
};

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
Sequelize.prototype.set = function( variables, options ) {
  var query;

  // Prepare options
  options = Utils._.extend({}, this.options.set, typeof options === 'object' && options || {});

  if (['mysql', 'mariadb'].indexOf(this.options.dialect) === -1) {
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
  query =
    'SET '+
    Utils._.map( variables, function ( v, k ) {
      return '@'+k +' := '+ ( typeof v === 'string' ? '"'+v+'"' : v );
    }).join(', ');

  return this.query(query, options);
};

/**
 * Escape value.
 *
 * @param {String} value
 * @return {String}
 */
Sequelize.prototype.escape = function(value) {
  return this.getQueryInterface().escape(value);
};

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
Sequelize.prototype.createSchema = function(schema, options) {
  return this.getQueryInterface().createSchema(schema, options);
};

/**
 * Show all defined schemas
 *
 * Note,that this is a schema in the [postgres sense of the word](http://www.postgresql.org/docs/9.1/static/ddl-schemas.html),
 * not a database table. In mysql and sqlite, this will show all tables.
 * @param {Object} options={}
 * @param {Boolean|function} options.logging A function that logs sql queries, or false for no logging
 * @return {Promise}
 */
Sequelize.prototype.showAllSchemas = function(options) {
  return this.getQueryInterface().showAllSchemas(options);
};

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
Sequelize.prototype.dropSchema = function(schema, options) {
  return this.getQueryInterface().dropSchema(schema, options);
};

/**
 * Drop all schemas
 *
 * Note,that this is a schema in the [postgres sense of the word](http://www.postgresql.org/docs/9.1/static/ddl-schemas.html),
 * not a database table. In mysql and sqlite, this is the equivalent of drop all tables.
 * @param {Object} options={}
 * @param {Boolean|function} options.logging A function that logs sql queries, or false for no logging
 * @return {Promise}
 */
Sequelize.prototype.dropAllSchemas = function(options) {
  return this.getQueryInterface().dropAllSchemas(options);
};

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
Sequelize.prototype.sync = function(options) {
  var self = this;

  options = _.clone(options) || {};
  options.hooks = options.hooks === undefined ? true : !!options.hooks;
  options.logging = options.logging === undefined ? false : options.logging;
  options = Utils._.defaults(options, this.options.sync, this.options);

  if (options.match) {
    if (!options.match.test(this.config.database)) {
      return Promise.reject(new Error('Database does not match sync match parameter'));
    }
  }

  return Promise.try(function () {
    if (options.hooks) {
      return self.runHooks('beforeBulkSync', options);
    }
  }).then(function () {
    if (options.force) {
      return self.drop(options);
    }
  }).then(function() {
    var models = [];

    // Topologically sort by foreign key constraints to give us an appropriate
    // creation order
    self.modelManager.forEachModel(function(model) {
      if (model) {
        models.push(model);
      } else {
        // DB should throw an SQL error if referencing inexistant table
      }
    });

    return Promise.each(models, function(model) {
      return model.sync(options);
    });
  }).then(function () {
    if (options.hooks) {
      return self.runHooks('afterBulkSync', options);
    }
  }).return(self);
};

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
Sequelize.prototype.truncate = function(options) {
  var models = [];

  this.modelManager.forEachModel(function(model) {
    if (model) {
      models.push(model);
    }
  }, { reverse: false });

  var truncateModel = function(model) {
    return model.truncate(options);
  };

  if (options && options.cascade) {
    return Promise.each(models, truncateModel);
  } else {
    return Promise.map(models, truncateModel);
  }
};

/**
 * Drop all tables defined through this sequelize instance. This is done by calling Model.drop on each model
 * @see {Model#drop} for options
 *
 * @param {object} options  The options passed to each call to Model.drop
 * @param {Boolean|function} options.logging A function that logs sql queries, or false for no logging
 * @return {Promise}
 */
Sequelize.prototype.drop = function(options) {
  var models = [];

  this.modelManager.forEachModel(function(model) {
    if (model) {
      models.push(model);
    }
  }, { reverse: false });

  return Promise.each(models, function(model) {
    return model.drop(options);
  });
};

/**
 * Test the connection by trying to authenticate
 *
 * @fires success If authentication was successful
 * @error 'Invalid credentials' if the authentication failed (even if the database did not respond at all...)
 * @alias validate
 * @return {Promise}
 */
Sequelize.prototype.authenticate = function(options) {
  return this.query('SELECT 1+1 AS result', Utils._.assign({ raw: true, plain: true }, options)).return();
};

Sequelize.prototype.databaseVersion = function(options) {
  return this.getQueryInterface().databaseVersion(options);
};

Sequelize.prototype.validate = Sequelize.prototype.authenticate;

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
Sequelize.fn = Sequelize.prototype.fn = function(fn) {
  return new Utils.fn(fn, Utils.sliceArgs(arguments, 1));
};

/**
 * Creates a object representing a column in the DB. This is often useful in conjunction with `sequelize.fn`, since raw string arguments to fn will be escaped.
 * @see {Sequelize#fn}
 *
 * @method col
 * @param {String} col The name of the column
 * @since v2.0.0-dev3
 * @return {Sequelize.col}
 */
Sequelize.col = Sequelize.prototype.col = function(col) {
  return new Utils.col(col);
};


/**
 * Creates a object representing a call to the cast function.
 *
 * @method cast
 * @param {any} val The value to cast
 * @param {String} type The type to cast it to
 * @since v2.0.0-dev3
 * @return {Sequelize.cast}
 */
Sequelize.cast = Sequelize.prototype.cast = function(val, type) {
  return new Utils.cast(val, type);
};

/**
 * Creates a object representing a literal, i.e. something that will not be escaped.
 *
 * @method literal
 * @param {any} val
 * @alias asIs
 * @since v2.0.0-dev3
 * @return {Sequelize.literal}
 */
Sequelize.literal = Sequelize.asIs = Sequelize.prototype.asIs = Sequelize.prototype.literal = function(val) {
  return new Utils.literal(val);
};

/**
 * An AND query
 * @see {Model#find}
 *
 * @method and
 * @param {String|Object} args Each argument will be joined by AND
 * @since v2.0.0-dev3
 * @return {Sequelize.and}
 */
Sequelize.and = Sequelize.prototype.and = function() {
  return { $and: Utils.sliceArgs(arguments) };
};

/**
 * An OR query
 * @see {Model#find}
 *
 * @method or
 * @param {String|Object} args Each argument will be joined by OR
 * @since v2.0.0-dev3
 * @return {Sequelize.or}
 */
Sequelize.or = Sequelize.prototype.or = function() {
  return { $or: Utils.sliceArgs(arguments) };
};

/**
 * Creates an object representing nested where conditions for postgres's json data-type.
 * @see {Model#find}
 *
 * @method json
 * @param {String|Object} conditions A hash containing strings/numbers or other nested hash, a string using dot notation or a string using postgres json syntax.
 * @param {String|Number|Boolean} [value] An optional value to compare against. Produces a string of the form "<json path> = '<value>'".
 * @return {Sequelize.json}
 */
Sequelize.json = Sequelize.prototype.json = function (conditionsOrPath, value) {
  return new Utils.json(conditionsOrPath, value);
};

/*
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
Sequelize.where = Sequelize.condition = Sequelize.prototype.condition = Sequelize.prototype.where = function(attr, comparator, logic) {
  return new Utils.where(attr, comparator, logic);
};

/**
 * Start a transaction. When using transactions, you should pass the transaction in the options argument in order for the query to happen under that transaction
 *
 * ```js
 * sequelize.transaction().then(function (t) {
 *   return User.find(..., { transaction: t}).then(function (user) {
 *     return user.updateAttributes(..., { transaction: t});
 *   })
 *   .then(t.commit.bind(t))
 *   .catch(t.rollback.bind(t));
 * })
 * ```
 *
 * A syntax for automatically committing or rolling back based on the promise chain resolution is also supported:
 *
 * ```js
 * sequelize.transaction(function (t) { // Note that we use a callback rather than a promise.then()
 *   return User.find(..., { transaction: t}).then(function (user) {
 *     return user.updateAttributes(..., { transaction: t});
 *   });
 * }).then(function () {
 *   // Committed
 * }).catch(function (err) {
 *   // Rolled back
 *   console.error(err);
 * });
 * ```
 *
 * If you have [CLS](https://github.com/othiym23/node-continuation-local-storage) enabled, the transaction will automatically be passed to any query that runs within the callback.
 * To enable CLS, add it do your project, create a namespace and set it on the sequelize constructor:
 *
 * ```js
 * var cls = require('continuation-local-storage'),
 *     ns = cls.createNamespace('....');
 * var Sequelize = require('sequelize');
 * Sequelize.cls = ns;
 * ```
 * Note, that CLS is enabled for all sequelize instances, and all instances will share the same namespace
 *
 * @see {Transaction}

 * @param {Object}   [options={}]
 * @param {Boolean}  [options.autocommit=true]
 * @param {String}   [options.type='DEFERRED'] See `Sequelize.Transaction.TYPES` for possible options. Sqlite only.
 * @param {String}   [options.isolationLevel='REPEATABLE_READ'] See `Sequelize.Transaction.ISOLATION_LEVELS` for possible options
 * @param {Function} [options.logging=false] A function that gets executed while running the query to log the sql.
 * @return {Promise}
 * @fires error If there is an uncaught error during the transaction
 * @fires success When the transaction has ended (either committed or rolled back)
 */
Sequelize.prototype.transaction = function(options, autoCallback) {
  if (typeof options === 'function') {
    autoCallback = options;
    options = undefined;
  }
  // testhint argsConform.end

  var transaction = new Transaction(this, options)
    , ns = Sequelize.cls;

  if (autoCallback) {
    var transactionResolver = function (resolve, reject) {
      transaction.prepareEnvironment().then(function () {
        if (ns) {
          autoCallback = ns.bind(autoCallback);
        }

        var result = autoCallback(transaction);
        if (!result || !result.then) throw new Error('You need to return a promise chain/thenable to the sequelize.transaction() callback');

        return result.then(function (result) {
          return transaction.commit().then(function () {
            resolve(result);
          });
        });
      }).catch(function(err) {
        // If the transaction has already finished (commit, rollback, etc), reject with the original error
        if (transaction.finished) {
          reject(err);
        } else {
          return transaction.rollback().finally(function () {
            reject(err);
          });
        }
      });
    };

    if (ns) {
      transactionResolver = ns.bind(transactionResolver, ns.createContext());
    }

    return new Promise(transactionResolver);
  } else {
    return transaction.prepareEnvironment().return(transaction);
  }
};

Sequelize.prototype.log = function() {
  var args = Utils.sliceArgs(arguments)
    , last = Utils._.last(args)
    , options;

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
};

/**
 * Close all connections used by this sequelize instance, and free all references so the instance can be garbage collected.
 *
 * Normally this is done on process exit, so you only need to call this method if you are creating multiple instances, and want
 * to garbage collect some of them.
 */
Sequelize.prototype.close = function () {
  this.connectionManager.close();
};

Sequelize.prototype.normalizeDataType = function(Type) {
  var type = typeof Type === 'function' ? new Type() : Type
    , dialectTypes = this.dialect.DataTypes || {};

  if (dialectTypes[type.key]) {
    type = dialectTypes[type.key].extend(type);
  }

  if (type instanceof DataTypes.ARRAY && dialectTypes[type.type.key]) {
    type.type = dialectTypes[type.type.key].extend(type.type);
  }
  return type;
};
Sequelize.prototype.normalizeAttribute = function(attribute) {
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
};

// Allows the promise to access cls namespaces
module.exports = Promise.Sequelize = Sequelize;
module.exports.Sequelize = Sequelize;
module.exports.default = Sequelize;
