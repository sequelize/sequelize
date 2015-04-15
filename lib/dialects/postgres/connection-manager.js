'use strict';

var AbstractConnectionManager = require('../abstract/connection-manager')
  , ConnectionManager
  , Utils = require('../../utils')
  , Promise = require('../../promise')
  , sequelizeErrors = require('../../errors');

ConnectionManager = function(dialect, sequelize) {
  AbstractConnectionManager.call(this, dialect, sequelize);

  this.sequelize = sequelize;
  this.sequelize.config.port = this.sequelize.config.port || 5432;
  try {
    this.lib = sequelize.config.native ? require(sequelize.config.dialectModulePath || 'pg').native : require(sequelize.config.dialectModulePath || 'pg');
  } catch (err) {
    throw new Error('Please install postgres package manually');
  }
};

Utils._.extend(ConnectionManager.prototype, AbstractConnectionManager.prototype);

ConnectionManager.prototype.connect = function(config) {
  var self = this
    , connectionConfig = {};

  config.user = config.username;
  connectionConfig = Utils._.pick(config, [
    'user', 'password', 'host', 'database', 'port'
  ]);

  if (config.dialectOptions) {
    Utils._.merge(connectionConfig,
                  Utils._.pick(config.dialectOptions, [
      // see [http://www.postgresql.org/docs/9.3/static/runtime-config-logging.html#GUC-APPLICATION-NAME]
      'application_name',
      // choose the SSL mode with the PGSSLMODE environment variable
      // object format: [https://github.com/brianc/node-postgres/blob/master/lib/connection.js#L79]
      // see also [http://www.postgresql.org/docs/9.3/static/libpq-ssl.html]
      'ssl',
      // In addition to the values accepted by the corresponding server,
      // you can use "auto" to determine the right encoding from the
      // current locale in the client (LC_CTYPE environment variable on Unix systems)
      'client_encoding',
      // !! DONT SET THIS TO TRUE !!
      // (unless you know what you're doing)
      // see [http://www.postgresql.org/message-id/flat/bc9549a50706040852u27633f41ib1e6b09f8339d845@mail.gmail.com#bc9549a50706040852u27633f41ib1e6b09f8339d845@mail.gmail.com]
      'binary'
    ]));
  }

  return new Promise(function (resolve, reject) {
    var connection = new self.lib.Client(connectionConfig)
      , responded = false;

    connection.connect(function(err) {
      if (err) {
        if (err.code) {
          switch (err.code) {
          case 'ECONNREFUSED':
            reject(new sequelizeErrors.ConnectionRefusedError(err));
            break;
          case 'ENOTFOUND':
            reject(new sequelizeErrors.HostNotFoundError(err));
            break;
          case 'EHOSTUNREACH':
            reject(new sequelizeErrors.HostNotReachableError(err));
            break;
          case 'EINVAL':
            reject(new sequelizeErrors.InvalidConnectionError(err));
            break;
          default:
            reject(new sequelizeErrors.ConnectionError(err));
            break;
          }
        } else {
          reject(new sequelizeErrors.ConnectionError(err));
        }
        return;
      }
      responded = true;
      resolve(connection);
    });

    // If we didn't ever hear from the client.connect() callback the connection timeout, node-postgres does not treat this as an error since no active query was ever emitted
    connection.on('end', function () {
      if (!responded) {
        reject(new sequelizeErrors.ConnectionTimedOutError(new Error('Connection timed out')));
      }
    });

    // Don't let a Postgres restart (or error) to take down the whole app
    connection.on('error', function() {
      connection._invalid = true;
    });
  }).tap(function (connection) {
    if (self.sequelize.config.keepDefaultTimezone) return;
    return new Promise(function (resolve, reject) {
      connection.query('SET client_min_messages TO warning; SET TIME ZONE INTERVAL \'' + self.sequelize.options.timezone + '\' HOUR TO MINUTE').on('error', function (err) {
        reject(err);
      }).on('end', function () {
        resolve();
      });
    });
  });
};
ConnectionManager.prototype.disconnect = function(connection) {
  return new Promise(function (resolve, reject) {
    connection.end();
    resolve();
  });
};

ConnectionManager.prototype.validate = function(connection) {
  return connection._invalid === undefined;
};

module.exports = ConnectionManager;
