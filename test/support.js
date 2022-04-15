'use strict';

const fs = require('fs');
const path = require('path');
const { inspect, isDeepStrictEqual } = require('util');
const _ = require('lodash');

const { Sequelize } = require('@sequelize/core');
const Config = require('./config/config');
const chai = require('chai');

const expect = chai.expect;
const { AbstractQueryGenerator } = require('@sequelize/core/_non-semver-use-at-your-own-risk_/dialects/abstract/query-generator.js');

const distDir = path.resolve(__dirname, '../lib');

chai.use(require('chai-datetime'));
chai.use(require('chai-as-promised'));
chai.use(require('sinon-chai'));

// Using util.inspect to correctly assert objects with symbols
// Because expect.deep.equal does not test non iterator keys such as symbols (https://github.com/chaijs/chai/issues/1054)
chai.Assertion.addMethod('deepEqual', function (expected, depth = 5) {
  expect(inspect(this._obj, { depth })).to.deep.equal(inspect(expected, { depth }));
});

function withInlineCause(cb) {
  return () => {
    try {
      return cb();
    } catch (error) {
      error.message = inlineErrorCause(error);

      throw error;
    }
  };
}

function inlineErrorCause(error) {
  let message = error.message;

  const cause = error.cause;
  if (cause) {
    message += `\nCaused by: ${inlineErrorCause(cause)}`;
  }

  return message;
}

/**
 * `expect(fn).to.throwWithCause()` works like `expect(fn).to.throw()`, except
 * that is also checks whether the message is present in the error cause.
 */
chai.Assertion.addMethod('throwWithCause', function (errorConstructor, errorMessage) {
  expect(withInlineCause(this._obj)).to.throw(errorConstructor, errorMessage);
});

chai.config.includeStack = true;
chai.should();

// Make sure errors get thrown when testing
process.on('uncaughtException', e => {
  console.error('An unhandled exception occurred:');
  throw e;
});

let onNextUnhandledRejection = null;
let unhandledRejections = null;

process.on('unhandledRejection', e => {
  if (unhandledRejections) {
    unhandledRejections.push(e);
  }

  const onNext = onNextUnhandledRejection;
  if (onNext) {
    onNextUnhandledRejection = null;
    onNext(e);
  }

  if (onNext || unhandledRejections) {
    return;
  }

  console.error('An unhandled rejection occurred:');
  throw e;
});

if (global.afterEach) {
  afterEach(() => {
    onNextUnhandledRejection = null;
    unhandledRejections = null;
  });
}

let lastSqliteInstance;

const Support = {
  /**
   * Returns a Promise that will reject with the next unhandled rejection that occurs
   * during this test (instead of failing the test)
   */
  nextUnhandledRejection() {
    return new Promise((resolve, reject) => {
      onNextUnhandledRejection = reject;
    });
  },

  /**
   * Pushes all unhandled rejections that occur during this test onto destArray
   * (instead of failing the test).
   *
   * @param {Error[]} destArray the array to push unhandled rejections onto.  If you omit this,
   * one will be created and returned for you.
   *
   * @returns {Error[]} destArray
   */
  captureUnhandledRejections(destArray = []) {
    unhandledRejections = destArray;

    return unhandledRejections;
  },

  async prepareTransactionTest(sequelize) {
    const dialect = Support.getTestDialect();

    if (dialect === 'sqlite') {
      const p = path.join(__dirname, 'tmp', 'db.sqlite');
      if (lastSqliteInstance) {
        await lastSqliteInstance.close();
      }

      if (fs.existsSync(p)) {
        fs.unlinkSync(p);
      }

      const options = { ...sequelize.options, storage: p };
      const _sequelize = new Sequelize(sequelize.config.database, null, null, options);

      await _sequelize.sync({ force: true });
      lastSqliteInstance = _sequelize;

      return _sequelize;
    }

    return sequelize;
  },

  createSequelizeInstance(options) {
    options = options || {};
    options.dialect = Support.getTestDialect();

    const config = Config[options.dialect];

    const sequelizeOptions = _.defaults(options, {
      host: options.host || config.host,
      logging: process.env.SEQ_LOG ? console.log : false,
      dialect: options.dialect,
      port: options.port || process.env.SEQ_PORT || config.port,
      pool: config.pool,
      dialectOptions: options.dialectOptions || config.dialectOptions || {},
      minifyAliases: options.minifyAliases || config.minifyAliases,
      odbcConnectionString: config.odbcConnectionString || '',
    });

    if (process.env.DIALECT === 'postgres-native') {
      sequelizeOptions.native = true;
    }

    if (config.storage || config.storage === '') {
      sequelizeOptions.storage = config.storage;
    }

    return Support.getSequelizeInstance(config.database, config.username, config.password, sequelizeOptions);
  },

  resetSequelizeInstance() {
    for (const model of Array.from(Support.sequelize.modelManager.all)) {
      Support.sequelize.modelManager.removeModel(model);
    }
  },

  getConnectionOptionsWithoutPool() {
    // Do not break existing config object - shallow clone before `delete config.pool`
    const config = { ...Config[this.getTestDialect()] };
    delete config.pool;

    return config;
  },

  getSequelizeInstance(db, user, pass, options) {
    options = options || {};
    options.dialect = options.dialect || this.getTestDialect();

    return new Sequelize(db, user, pass, options);
  },

  async clearDatabase(sequelize) {
    const qi = sequelize.getQueryInterface();
    await qi.dropAllTables();
    sequelize.modelManager.models = [];
    sequelize.models = {};

    if (qi.dropAllEnums) {
      await qi.dropAllEnums();
    }

    await this.dropTestSchemas(sequelize);
  },

  async dropTestSchemas(sequelize) {
    const queryInterface = sequelize.getQueryInterface();
    if (!queryInterface.queryGenerator._dialect.supports.schemas) {
      return this.sequelize.drop({});
    }

    const schemas = await sequelize.showAllSchemas();
    const schemasPromise = [];
    for (const schema of schemas) {
      const schemaName = schema.name ? schema.name : schema;
      if (schemaName !== sequelize.config.database) {
        schemasPromise.push(sequelize.dropSchema(schemaName));
      }
    }

    await Promise.all(schemasPromise.map(p => p.catch(error => error)));
  },

  getSupportedDialects() {
    return fs.readdirSync(path.join(distDir, 'dialects'))
      .filter(file => !file.includes('.js') && !file.includes('abstract'));
  },

  getAbstractQueryGenerator(sequelize) {
    class ModdedQueryGenerator extends AbstractQueryGenerator {
      quoteIdentifier(x) {
        return x;
      }
    }

    const queryGenerator = new ModdedQueryGenerator({
      sequelize,
      _dialect: sequelize.dialect,
    });

    return queryGenerator;
  },

  getTestDialect() {
    let envDialect = process.env.DIALECT || 'mysql';

    if (envDialect === 'postgres-native') {
      envDialect = 'postgres';
    }

    if (!this.getSupportedDialects().includes(envDialect)) {
      throw new Error(`The dialect you have passed is unknown. Did you really mean: ${envDialect}`);
    }

    return envDialect;
  },

  getTestDialectTeaser(moduleName) {
    let dialect = Support.getTestDialect();

    if (process.env.DIALECT === 'postgres-native') {
      dialect = 'postgres-native';
    }

    return `[${dialect.toUpperCase()}] ${moduleName}`;
  },

  getPoolMax() {
    return Config[this.getTestDialect()].pool.max;
  },

  expectsql(query, assertions) {
    const expectations = assertions.query || assertions;
    let expectation = expectations[Support.sequelize.dialect.name];
    const dialect = Support.sequelize.dialect;

    if (!expectation) {
      if (expectations.default !== undefined) {
        expectation = expectations.default;
        if (typeof expectation === 'string') {
          // replace [...] with the proper quote character for the dialect
          // except for ARRAY[...]
          expectation = expectation.replace(/(?<!ARRAY)\[([^\]]+)]/g, `${dialect.TICK_CHAR_LEFT}$1${dialect.TICK_CHAR_RIGHT}`);
          if (dialect.name === 'ibmi') {
            expectation = expectation.replace(/;$/, '');
          }
        }
      } else {
        throw new Error(`Undefined expectation for "${Support.sequelize.dialect.name}"! (expectations: ${JSON.stringify(expectations)})`);
      }
    }

    if (query instanceof Error) {
      expect(query.message).to.equal(expectation.message);
    } else {
      expect(Support.minifySql(query.query || query)).to.equal(Support.minifySql(expectation));
    }

    if (assertions.bind) {
      const bind = assertions.bind[Support.sequelize.dialect.name] || assertions.bind.default || assertions.bind;
      expect(query.bind).to.deep.equal(bind);
    }
  },

  rand() {
    return Math.floor(Math.random() * 10e5);
  },

  isDeepEqualToOneOf(actual, expectedOptions) {
    return expectedOptions.some(expected => isDeepStrictEqual(actual, expected));
  },

  /**
   * Reduces insignificant whitespace from SQL string.
   *
   * @param {string} sql the SQL string
   * @returns {string} the SQL string with insignificant whitespace removed.
   */
  minifySql(sql) {
    // replace all consecutive whitespaces with a single plain space character
    return sql.replace(/\s+/g, ' ')
      // remove space before coma
      .replace(/ ,/g, ',')
      // remove space before )
      .replace(/ \)/g, ')')
      // replace space after (
      .replace(/\( /g, '(')
      // remove whitespace at start & end
      .trim();
  },
};

if (global.beforeEach) {
  before(function () {
    this.sequelize = Support.sequelize;
  });
  beforeEach(function () {
    this.sequelize = Support.sequelize;
  });
}

Support.sequelize = Support.createSequelizeInstance();
module.exports = Support;
