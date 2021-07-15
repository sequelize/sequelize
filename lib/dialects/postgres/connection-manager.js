'use strict';

const _ = require('lodash');
const AbstractConnectionManager = require('../abstract/connection-manager');
const { logger } = require('../../utils/logger');
const debug = logger.debugContext('connection:pg');
const sequelizeErrors = require('../../errors');
const semver = require('semver');
const dataTypes = require('../../data-types');
const moment = require('moment-timezone');
const { promisify } = require('util');

class ConnectionManager extends AbstractConnectionManager {
  constructor(dialect, sequelize) {
    sequelize.config.port = sequelize.config.port || 5432;
    super(dialect, sequelize);

    const pgLib = this._loadDialectModule('pg');
    this.lib = this.sequelize.config.native ? pgLib.native : pgLib;

    this._clearDynamicOIDs();
    this._clearTypeParser();
    this.refreshTypeParser(dataTypes.postgres);
  }

  // Expose this as a method so that the parsing may be updated when the user has added additional, custom types
  _refreshTypeParser(dataType) {
    const arrayParserBuilder = parser => {
      return value => this.lib.types.arrayParser.create(value, parser).parse();
    };
    const rangeParserBuilder = parser => {
      return value => dataType.parse(value, { parser });
    };

    // Set range parsers
    if (dataType.key.toLowerCase() === 'range') {
      for (const name in this.nameOidMap) {
        const entry = this.nameOidMap[name];
        if (! entry.rangeOid) continue;

        const rangeParser = rangeParserBuilder(this.getTypeParser(entry.oid));
        const arrayRangeParser = arrayParserBuilder(rangeParser);

        this.oidParserMap.set(entry.rangeOid, rangeParser);
        if (! entry.arrayRangeOid) continue;
        this.oidParserMap.set(entry.arrayRangeOid, arrayRangeParser);
      }
      return;
    }

    // Create parsers for normal or enum data types
    const parser = value => dataType.parse(value);
    const arrayParser = arrayParserBuilder(parser);

    // Set enum parsers
    if (dataType.key.toLowerCase() === 'enum') {
      this.enumOids.oids.forEach(oid => {
        this.oidParserMap.set(oid, parser);
      });
      this.enumOids.arrayOids.forEach(arrayOid => {
        this.oidParserMap.set(arrayOid, arrayParser);
      });
      return;
    }

    // Set parsers for normal data types
    dataType.types.postgres.forEach(name => {
      if (! this.nameOidMap[name]) return;
      this.oidParserMap.set(this.nameOidMap[name].oid, parser);

      if (! this.nameOidMap[name].arrayOid) return;
      this.oidParserMap.set(this.nameOidMap[name].arrayOid, arrayParser);
    });
  }

  _clearTypeParser() {
    this.oidParserMap = new Map();
  }

  getTypeParser(oid, ...args) {
    if (this.oidParserMap.get(oid)) return this.oidParserMap.get(oid);

    return this.lib.types.getTypeParser(oid, ...args);
  }

  async connect(config) {
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
          // object format: [https://github.com/brianc/node-postgres/blob/ee19e74ffa6309c9c5e8e01746261a8f651661f8/lib/connection.js#L79]
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
          'statement_timeout',
          // Terminate any session with an open transaction that has been idle for longer than the specified duration in milliseconds. Added in pg v7.17.0 only supported in postgres >= 10
          'idle_in_transaction_session_timeout'
        ]));
    }

    const connection = await new Promise((resolve, reject) => {
      let responded = false;

      const connection = new this.lib.Client(connectionConfig);

      const parameterHandler = message => {
        switch (message.parameterName) {
          case 'server_version':
            if (this.sequelize.options.databaseVersion === 0) {
              const version = semver.coerce(message.parameterValue).version;
              this.sequelize.options.databaseVersion = semver.valid(version)
                ? version
                : this.dialect.defaultVersion;
            }
            break;
          case 'standard_conforming_strings':
            connection['standard_conforming_strings'] = message.parameterValue;
            break;
        }
      };

      const endHandler = () => {
        debug('connection timeout');
        if (!responded) {
          reject(new sequelizeErrors.ConnectionTimedOutError(new Error('Connection timed out')));
        }
      };

      // If we didn't ever hear from the client.connect() callback the connection timeout
      // node-postgres does not treat this as an error since no active query was ever emitted
      connection.once('end', endHandler);

      if (!this.sequelize.config.native) {
        // Receive various server parameters for further configuration
        connection.connection.on('parameterStatus', parameterHandler);
      }

      connection.connect(err => {
        responded = true;

        if (!this.sequelize.config.native) {
          // remove parameter handler
          connection.connection.removeListener('parameterStatus', parameterHandler);
        }

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
        } else {
          debug('connection acquired');
          connection.removeListener('end', endHandler);
          resolve(connection);
        }
      });
    });

    let query = '';

    if (this.sequelize.options.standardConformingStrings !== false && connection['standard_conforming_strings'] !== 'on') {
      // Disable escape characters in strings
      // see https://github.com/sequelize/sequelize/issues/3545 (security issue)
      // see https://www.postgresql.org/docs/current/static/runtime-config-compatible.html#GUC-STANDARD-CONFORMING-STRINGS
      query += 'SET standard_conforming_strings=on;';
    }

    if (this.sequelize.options.clientMinMessages !== false) {
      query += `SET client_min_messages TO ${this.sequelize.options.clientMinMessages};`;
    }

    if (!this.sequelize.config.keepDefaultTimezone) {
      const isZone = !!moment.tz.zone(this.sequelize.options.timezone);
      if (isZone) {
        query += `SET TIME ZONE '${this.sequelize.options.timezone}';`;
      } else {
        query += `SET TIME ZONE INTERVAL '${this.sequelize.options.timezone}' HOUR TO MINUTE;`;
      }
    }

    if (query) {
      await connection.query(query);
    }
    if (Object.keys(this.nameOidMap).length === 0 &&
      this.enumOids.oids.length === 0 &&
      this.enumOids.arrayOids.length === 0) {
      await this._refreshDynamicOIDs(connection);
    }
    // Don't let a Postgres restart (or error) to take down the whole app
    connection.on('error', error => {
      connection._invalid = true;
      debug(`connection error ${error.code || error.message}`);
      this.pool.destroy(connection);
    });

    return connection;
  }

  async disconnect(connection) {
    if (connection._ending) {
      debug('connection tried to disconnect but was already at ENDING state');
      return;
    }

    return await promisify(callback => connection.end(callback))();
  }

  validate(connection) {
    return !connection._invalid && !connection._ending;
  }

  async _refreshDynamicOIDs(connection) {
    const databaseVersion = this.sequelize.options.databaseVersion;
    const supportedVersion = '8.3.0';

    // Check for supported version
    if ( (databaseVersion && semver.gte(databaseVersion, supportedVersion)) === false) {
      return;
    }

    const results = await (connection || this.sequelize).query(
      'WITH ranges AS (' +
      '  SELECT pg_range.rngtypid, pg_type.typname AS rngtypname,' +
      '         pg_type.typarray AS rngtyparray, pg_range.rngsubtype' +
      '    FROM pg_range LEFT OUTER JOIN pg_type ON pg_type.oid = pg_range.rngtypid' +
      ')' +
      'SELECT pg_type.typname, pg_type.typtype, pg_type.oid, pg_type.typarray,' +
      '       ranges.rngtypname, ranges.rngtypid, ranges.rngtyparray' +
      '  FROM pg_type LEFT OUTER JOIN ranges ON pg_type.oid = ranges.rngsubtype' +
      ' WHERE (pg_type.typtype IN(\'b\', \'e\'));'
    );

    let result = Array.isArray(results) ? results.pop() : results;

    // When searchPath is prepended then two statements are executed and the result is
    // an array of those two statements. First one is the SET search_path and second is
    // the SELECT query result.
    if (Array.isArray(result)) {
      if (result[0].command === 'SET') {
        result = result.pop();
      }
    }

    const newNameOidMap = {};
    const newEnumOids = { oids: [], arrayOids: [] };

    for (const row of result.rows) {
      // Mapping enums, handled separatedly
      if (row.typtype === 'e') {
        newEnumOids.oids.push(row.oid);
        if (row.typarray) newEnumOids.arrayOids.push(row.typarray);
        continue;
      }

      // Mapping base types and their arrays
      newNameOidMap[row.typname] = { oid: row.oid };
      if (row.typarray) newNameOidMap[row.typname].arrayOid = row.typarray;

      // Mapping ranges(of base types) and their arrays
      if (row.rngtypid) {
        newNameOidMap[row.typname].rangeOid = row.rngtypid;
        if (row.rngtyparray) newNameOidMap[row.typname].arrayRangeOid = row.rngtyparray;
      }
    }

    // Replace all OID mappings. Avoids temporary empty OID mappings.
    this.nameOidMap = newNameOidMap;
    this.enumOids = newEnumOids;

    this.refreshTypeParser(dataTypes.postgres);
  }

  _clearDynamicOIDs() {
    this.nameOidMap = {};
    this.enumOids = { oids: [], arrayOids: [] };
  }
}

module.exports = ConnectionManager;
module.exports.ConnectionManager = ConnectionManager;
module.exports.default = ConnectionManager;
