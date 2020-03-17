'use strict';

const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const Sequelize = require('../index');
const Config = require('./config/config');
const chai = require('chai');
const expect = chai.expect;
const AbstractQueryGenerator = require('../lib/dialects/abstract/query-generator');
const sinon = require('sinon');

sinon.usingPromise(require('bluebird'));

chai.use(require('chai-spies'));
chai.use(require('chai-datetime'));
chai.use(require('chai-as-promised'));
chai.use(require('sinon-chai'));
chai.config.includeStack = true;
chai.should();

// Make sure errors get thrown when testing
process.on('uncaughtException', e => {
  console.error('An unhandled exception occurred:');
  throw e;
});
Sequelize.Promise.onPossiblyUnhandledRejection(e => {
  console.error('An unhandled rejection occurred:');
  throw e;
});
Sequelize.Promise.longStackTraces();

const Support = {
  Sequelize,

  prepareTransactionTest(sequelize) {
    const dialect = Support.getTestDialect();

    if (dialect === 'sqlite') {
      const p = path.join(__dirname, 'tmp', 'db.sqlite');
      if (fs.existsSync(p)) {
        fs.unlinkSync(p);
      }
      const options = Object.assign({}, sequelize.options, { storage: p }),
        _sequelize = new Sequelize(sequelize.config.database, null, null, options);

      return _sequelize.sync({ force: true }).return(_sequelize);
    }
    return Sequelize.Promise.resolve(sequelize);
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
      dialectOptions: options.dialectOptions || config.dialectOptions || {},
      minifyAliases: options.minifyAliases || config.minifyAliases
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
      })
      .then(() => {
        return this.dropTestSchemas(sequelize);
      });
  },

  dropTestSchemas(sequelize) {

    const queryInterface = sequelize.getQueryInterface();
    if (!queryInterface.QueryGenerator._dialect.supports.schemas) {
      return this.sequelize.drop({});
    }

    return sequelize.showAllSchemas().then(schemas => {
      const schemasPromise = [];
      schemas.forEach(schema => {
        const schemaName = schema.name ? schema.name : schema;
        if (schemaName !== sequelize.config.database) {
          schemasPromise.push(sequelize.dropSchema(schemaName));
        }
      });
      return Promise.all(schemasPromise.map(p => p.catch(e => e)))
        .then(() => {}, () => {});
    });
  },

  getSupportedDialects() {
    return fs.readdirSync(`${__dirname}/../lib/dialects`)
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
      _dialect: sequelize.dialect
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
    let dialect = this.getTestDialect();

    if (process.env.DIALECT === 'postgres-native') {
      dialect = 'postgres-native';
    }

    return `[${dialect.toUpperCase()}] ${moduleName}`;
  },

  expectsql(query, assertions) {
    const expectations = assertions.query || assertions;
    let expectation = expectations[Support.sequelize.dialect.name];

    if (!expectation) {
      if (expectations['default'] !== undefined) {
        expectation = expectations['default'];
        if (typeof expectation === 'string') {
          expectation = expectation
            .replace(/\[/g, Support.sequelize.dialect.TICK_CHAR_LEFT)
            .replace(/\]/g, Support.sequelize.dialect.TICK_CHAR_RIGHT);
        }
      } else {
        throw new Error(`Undefined expectation for "${Support.sequelize.dialect.name}"!`);
      }
    }

    if (query instanceof Error) {
      expect(query.message).to.equal(expectation.message);
    } else {
      expect(query.query || query).to.equal(expectation);
    }

    if (assertions.bind) {
      const bind = assertions.bind[Support.sequelize.dialect.name] || assertions.bind['default'] || assertions.bind;
      expect(query.bind).to.deep.equal(bind);
    }
  }
};

if (global.beforeEach) {
  before(function() {
    this.sequelize = Support.sequelize;
  });
  beforeEach(function() {
    this.sequelize = Support.sequelize;
  });
}

Support.sequelize = Support.createSequelizeInstance();
module.exports = Support;
