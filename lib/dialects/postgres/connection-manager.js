'use strict';

const _ = require('lodash');
const AbstractConnectionManager = require('../abstract/connection-manager');
const logger = require('../../utils/logger');
const debug = logger.getLogger().debugContext('connection:pg');
const Promise = require('../../promise');
const sequelizeErrors = require('../../errors');
const semver = require('semver');
const dataTypes = require('../../data-types');
const moment = require('moment-timezone');

class ConnectionManager extends AbstractConnectionManager {
  constructor(dialect, sequelize) {
    super(dialect, sequelize);

    this.sequelize.config.port = this.sequelize.config.port || 5432;

    try {
      let pgLib;
      if (sequelize.config.dialectModulePath) {
        pgLib = require(sequelize.config.dialectModulePath);
      } else {
        pgLib = require('pg');
      }
      this.lib = sequelize.config.native ? pgLib.native : pgLib;
    } catch (err) {
      if (err.code === 'MODULE_NOT_FOUND') {
        throw new Error('Please install \'' + (sequelize.config.dialectModulePath || 'pg') + '\' module manually');
      }
      throw err;
    }

    this._clearTypeParser();
    this.refreshTypeParser(dataTypes.postgres);
  }

  // Expose this as a method so that the parsing may be updated when the user has added additional, custom types
  _refreshTypeParser(dataType) {
    if (dataType.types.postgres.oids) {
      for (const oid of dataType.types.postgres.oids) {
        this.oidMap[oid] = value => dataType.parse(value, oid, this.lib.types.getTypeParser);
      }
    }

    if (dataType.types.postgres.array_oids) {
      for (const oid of dataType.types.postgres.array_oids) {
        this.arrayOidMap[oid] = value => {
          return this.lib.types.arrayParser.create(value, v =>
            dataType.parse(v, oid, this.lib.types.getTypeParser)
          ).parse();
        };
      }
    }
  }

  _clearTypeParser() {
    this.oidMap = {};
    this.arrayOidMap = {};
  }

  getTypeParser(oid) {
    if (this.oidMap[oid]) {
      return this.oidMap[oid];
    } else if (this.arrayOidMap[oid]) {
      return this.arrayOidMap[oid];
    }

    return this.lib.types.getTypeParser.apply(undefined, arguments);
  }

  connect(config) {
    config.user = config.username;
    const connectionConfig = _.pick(config, [
      'user', 'password', 'host', 'database', 'port'
    ]);

    connectionConfig.types = {
      getTypeParser: ConnectionManager.prototype.getTypeParser.bind(this)
    };

    if (config.dialectOptions) {
      _.merge(connectionConfig,
        _.pick(config.dialectOptions, [
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
          // !! DO NOT SET THIS TO TRUE !!
          // (unless you know what you're doing)
          // see [http://www.postgresql.org/message-id/flat/bc9549a50706040852u27633f41ib1e6b09f8339d845@mail.gmail.com#bc9549a50706040852u27633f41ib1e6b09f8339d845@mail.gmail.com]
          'binary',
          // This should help with backends incorrectly considering idle clients to be dead and prematurely disconnecting them.
          // this feature has been added in pg module v6.0.0, check pg/CHANGELOG.md
          'keepAlive',
          // Times out queries after a set time in milliseconds. Added in pg v7.3
          'statement_timeout'
        ]));
    }

    return new Promise((resolve, reject) => {
      const connection = new this.lib.Client(connectionConfig);
      let responded = false;

      connection.connect(err => {
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
        debug('connection acquired');
        resolve(connection);
      });

      // If we didn't ever hear from the client.connect() callback the connection timeout, node-postgres does not treat this as an error since no active query was ever emitted
      connection.on('end', () => {
        debug('connection timeout');
        if (!responded) {
          reject(new sequelizeErrors.ConnectionTimedOutError(new Error('Connection timed out')));
        }
      });

      // Don't let a Postgres restart (or error) to take down the whole app
      connection.on('error', err => {
        debug(`connection error ${err.code}`);
        connection._invalid = true;
      });
    }).tap(connection => {
      // Disable escape characters in strings, see https://github.com/sequelize/sequelize/issues/3545
      let query = '';

      if (this.sequelize.options.databaseVersion !== 0 && semver.gte(this.sequelize.options.databaseVersion, '8.2.0')) {
        query += 'SET standard_conforming_strings=on;';
      }

      if (!this.sequelize.config.keepDefaultTimezone) {
        const isZone = !!moment.tz.zone(this.sequelize.options.timezone);
        if (isZone) {
          query += 'SET client_min_messages TO warning; SET TIME ZONE \'' + this.sequelize.options.timezone + '\';';
        } else {
          query += 'SET client_min_messages TO warning; SET TIME ZONE INTERVAL \'' + this.sequelize.options.timezone + '\' HOUR TO MINUTE;';
        }
      }

      if (query) {
        return connection.query(query);
      }
    }).tap(connection => {
      if (
        dataTypes.GEOGRAPHY.types.postgres.oids.length === 0 &&
        dataTypes.GEOMETRY.types.postgres.oids.length === 0 &&
        dataTypes.HSTORE.types.postgres.oids.length === 0 &&
        dataTypes.ENUM.types.postgres.oids.length === 0
      ) {
        return this._refreshDynamicOIDs(connection);
      }
    });
  }

  disconnect(connection) {
    return new Promise(resolve => {
      connection.end();
      resolve();
    });
  }

  validate(connection) {
    return connection._invalid === undefined;
  }

  _refreshDynamicOIDs(connection) {
    const databaseVersion = this.sequelize.options.databaseVersion;
    const supportedVersion = '8.3.0';

    // Check for supported version
    if ( (databaseVersion && semver.gte(databaseVersion, supportedVersion)) === false) {
      return Promise.resolve();
    }

    // Refresh dynamic OIDs for some types
    // These include, Geometry / HStore / Enum
    return (connection || this.sequelize).query(
      "SELECT typname, typtype, oid, typarray FROM pg_type WHERE (typtype = 'b' AND typname IN ('hstore', 'geometry', 'geography')) OR (typtype = 'e')"
    ).then(results => {
      let result = Array.isArray(results) ? results.pop() : results;

      // When searchPath is prepended then two statements are executed and the result is
      // an array of those two statements. First one is the SET search_path and second is
      // the SELECT query result.
      if (Array.isArray(result)) {
        if (result[0].command === 'SET') {
          result = result.pop();
        }
      }

      // Reset OID mapping for dynamic type
      [
        dataTypes.postgres.GEOMETRY,
        dataTypes.postgres.HSTORE,
        dataTypes.postgres.GEOGRAPHY,
        dataTypes.postgres.ENUM
      ].forEach(type => {
        type.types.postgres.oids = [];
        type.types.postgres.array_oids = [];
      });

      for (const row of result.rows) {
        let type;

        if (row.typname === 'geometry') {
          type = dataTypes.postgres.GEOMETRY;
        } else if (row.typname === 'hstore') {
          type = dataTypes.postgres.HSTORE;
        } else if (row.typname === 'geography') {
          type = dataTypes.postgres.GEOGRAPHY;
        } else if (row.typtype === 'e') {
          type = dataTypes.postgres.ENUM;
        }

        type.types.postgres.oids.push(row.oid);
        type.types.postgres.array_oids.push(row.typarray);
      }

      this.refreshTypeParser(dataTypes.postgres);
    });
  }
}

module.exports = ConnectionManager;
module.exports.ConnectionManager = ConnectionManager;
module.exports.default = ConnectionManager;
