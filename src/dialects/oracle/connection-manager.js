// Copyright (c) 2022, Oracle and/or its affiliates. All rights reserved

'use strict';

const AbstractConnectionManager = require('../abstract/connection-manager');
const SequelizeErrors = require('../../errors');
const parserStore = require('../parserStore')('oracle');
const { logger } = require('../../utils/logger');
const semver = require('semver');
const debug = logger.debugContext('connection:oracle');
const DataTypes = require('../../data-types').oracle;
const { promisify } = require('util');
/**
 * Oracle Connection Manager
 *
 * Get connections, validate and disconnect them.
 * AbstractConnectionManager pooling use it to handle Oracle specific connections
 * Use github.com/oracle/node-oracledb to connect with Oracle server
 *
 * @private
 */
export class OracleConnectionManager extends AbstractConnectionManager {
  constructor(dialect, sequelize) {
    super(dialect, sequelize);

    this.sequelize = sequelize;
    this.sequelize.config.port = this.sequelize.config.port || 1521;
    this.lib = this._loadDialectModule('oracledb');
    this.extendLib();
    this.refreshTypeParser(DataTypes);
  }

  /**
   * Method for initializing the lib
   *
   */
  extendLib() {
    this.lib.maxRows = 1000;
    if (this.sequelize.config && 'dialectOptions' in this.sequelize.config) {
      const dialectOptions = this.sequelize.config.dialectOptions;
      if (dialectOptions && 'maxRows' in dialectOptions) {
        this.lib.maxRows = this.sequelize.config.dialectOptions.maxRows;
      }
      if (dialectOptions && 'fetchAsString' in dialectOptions) {
        this.lib.fetchAsString = this.sequelize.config.dialectOptions.fetchAsString;
      } else {
        this.lib.fetchAsString = [this.lib.CLOB];
      }
    }
    // Retrieve BLOB always as Buffer.
    this.lib.fetchAsBuffer = [this.lib.BLOB];
  }

  /**
   * Method for checking the config object passed and generate the full database if not fully passed
   * With dbName, host and port, it generates a string like this : 'host:port/dbname'
   *
   * @param {object} config
   * @returns {Promise<Connection>}
   * @private
   */
  checkConfigObject(config) {
    // A connectString should be defined
    if (config.database.length === 0) {
      let errorToThrow =
        'The database cannot be blank, you must specify the database name (which correspond to the service name';
      errorToThrow += '\n from tnsnames.ora : (HOST = mymachine.example.com)(PORT = 1521)(SERVICE_NAME = orcl)';
      throw new Error(errorToThrow);
    }

    if (!config.host || config.host.length === 0) {
      throw new Error('You have to specify the host');
    }

    // The connectString has a special format, we check it
    // ConnectString format is : host:[port]/service_name
    if (config.database.indexOf('/') === -1) {
      let connectString = config.host;

      if (config.port && config.port !== 0) {
        connectString += `:${config.port}`;
      } else {
        connectString += ':1521'; //Default port number
      }
      connectString += `/${config.database}`;
      config.database = connectString;
    }
  }

  // Expose this as a method so that the parsing may be updated when the user has added additional, custom types
  _refreshTypeParser(dataType) {
    parserStore.refresh(dataType);
  }

  _clearTypeParser() {
    parserStore.clear();
  }

  /**
   * Connect with Oracle database based on config, Handle any errors in connection
   * Set the pool handlers on connection.error
   * Also set proper timezone once connection is connected.
   *
   * @param {object} config
   * @returns {Promise<Connection>}
   * @private
   */
  async connect(config) {
    const connectionConfig = {
      user: config.username,
      host: config.host,
      port: config.port,
      database: config.database,
      password: config.password,
      externalAuth: config.externalAuth,
      stmtCacheSize: 0,
      connectString: config.database,
      ...config.dialectOptions
    };

    try {
      // Check the config object
      this.checkConfigObject(connectionConfig);

      // We assume that the database has been correctly formed
      connectionConfig.connectString = connectionConfig.database;

      // We check if there are dialect options
      if (config.dialectOptions) {
        Object.keys(config.dialectOptions).forEach(key => {
          connectionConfig[key] = config.dialectOptions[key];
        });
      }

      const connection = await this.lib.getConnection(connectionConfig);
      // Setting the sequelize database version to Oracle DB server version to remove the roundtrip for DB version query
      this.sequelize.options.databaseVersion = semver.coerce(connection.oracleServerVersionString).version;

      debug('connection acquired');
      connection.on('error', error => {
        switch (error.code) {
          case 'ESOCKET':
          case 'ECONNRESET':
          case 'EPIPE':
          case 'PROTOCOL_CONNECTION_LOST':
            this.pool.destroy(connection);
        }
      });

      return connection;
    } catch (err) {
      // We split to get the error number; it comes as ORA-XXXXX:
      let errorCode = err.message.split(':');
      errorCode = errorCode[0];

      switch (errorCode) {
        case 'ORA-12560': // ORA-12560: TNS: Protocol Adapter Error
        case 'ORA-12154': // ORA-12154: TNS: Could not resolve the connect identifier specified
        case 'ORA-12505': // ORA-12505: TNS: Listener does not currently know of SID given in connect descriptor
        case 'ORA-12514': // ORA-12514: TNS: Listener does not currently know of service requested in connect descriptor
          throw new SequelizeErrors.ConnectionRefusedError(err);
        case 'ORA-28000': // ORA-28000: Account locked
        case 'ORA-28040': // ORA-28040: No matching authentication protocol
        case 'ORA-01017': // ORA-01017: invalid username/password; logon denied
          throw new SequelizeErrors.AccessDeniedError(err);
        case 'ORA-12541': // ORA-12541: TNS: No listener
          throw new SequelizeErrors.HostNotReachableError(err);
        case 'ORA-12170': // ORA-12170: TNS: Connect Timeout occurred
          throw new SequelizeErrors.ConnectionTimedOutError(err);
        default:
          throw new SequelizeErrors.ConnectionError(err);
      }
    }
  }

  async disconnect(connection) {
    if (!connection.isHealthy()) {
      debug('connection tried to disconnect but was already at CLOSED state');
      return;
    }

    return await promisify(callback => connection.close(callback))();
  }

  /**
   * Checking if the connection object is valid and the connection is healthy
   *
   * @param {object} connection
   * @private
   */
  validate(connection) {
    return connection && connection.isHealthy();
  }
}
