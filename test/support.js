'use strict';

const fs = require('fs'),
  path = require('path'),
  _ = require('lodash'),
  Sequelize = require(__dirname + '/../index'),
  DataTypes = require(__dirname + '/../lib/data-types'),
  Config = require(__dirname + '/config/config'),
  supportShim = require(__dirname + '/supportShim'),
  chai = require('chai'),
  expect = chai.expect,
  AbstractQueryGenerator = require('../lib/dialects/abstract/query-generator');


chai.use(require('chai-spies'));
chai.use(require('chai-datetime'));
chai.use(require('chai-as-promised'));
chai.use(require('sinon-chai'));
chai.config.includeStack = true;
chai.should();

// Make sure errors get thrown when testing
process.on('uncaughtException', e => {
  console.error('An unhandled exception occured:');
  throw e;
});
Sequelize.Promise.onPossiblyUnhandledRejection(e => {
  console.error('An unhandled rejection occured:');
  throw e;
});
Sequelize.Promise.longStackTraces();

// shim all Sequelize methods for testing for correct `options.logging` passing
// and no modification of `options` objects
if (!process.env.COVERAGE && process.env.SHIM) supportShim(Sequelize);

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
    const dialect = Support.getTestDialect();

    if (dialect === 'sqlite') {
      const p = path.join(__dirname, 'tmp', 'db.sqlite');

      return new Sequelize.Promise(resolve => {
        // We cannot promisify exists, since exists does not follow node callback convention - first argument is a boolean, not an error / null
        if (fs.existsSync(p)) {
          resolve(Sequelize.Promise.promisify(fs.unlink)(p));
        } else {
          resolve();
        }
      }).then(() => {
        const options = _.extend({}, sequelize.options, { storage: p }),
          _sequelize = new Sequelize(sequelize.config.database, null, null, options);

        if (callback) {
          _sequelize.sync({ force: true }).then(() => { callback(_sequelize); });
        } else {
          return _sequelize.sync({ force: true }).return (_sequelize);
        }
      });
    } else {
      if (callback) {
        callback(sequelize);
      } else {
        return Sequelize.Promise.resolve(sequelize);
      }
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

        return sequelize
          .getQueryInterface()
          .dropAllEnums();
      });
  },

  getSupportedDialects() {
    return fs.readdirSync(__dirname + '/../lib/dialects').filter(file => {
      return file.indexOf('.js') === -1 && file.indexOf('abstract') === -1;
    });
  },

  checkMatchForDialects(dialect, value, expectations) {
    if (expectations[dialect]) {
      expect(value).to.match(expectations[dialect]);
    } else {
      throw new Error('Undefined expectation for "' + dialect + '"!');
    }
  },

  getAbstractQueryGenerator(sequelize) {
    return Object.assign(
      {},
      AbstractQueryGenerator,
      {options: sequelize.options, _dialect: sequelize.dialect, sequelize, quoteIdentifier(identifier) { return identifier; }}
    );
  },

  getTestDialect() {
    let envDialect = process.env.DIALECT || 'mysql';

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
    let url;
    const dbConfig = config[config.dialect];

    if (config.dialect === 'sqlite') {
      url = 'sqlite://' + dbConfig.storage;
    } else {

      let credentials = dbConfig.username;
      if (dbConfig.password) {
        credentials += ':' + dbConfig.password;
      }

      url = config.dialect + '://' + credentials
      + '@' + dbConfig.host + ':' + dbConfig.port + '/' + dbConfig.database;
    }
    return url;
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
  beforeEach(function() {
    this.sequelize = Support.sequelize;
  });
}
Support.sequelize = Support.createSequelizeInstance();
module.exports = Support;
