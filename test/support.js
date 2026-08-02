import _ from 'lodash';
import Sequelize from '../index.js';
import DataTypes from '../lib/data-types.js';
import Config from './config/config.js';
import supportShim from './supportShim.js';
import * as chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import PostgresQueryGenerator from '../lib/dialects/postgres/query-generator.js';
import chaiDatetime from './support/chai-datetime.js';

const expect = chai.expect;

chai.use(chaiDatetime);
chai.use(chaiAsPromised);
chai.config.includeStack = true;
chai.should();

// Make sure errors get thrown when testing
process.on('uncaughtException', (e) => {
  console.error('An unhandled exception occured:');
  throw e;
});
process.on('unhandledRejection', (e) => {
  console.error('An unhandled rejection occured:');
  throw e;
});

// shim all Sequelize methods for testing for correct `options.logging` passing
// and no modification of `options` objects
if (!process.env.COVERAGE && process.env.SHIM) {
  supportShim(Sequelize);
}

const Support = {
  Sequelize,

  initTests(options) {
    const sequelize = this.createSequelizeInstance(options);

    this.clearDatabase(sequelize, () => {
      if (options.context) {
        options.context.sequelize = sequelize;
      }

      if (options.beforeComplete) {
        options.beforeComplete(sequelize, DataTypes);
      }

      if (options.onComplete) {
        options.onComplete(sequelize, DataTypes);
      }
    });
  },

  prepareTransactionTest(sequelize, callback) {
    if (callback) {
      callback(sequelize);
    } else {
      return Promise.resolve(sequelize);
    }
  },

  createSequelizeInstance(options) {
    options = options || {};
    options.dialect = this.getTestDialect();

    const config = Config[options.dialect];

    const sequelizeOptions = _.defaults(options, {
      host: options.host || config.host,
      logging: process.env.SEQ_LOG ? console.log : false,
      dialect: options.dialect,
      port: options.port || process.env.SEQ_PORT || config.port,
      pool: config.pool,
      dialectOptions: options.dialectOptions || config.dialectOptions || {}
    });

    if (process.env.DIALECT === 'postgres-native') {
      sequelizeOptions.native = true;
    }

    if (config.storage) {
      sequelizeOptions.storage = config.storage;
    }

    return this.getSequelizeInstance(config.database, config.username, config.password, sequelizeOptions);
  },

  getConnectionOptions() {
    const config = Config[this.getTestDialect()];

    delete config.pool;

    return config;
  },

  getSequelizeInstance(db, user, pass, options) {
    options = options || {};
    options.dialect = options.dialect || this.getTestDialect();
    return new Sequelize(db, user, pass, options);
  },

  clearDatabase(sequelize) {
    return sequelize
      .getQueryInterface()
      .dropAllTables()
      .then(() => {
        sequelize.modelManager.models = [];
        sequelize.models = {};

        return sequelize.getQueryInterface().dropAllEnums();
      });
  },

  getSupportedDialects() {
    return ['postgres'];
  },

  checkMatchForDialects(dialect, value, expectations) {
    if (expectations[dialect]) {
      expect(value).to.match(expectations[dialect]);
    } else {
      throw new Error('Undefined expectation for "' + dialect + '"!');
    }
  },

  // Builds the real postgres query generator, but with identifier quoting stubbed out so that
  // assertions can be written against bare identifiers. Composing only the base generator would
  // miss every postgres override and produce something that never runs in practice.
  getQueryGenerator(sequelize) {
    // `Object.create` rather than `Object.assign({}, ...)`: the postgres generator inherits most of
    // its methods from the base via `__proto__`, and those are not own properties.
    return Object.assign(Object.create(PostgresQueryGenerator), {
      options: sequelize.options,
      _dialect: sequelize.dialect,
      sequelize,
      quoteIdentifier(identifier) {
        return identifier;
      }
    });
  },

  getTestDialect() {
    let envDialect = process.env.DIALECT || 'postgres';

    if (envDialect === 'postgres-native') {
      envDialect = 'postgres';
    }

    if (this.getSupportedDialects().indexOf(envDialect) === -1) {
      throw new Error('The dialect you have passed is unknown. Did you really mean: ' + envDialect);
    }

    return envDialect;
  },

  getTestDialectTeaser(moduleName) {
    let dialect = this.getTestDialect();

    if (process.env.DIALECT === 'postgres-native') {
      dialect = 'postgres-native';
    }

    return '[' + dialect.toUpperCase() + '] ' + moduleName;
  },

  getTestUrl(config) {
    const dbConfig = config[config.dialect];

    let credentials = dbConfig.username;
    if (dbConfig.password) {
      credentials += ':' + dbConfig.password;
    }

    return config.dialect + '://' + credentials + '@' + dbConfig.host + ':' + dbConfig.port + '/' + dbConfig.database;
  },

  expectsql(query, expectations) {
    let expectation = expectations[Support.sequelize.dialect.name];

    if (!expectation) {
      if (expectations['default'] !== undefined) {
        expectation = expectations['default']
          .replace(/\[/g, Support.sequelize.dialect.TICK_CHAR_LEFT)
          .replace(/\]/g, Support.sequelize.dialect.TICK_CHAR_RIGHT);
      } else {
        throw new Error('Undefined expectation for "' + Support.sequelize.dialect.name + '"!');
      }
    }

    if (_.isError(query)) {
      expect(query.message).to.equal(expectation.message);
    } else {
      expect(query).to.equal(expectation);
    }
  }
};

if (typeof beforeEach !== 'undefined') {
  beforeEach(function () {
    this.sequelize = Support.sequelize;
  });
}
Support.sequelize = Support.createSequelizeInstance();

export default Support;
