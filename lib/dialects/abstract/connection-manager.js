'use strict';

const Pooling = require('generic-pool');
const _ = require('lodash');
const Utils = require('../../utils');
const debug = Utils.getLogger().debugContext('pool');
const semver = require('semver');

const defaultPoolingConfig = {
  max: 5,
  min: 0,
  idle: 10000,
  acquire: 10000,
  evict: 10000,
  handleDisconnects: true
};

/**
 * Abstract Connection Manager
 *
 * Connection manager which handles pool, replication and determining database version
 * Works with generic-pool to maintain connection pool
 *
 * @private
 */
class ConnectionManager {
  constructor(dialect, sequelize) {
    const config = _.cloneDeep(sequelize.config);

    this.sequelize = sequelize;
    this.config = config;
    this.dialect = dialect;
    this.versionPromise = null;
    this.dialectName = this.sequelize.options.dialect;

    if (config.pool === false) {
      throw new Error('Support for pool:false was removed in v4.0');
    }

    config.pool = Object.assign(
      {
        validate: this._validate.bind(this),
        Promise
      },
      defaultPoolingConfig,
      config.pool || {}
    );

    this.initPools();
  }

  refreshTypeParser(dataTypes) {
    Object.values(dataTypes).forEach((dataType) => {
      if (Object.hasOwn(dataType, 'parse')) {
        if (dataType.types[this.dialectName]) {
          this._refreshTypeParser(dataType);
        } else {
          throw new Error('Parse function not supported for type ' + dataType.key + ' in dialect ' + this.dialectName);
        }
      }
    });
  }

  /**
   * Register a dialect-specific parser for a single data type. Implemented by
   * each dialect's connection manager.
   *
   * @param {DataType} _dataType
   * @private
   * @abstract
   */
  _refreshTypeParser(_dataType) {
    throw new Error(`_refreshTypeParser not implemented in dialect ${this.dialectName}`);
  }

  /**
   * Handler which executes on process exit or connection manager shutdown
   *
   * @private
   * @return {Promise}
   */
  async _onProcessExit() {
    if (!this.pool) {
      return;
    }

    await this.pool.drain();

    debug('connection drain due to process exit');

    return this.pool.clear();
  }

  /**
   * Drain the pool and close it permanently
   *
   * @return {Promise}
   */
  close() {
    // Mark close of pool
    this.getConnection = function getConnection() {
      return Promise.reject(
        new Error('ConnectionManager.getConnection was called after the connection manager was closed!')
      );
    };

    return this._onProcessExit();
  }

  /**
   * Initialize connection pool. By default pool autostart is set to false, so no connection will be
   * be created unless `pool.acquire` is called.
   */
  initPools() {
    const config = this.config;

    if (!config.replication) {
      this.pool = Pooling.createPool(
        {
          create: () => this._connect(config).catch((err) => err),
          destroy: async (mayBeConnection) => {
            if (mayBeConnection instanceof Error) {
              return;
            }

            const result = await this._disconnect(mayBeConnection);
            debug('connection destroy');

            return result;
          },
          validate: config.pool.validate
        },
        {
          Promise: config.pool.Promise,
          testOnBorrow: true,
          returnToHead: true,
          autostart: false,
          max: config.pool.max,
          min: config.pool.min,
          acquireTimeoutMillis: config.pool.acquire,
          idleTimeoutMillis: config.pool.idle,
          evictionRunIntervalMillis: config.pool.evict
        }
      );

      debug(`pool created with max/min: ${config.pool.max}/${config.pool.min}, no replication`);

      return;
    }

    let reads = 0;

    if (!Array.isArray(config.replication.read)) {
      config.replication.read = [config.replication.read];
    }

    const { replication: _replication, ...configWithoutReplication } = config;

    // Map main connection config
    config.replication.write = Object.assign({}, configWithoutReplication, config.replication.write);

    // Apply defaults to each read config
    config.replication.read = config.replication.read.map((readConfig) =>
      Object.assign({}, configWithoutReplication, readConfig)
    );

    // custom pooling for replication (original author @janmeier)
    this.pool = {
      release: (client) => {
        if (client.queryType === 'read') {
          return this.pool.read.release(client);
        } else {
          return this.pool.write.release(client);
        }
      },
      acquire: async (priority, queryType, useMaster) => {
        useMaster = useMaster === undefined ? false : useMaster;
        if (queryType === 'SELECT' && !useMaster) {
          const mayBeConnection = await this.pool.read.acquire(priority);

          return this._determineConnection(mayBeConnection);
        }

        const mayBeConnection = await this.pool.write.acquire(priority);

        return this._determineConnection(mayBeConnection);
      },
      destroy: (mayBeConnection) => {
        if (mayBeConnection.queryType === undefined) {
          return Promise.all([
            this.pool.read.destroy(mayBeConnection).catch((err) => {
              if (!/Resource not currently part of this pool/.test(err.message)) {
                throw err;
              }
            }),
            this.pool.write.destroy(mayBeConnection).catch((err) => {
              if (!/Resource not currently part of this pool/.test(err.message)) {
                throw err;
              }
            })
          ]);
        }

        return this.pool[mayBeConnection.queryType].destroy(mayBeConnection);
      },
      clear: async () => {
        const result = await Promise.all([this.pool.read.clear(), this.pool.write.clear()]);
        debug('all connection clear');

        return result;
      },
      drain: () => {
        return Promise.all([this.pool.write.drain(), this.pool.read.drain()]);
      },
      read: Pooling.createPool(
        {
          create: async () => {
            const nextRead = reads++ % config.replication.read.length; // round robin config
            try {
              const connection = await this._connect(config.replication.read[nextRead]);
              connection.queryType = 'read';

              return connection;
            } catch (err) {
              return err;
            }
          },
          destroy: async (mayBeConnection) => {
            if (mayBeConnection instanceof Error) {
              return;
            }

            const result = await this._disconnect(mayBeConnection);
            debug('connection destroy');

            return result;
          },
          validate: config.pool.validate
        },
        {
          Promise: config.pool.Promise,
          testOnBorrow: true,
          returnToHead: true,
          autostart: false,
          max: config.pool.max,
          min: config.pool.min,
          acquireTimeoutMillis: config.pool.acquire,
          idleTimeoutMillis: config.pool.idle,
          evictionRunIntervalMillis: config.pool.evict
        }
      ),
      write: Pooling.createPool(
        {
          create: async () => {
            try {
              const connection = await this._connect(config.replication.write);
              connection.queryType = 'write';

              return connection;
            } catch (err) {
              return err;
            }
          },
          destroy: async (mayBeConnection) => {
            if (mayBeConnection instanceof Error) {
              return;
            }

            const result = await this._disconnect(mayBeConnection);
            debug('connection destroy');

            return result;
          },
          validate: config.pool.validate
        },
        {
          Promise: config.pool.Promise,
          testOnBorrow: true,
          returnToHead: true,
          autostart: false,
          max: config.pool.max,
          min: config.pool.min,
          acquireTimeoutMillis: config.pool.acquire,
          idleTimeoutMillis: config.pool.idle,
          evictionRunIntervalMillis: config.pool.evict
        }
      )
    };

    debug(`pool created with max/min: ${config.pool.max}/${config.pool.min}, with replication`);
  }

  /**
   * Get connection from pool. It sets database version if it's not already set.
   * Call pool.acquire to get a connection
   *
   * @param {Object}   [options]                 Pool options
   * @param {Integer}  [options.priority]        Set priority for this call. Read more at https://github.com/coopernurse/node-pool#priority-queueing
   * @param {String}   [options.type]            Set which replica to use. Available options are `read` and `write`
   * @param {Boolean}  [options.useMaster=false] Force master or write replica to get connection from
   *
   * @return {Promise<Connection>}
   */
  async getConnection(options) {
    options = options || {};

    if (this.sequelize.options.databaseVersion === 0) {
      if (!this.versionPromise) {
        this.versionPromise = this._checkDatabaseVersion();
      }

      await this.versionPromise;
    }

    const mayBeConnection = await this.pool.acquire(options.priority, options.type, options.useMaster);
    const connection = await this._determineConnection(mayBeConnection);
    debug('connection acquired');

    return connection;
  }

  /**
   * Detect and store the database version using a private connection. Cached via `this.versionPromise`
   * so concurrent `getConnection` callers share a single detection round-trip.
   *
   * @private
   * @return {Promise}
   */
  async _checkDatabaseVersion() {
    let connection;
    try {
      connection = await this._connect(this.config.replication.write || this.config);

      // Some dialects (e.g. Postgres) already learn the server version during connect
      // via connection parameters, so there's no need to spend a round-trip querying it.
      if (this.sequelize.options.databaseVersion === 0) {
        const _options = {};
        _options.transaction = { connection }; // Cheat .query to use our private connection
        _options.logging = () => {};
        _options.logging.__testLoggingFn = true;

        const version = await this.sequelize.databaseVersion(_options);
        const parsedVersion = semver.coerce(version)?.version || version;
        this.sequelize.options.databaseVersion = semver.valid(parsedVersion) ? parsedVersion : this.defaultVersion;
      }

      return connection ? await this._disconnect(connection) : undefined;
    } finally {
      this.versionPromise = null;
    }
  }

  /**
   * Release a pooled connection so it can be utilized by other connection requests
   *
   * @param {Connection} connection
   *
   * @return {Promise}
   */
  async releaseConnection(connection) {
    try {
      const result = await this.pool.release(connection);
      debug('connection released');

      return result;
    } catch (err) {
      if (!/Resource not currently part of this pool/.test(err.message)) {
        throw err;
      }
    }
  }

  /**
   * Check if something acquired by pool is indeed a connection but not an Error instance
   * Why we need to do this https://github.com/sequelize/sequelize/pull/8330
   *
   * @param {Object|Error} mayBeConnection Object which can be either connection or error
   *
   * @return {Promise<Connection>}
   */
  async _determineConnection(mayBeConnection) {
    if (mayBeConnection instanceof Error) {
      try {
        await this.pool.destroy(mayBeConnection);
      } catch (err) {
        if (!/Resource not currently part of this pool/.test(err.message)) {
          throw err;
        }
      }

      throw mayBeConnection;
    }

    return mayBeConnection;
  }

  /**
   * Call dialect library to get connection
   *
   * @param {*} config Connection config
   * @private
   * @return {Promise<Connection>}
   */
  async _connect(config) {
    await this.sequelize.runHooks('beforeConnect', config);
    const connection = await this.dialect.connectionManager.connect(config);
    await this.sequelize.runHooks('afterConnect', connection, config);

    return connection;
  }

  /**
   * Call dialect library to disconnect a connection
   *
   * @param {Connection} connection
   * @private
   * @return {Promise}
   */
  _disconnect(connection) {
    return this.dialect.connectionManager.disconnect(connection);
  }

  /**
   * Determine if a connection is still valid or not
   *
   * @param {Connection} connection
   *
   * @return {Boolean}
   */
  _validate(connection) {
    if (!this.dialect.connectionManager.validate) {
      return true;
    }

    return this.dialect.connectionManager.validate(connection);
  }
}

module.exports = ConnectionManager;
module.exports.ConnectionManager = ConnectionManager;
module.exports.default = ConnectionManager;
