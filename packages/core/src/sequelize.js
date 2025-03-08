'use strict';

import { EMPTY_OBJECT, shallowClonePojo } from '@sequelize/utils';
import defaults from 'lodash/defaults';
import isPlainObject from 'lodash/isPlainObject';
import map from 'lodash/map';
import retry from 'retry-as-promised';
import { AbstractConnectionManager } from './abstract-dialect/connection-manager.js';
import { AbstractDialect } from './abstract-dialect/dialect.js';
import { AbstractQueryGenerator } from './abstract-dialect/query-generator.js';
import { AbstractQueryInterface } from './abstract-dialect/query-interface';
import { AbstractQuery } from './abstract-dialect/query.js';
import { Association } from './associations/base.js';
import { BelongsToAssociation } from './associations/belongs-to';
import { BelongsToManyAssociation } from './associations/belongs-to-many';
import { HasManyAssociation } from './associations/has-many';
import { HasOneAssociation } from './associations/has-one';
import * as DataTypes from './data-types';
import { ConstraintChecking, Deferrable } from './deferrable';
import * as SequelizeErrors from './errors';
import { AssociationPath } from './expression-builders/association-path';
import { Attribute } from './expression-builders/attribute';
import { BaseSqlExpression } from './expression-builders/base-sql-expression.js';
import { Cast, cast } from './expression-builders/cast.js';
import { Col, col } from './expression-builders/col.js';
import { Fn, fn } from './expression-builders/fn.js';
import { Identifier } from './expression-builders/identifier';
import { JsonPath } from './expression-builders/json-path';
import { JSON_NULL, SQL_NULL } from './expression-builders/json-sql-null.js';
import { json } from './expression-builders/json.js';
import { List } from './expression-builders/list';
import { Literal, literal } from './expression-builders/literal.js';
import { sql } from './expression-builders/sql';
import { Value } from './expression-builders/value';
import { Where, where } from './expression-builders/where.js';
import { importModels } from './import-models.js';
import { IndexHints } from './index-hints';
import { Model } from './model';
import { setTransactionFromCls } from './model-internals.js';
import { ManualOnDelete } from './model-repository.types.js';
import { Op } from './operators';
import { QueryTypes } from './query-types';
import { SequelizeTypeScript } from './sequelize-typescript';
import { TableHints } from './table-hints';
import {
  COMPLETES_TRANSACTION,
  IsolationLevel,
  Lock,
  Transaction,
  TransactionNestMode,
  TransactionType,
} from './transaction.js';
import * as Deprecations from './utils/deprecations';
import {
  noGetDialect,
  noGetQueryInterface,
  noSequelizeDataType,
  noSequelizeIsDefined,
  noSequelizeModel,
} from './utils/deprecations';
import { isModelStatic, isSameInitialModel } from './utils/model-utils';
import { injectReplacements, mapBindParameters } from './utils/sql';
import { withSqliteForeignKeysOff } from './utils/sql.js';
import { useInflection } from './utils/string';
import { validator as Validator } from './utils/validator-extras';

/**
 * This is the main class, the entry point to sequelize.
 */
export class Sequelize extends SequelizeTypeScript {
  /**
   * Returns the specified dialect.
   *
   * @returns {string} The specified dialect.
   */
  getDialect() {
    noGetDialect();

    return this.dialect.name;
  }

  /**
   * Returns the database name.
   *
   * @returns {string} The database name.
   */
  getDatabaseName() {
    throw new Error(
      'getDatabaseName has been removed as it does not make sense in every dialect. Please use the values available in sequelize.options.replication.write for an equivalent option.',
    );
  }

  /**
   * Returns an instance of AbstractQueryInterface.
   *
   * @returns {AbstractQueryInterface} An instance (singleton) of AbstractQueryInterface.
   */
  getQueryInterface() {
    noGetQueryInterface();

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
  define(modelName, attributes = EMPTY_OBJECT, options = EMPTY_OBJECT) {
    options = shallowClonePojo(options);

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
    noSequelizeModel();

    return this.models.getOrThrow(modelName);
  }

  /**
   * Checks whether a model with the given name is defined
   *
   * @param {string} modelName The name of a model defined with Sequelize.define
   *
   * @returns {boolean} Returns true if model is already defined, otherwise false
   */
  isDefined(modelName) {
    noSequelizeIsDefined();

    return this.models.hasByName(modelName);
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

    if (sql instanceof BaseSqlExpression) {
      sql = this.queryGenerator.formatSqlExpression(sql, options);
    }

    if (typeof sql === 'object') {
      throw new TypeError(
        '"sql" cannot be an object. Pass a string instead, and pass bind and replacement parameters through the "options" parameter',
      );
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
    if (options.bind != null) {
      const isBindArray = Array.isArray(options.bind);
      if (!isPlainObject(options.bind) && !isBindArray) {
        throw new TypeError(
          'options.bind must be either a plain object (for named parameters) or an array (for numeric parameters)',
        );
      }

      const mappedResult = mapBindParameters(sql, this.dialect);

      for (const parameterName of mappedResult.parameterSet) {
        if (isBindArray) {
          if (!/[1-9][0-9]*/.test(parameterName) || options.bind.length < Number(parameterName)) {
            throw new Error(
              `Query includes bind parameter "$${parameterName}", but no value has been provided for that bind parameter.`,
            );
          }
        } else if (!(parameterName in options.bind)) {
          throw new Error(
            `Query includes bind parameter "$${parameterName}", but no value has been provided for that bind parameter.`,
          );
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

    options = defaults(options, {
      logging: Object.hasOwn(this.options, 'logging') ? this.options.logging : console.debug,
      searchPath: Object.hasOwn(this.options, 'searchPath') ? this.options.searchPath : 'DEFAULT',
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
      !this.dialect.supports.searchPath ||
      !this.options.prependSearchPath ||
      options.supportsSearchPath === false
    ) {
      delete options.searchPath;
    } else if (!options.searchPath) {
      // if user wants to always prepend searchPath (preprendSearchPath = true)
      // then set to DEFAULT if none is provided
      options.searchPath = 'DEFAULT';
    }

    const checkTransaction = () => {
      if (
        options.transaction &&
        options.transaction.getFinished() &&
        !options[COMPLETES_TRANSACTION]
      ) {
        const error = new Error(
          `${options.transaction.getFinished()} has been called on this transaction(${options.transaction.id}), you can no longer use it. (The rejected query is attached as the 'sql' property of this error)`,
        );
        error.sql = sql;
        throw error;
      }
    };

    setTransactionFromCls(options, this);
    const retryOptions = { ...this.options.retry, ...options.retry };

    return await retry(async () => {
      checkTransaction();

      const connection = options.transaction
        ? options.transaction.getConnection()
        : options.connection
          ? options.connection
          : await this.pool.acquire({
              useMaster: options.useMaster,
              type: options.type === 'SELECT' ? 'read' : 'write',
            });

      if (this.dialect.name === 'db2' && options.alter && options.alter.drop === false) {
        connection.dropTable = false;
      }

      const query = new this.dialect.Query(connection, this, options);

      try {
        await this.hooks.runAsync('beforeQuery', options, query);
        checkTransaction();

        return await query.run(sql, bindParameters, { minifyAliases: options.minifyAliases });
      } finally {
        await this.hooks.runAsync('afterQuery', options, query);
        if (!options.transaction && !options.connection) {
          this.pool.release(connection);
        }
      }
    }, retryOptions);
  }

  /**
   * Execute a query which would set an environment or user variable. The variables are set per connection, so this function needs a transaction.
   * Only works for MySQL or MariaDB.
   *
   * @param {object} variables Object with multiple variables.
   * @param {object} [options] query options.
   *
   * @returns {Promise}
   */
  async setSessionVariables(variables, options) {
    // Prepare options
    options = { ...this.options.setSessionVariables, ...options };

    if (!['mysql', 'mariadb'].includes(this.dialect.name)) {
      throw new Error('sequelize.setSessionVariables is only supported for mysql or mariadb');
    }

    setTransactionFromCls(options, this);

    if (
      (!options.transaction || !(options.transaction instanceof Transaction)) &&
      !options.connection
    ) {
      throw new Error(
        'You must specify either options.transaction or options.connection, as sequelize.setSessionVariables is used to set the session options of a connection',
      );
    }

    // Override some options, since this isn't a SELECT
    options.raw = true;
    options.plain = true;
    options.type = 'SET';

    // Generate SQL Query
    const query = `SET ${map(
      variables,
      (v, k) => `@${k} := ${typeof v === 'string' ? `"${v}"` : v}`,
    ).join(', ')}`;

    return await this.query(query, options);
  }

  /**
   * Sync all defined models to the DB.
   *
   * @param {object} [options={}] sync options
   * @param {boolean} [options.force=false] If force is true, each Model will run `DROP TABLE IF EXISTS`, before it tries to create its own table
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
      ...this.options.sync,
      ...options,
      hooks: options ? options.hooks !== false : true,
    };

    if ('match' in options) {
      throw new Error(
        'The "match" option has been removed as matching against a database name does not make sense in every dialects.',
      );
    }

    if (options.hooks) {
      await this.hooks.runAsync('beforeBulkSync', options);
    }

    if (options.force) {
      await this.drop({
        ...options,
        cascade: this.dialect.supports.dropTable.cascade || undefined,
      });
    }

    // no models defined, just authenticate
    if (this.models.size === 0) {
      await this.authenticate(options);
    } else {
      const models = this.models.getModelsTopoSortedByForeignKey();
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
    if (this.dialect.name === 'sqlite3') {
      // Optimisation: no need to do this in two passes in SQLite because we can temporarily disable foreign keys
      await withSqliteForeignKeysOff(this, options, async () => {
        for (const model of this.models) {
          await model.sync(options);
        }
      });

      return;
    }

    // create all tables, but don't create foreign key constraints
    for (const model of this.models) {
      await model.sync({ ...options, withoutForeignKeyConstraints: true });
    }

    // add foreign key constraints
    for (const model of this.models) {
      await model.sync({ ...options, force: false, alter: true });
    }
  }

  /**
   * Drop all tables defined through this sequelize instance.
   * This is done by calling {@link Model.drop} on each model.
   *
   * @param {object} [options] The options passed to each call to Model.drop
   * @param {boolean|Function} [options.logging] A function that logs sql queries, or false for no logging
   *
   * @returns {Promise}
   */
  async drop(options) {
    // if 'cascade' is specified, we don't have to worry about cyclic dependencies.
    if (options && options.cascade) {
      for (const model of this.models) {
        await model.drop(options);
      }
    }

    const sortedModels = this.models.getModelsTopoSortedByForeignKey();

    // no cyclic dependency between models, we can delete them in an order that will not cause an error.
    if (sortedModels) {
      for (const model of sortedModels) {
        await model.drop(options);
      }
    }

    if (this.dialect.name === 'sqlite3') {
      // Optimisation: no need to do this in two passes in SQLite because we can temporarily disable foreign keys
      await withSqliteForeignKeysOff(this, options, async () => {
        for (const model of this.models) {
          await model.drop(options);
        }
      });

      return;
    }

    // has cyclic dependency: we first remove each foreign key, then delete each model.
    for (const model of this.models) {
      const foreignKeys = await this.queryInterface.showConstraints(model, {
        ...options,
        constraintType: 'FOREIGN KEY',
      });

      await Promise.all(
        foreignKeys.map(foreignKey => {
          return this.queryInterface.removeConstraint(model, foreignKey.constraintName, options);
        }),
      );
    }

    for (const model of this.models) {
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

    await this.query(
      `SELECT 1+1 AS result${this.dialect.name === 'ibmi' ? ' FROM SYSIBM.SYSDUMMY1' : ''}`,
      options,
    );
  }

  /**
   * Get the fn for random based on the dialect
   *
   * @returns {Fn}
   */
  // TODO: replace with sql.random
  random() {
    if (['postgres', 'sqlite3', 'snowflake'].includes(this.dialect.name)) {
      return fn('RANDOM');
    }

    return fn('RAND');
  }

  // Global exports
  static Fn = Fn;
  static Col = Col;
  static Cast = Cast;
  static Literal = Literal;
  static Where = Where;
  static List = List;
  static Identifier = Identifier;
  static Attribute = Attribute;
  static Value = Value;
  static AssociationPath = AssociationPath;
  static JsonPath = JsonPath;

  static sql = sql;

  // these are all available on the "sql" object, but are exposed for backwards compatibility
  static fn = fn;
  static col = col;
  static cast = cast;
  static literal = literal;
  static json = json;
  static where = where;

  static and = and;

  static or = or;

  static isModelStatic = isModelStatic;

  static isSameInitialModel = isSameInitialModel;

  static importModels = importModels;

  static TransactionNestMode = TransactionNestMode;
  static TransactionType = TransactionType;
  static Lock = Lock;
  static IsolationLevel = IsolationLevel;

  log(...args) {
    let options;

    const last = args.at(-1);

    if (last && isPlainObject(last) && Object.hasOwn(last, 'logging')) {
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
        Deprecations.noTrueLogging();
        options.logging = console.debug;
      }

      // second argument is sql-timings, when benchmarking option enabled
      if ((this.options.benchmark || options.benchmark) && options.logging === console.debug) {
        args = [`${args[0]} Elapsed time: ${args[1]}ms`];
      }

      options.logging(...args);
    }
  }

  normalizeAttribute(attribute) {
    if (!isPlainObject(attribute)) {
      attribute = { type: attribute };
    } else {
      attribute = { ...attribute };
    }

    if (attribute.values) {
      throw new TypeError(
        `
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
        `.trim(),
      );
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
Sequelize.BelongsToAssociation = BelongsToAssociation;
Sequelize.HasOneAssociation = HasOneAssociation;
Sequelize.HasManyAssociation = HasManyAssociation;
Sequelize.BelongsToManyAssociation = BelongsToManyAssociation;

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
 * @see {@link QueryInterface#addConstraint}
 */
Sequelize.Deferrable = Deferrable;

/**
 * A reference to the deferrable collection. Use this to access the different deferrable options.
 *
 * @see {@link Transaction.Deferrable}
 * @see {@link Sequelize#transaction}
 */
Sequelize.ConstraintChecking = ConstraintChecking;

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

Sequelize.SQL_NULL = SQL_NULL;
Sequelize.JSON_NULL = JSON_NULL;
Sequelize.ManualOnDelete = ManualOnDelete;

Sequelize.AbstractConnectionManager = AbstractConnectionManager;
Sequelize.AbstractQueryGenerator = AbstractQueryGenerator;
Sequelize.AbstractQuery = AbstractQuery;
Sequelize.AbstractDialect = AbstractDialect;

/**
 * Expose various errors available
 */

for (const error of Object.keys(SequelizeErrors)) {
  Sequelize[error] = SequelizeErrors[error];
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
  if (args.length === 1) {
    return { [Op.or]: args[0] };
  }

  return { [Op.or]: args };
}
