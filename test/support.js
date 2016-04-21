'use strict';

var fs = require('fs')
  , path = require('path')
  , _ = require('lodash')
  , Sequelize = require(__dirname + '/../index')
  , DataTypes = require(__dirname + '/../lib/data-types')
  , Config = require(__dirname + '/config/config')
  , supportShim = require(__dirname + '/supportShim')
  , chai = require('chai')
  , expect = chai.expect;

chai.use(require('chai-spies'));
chai.use(require('chai-datetime'));
chai.use(require('chai-as-promised'));
chai.use(require('sinon-chai'));
chai.config.includeStack = true;
chai.should();

// Make sure errors get thrown when testing
process.on('uncaughtException', function(e, promise) {
  console.error('An unhandled exception occured:');
  throw e;
});
Sequelize.Promise.onPossiblyUnhandledRejection(function(e, promise) {
  console.error('An unhandled rejection occured:');
  throw e;
});
Sequelize.Promise.longStackTraces();

// shim all Sequelize methods for testing for correct `options.logging` passing
if (!process.env.COVERAGE && false) supportShim(Sequelize);

var Support = {
  Sequelize: Sequelize,

  initTests: function(options) {
    var sequelize = this.createSequelizeInstance(options);

    this.clearDatabase(sequelize, function() {
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

  prepareTransactionTest: function(sequelize, callback) {
    var dialect = Support.getTestDialect();

    if (dialect === 'sqlite') {
      var p = path.join(__dirname, 'tmp', 'db.sqlite');

      return new Sequelize.Promise(function(resolve, reject) {
        // We cannot promisify exists, since exists does not follow node callback convention - first argument is a boolean, not an error / null
        if (fs.existsSync(p)) {
          resolve(Sequelize.Promise.promisify(fs.unlink)(p));
        } else {
          resolve();
        }
      }).then(function() {
        var options = Sequelize.Utils._.extend({}, sequelize.options, { storage: p })
          , _sequelize = new Sequelize(sequelize.config.database, null, null, options);

        if (callback) {
          _sequelize.sync({ force: true }).then(function() { callback(_sequelize); });
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

  createSequelizeInstance: function(options) {
    options = options || {};
    options.dialect = this.getTestDialect();

    var config = Config[options.dialect];

    var sequelizeOptions = _.defaults(options, {
      host: options.host || config.host,
      logging: (process.env.SEQ_LOG ? console.log : false),
      dialect: options.dialect,
      port: options.port || process.env.SEQ_PORT || config.port,
      pool: config.pool,
      dialectOptions: options.dialectOptions || {}
    });

    if (process.env.DIALECT === 'postgres-native') {
      sequelizeOptions.native = true;
    }

    if (!!config.storage) {
      sequelizeOptions.storage = config.storage;
    }

    return this.getSequelizeInstance(config.database, config.username, config.password, sequelizeOptions);
  },

  getConnectionOptions: function(options) {
    var config = Config[this.getTestDialect()];

    delete config.pool;

    return config;
  },

  getSequelizeInstance: function(db, user, pass, options) {
    options = options || {};
    options.dialect = options.dialect || this.getTestDialect();
    return new Sequelize(db, user, pass, options);
  },

  clearDatabase: function(sequelize) {
    return sequelize
      .getQueryInterface()
      .dropAllTables()
      .then(function() {
        sequelize.modelManager.models = [];
        sequelize.models = {};

        return sequelize
          .getQueryInterface()
          .dropAllEnums();
      });
  },

  getSupportedDialects: function() {
    return fs.readdirSync(__dirname + '/../lib/dialects').filter(function(file) {
      return ((file.indexOf('.js') === -1) && (file.indexOf('abstract') === -1));
    });
  },

  checkMatchForDialects: function(dialect, value, expectations) {
    if (!!expectations[dialect]) {
      expect(value).to.match(expectations[dialect]);
    } else {
      throw new Error('Undefined expectation for "' + dialect + '"!');
    }
  },

  getTestDialect: function() {
    var envDialect = process.env.DIALECT || 'mysql';

    if (envDialect === 'postgres-native') {
      envDialect = 'postgres';
    }

    if (this.getSupportedDialects().indexOf(envDialect) === -1) {
      throw new Error('The dialect you have passed is unknown. Did you really mean: ' + envDialect);
    }

    return envDialect;
  },

  dialectIsMySQL: function(strict) {
    var envDialect = process.env.DIALECT || 'mysql';
    if (strict === undefined) {
      strict = false;
    }

    if (strict) {
      return envDialect === 'mysql';
    } else {
      return ['mysql', 'mariadb'].indexOf(envDialect) !== -1;
    }
  },

  getTestDialectTeaser: function(moduleName) {
    var dialect = this.getTestDialect();

    if (process.env.DIALECT === 'postgres-native') {
      dialect = 'postgres-native';
    }

    return '[' + dialect.toUpperCase() + '] ' + moduleName;
  },

  getTestUrl: function(config) {
    var url,
        dbConfig = config[config.dialect];

    if (config.dialect === 'sqlite') {
      url = 'sqlite://' + dbConfig.storage;
    } else {

      var credentials = dbConfig.username;
      if (dbConfig.password) {
        credentials += ':' + dbConfig.password;
      }

      url = config.dialect + '://' + credentials
      + '@' + dbConfig.host + ':' + dbConfig.port + '/' + dbConfig.database;
    }
    return url;
  },

  expectsql: function(query, expectations) {
    var expectation = expectations[Support.sequelize.dialect.name];

    if (!expectation && Support.sequelize.dialect.name === 'mariadb') {
      expectation = expectations.mysql;
    }

    if (!expectation) {
      expectation = expectations['default']
                    .replace(/\[/g, Support.sequelize.dialect.TICK_CHAR_LEFT)
                    .replace(/\]/g, Support.sequelize.dialect.TICK_CHAR_RIGHT);
    }

    expect(query).to.equal(expectation);
  }
};

beforeEach(function() {
  this.sequelize = Support.sequelize;
});

Support.sequelize = Support.createSequelizeInstance();
module.exports = Support;
