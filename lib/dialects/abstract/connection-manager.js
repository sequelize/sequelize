'use strict';

const Pooling = require('generic-pool');
const Promise = require('../../promise');
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

    config.pool = _.defaults(config.pool || {}, defaultPoolingConfig, {
      validate: this._validate.bind(this),
      Promise
    });

    this.initPools();
  }

  refreshTypeParser(dataTypes) {
    _.each(dataTypes, dataType => {
      if (dataType.hasOwnProperty('parse')) {
        if (dataType.types[this.dialectName]) {
          this._refreshTypeParser(dataType);
        } else {
          throw new Error('Parse function not supported for type ' + dataType.key + ' in dialect ' + this.dialectName);
        }
      }
    });
  }

  /**
   * Handler which executes on process exit or connection manager shutdown
   *
   * @private
   * @return {Promise}
   */
  _onProcessExit() {
    if (!this.pool) {
      return Promise.resolve();
    }

    return this.pool.drain().then(() => {
      debug('connection drain due to process exit');
      return this.pool.clear();
    });
  }

  /**
   * Drain the pool and close it permanently
   *
   * @return {Promise}
   */
  close() {
    // Mark close of pool
    this.getConnection = function getConnection() {
      return Promise.reject(new Error('ConnectionManager.getConnection was called after the connection manager was closed!'));
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
      this.pool = Pooling.createPool({
        create: () => this._connect(config).catch(err => err),
        destroy: mayBeConnection => {
          if (mayBeConnection instanceof Error) {
            return Promise.resolve();
          }

          return this._disconnect(mayBeConnection)
            .tap(() => { debug('connection destroy'); });
        },
        validate: config.pool.validate
      }, {
        Promise: config.pool.Promise,
        testOnBorrow: true,
        returnToHead: true,
        autostart: false,
        max: config.pool.max,
        min: config.pool.min,
        acquireTimeoutMillis: config.pool.acquire,
        idleTimeoutMillis: config.pool.idle,
        evictionRunIntervalMillis: config.pool.evict
      });

      debug(`pool created with max/min: ${config.pool.max}/${config.pool.min}, no replication`);

      return;
    }

    let reads = 0;

    if (!Array.isArray(config.replication.read)) {
      config.replication.read = [config.replication.read];
    }

    // Map main connection config
    config.replication.write = _.defaults(config.replication.write, _.omit(config, 'replication'));

    // Apply defaults to each read config
    config.replication.read = _.map(config.replication.read, readConfig =>
      _.defaults(readConfig, _.omit(this.config, 'replication'))
    );

    // custom pooling for replication (original author @janmeier)
    this.pool = {
      release: client => {
        if (client.queryType === 'read') {
          return this.pool.read.release(client);
        } else {
          return this.pool.write.release(client);
        }
      },
      acquire: (priority, queryType, useMaster) => {
        useMaster = _.isUndefined(useMaster) ? false : useMaster;
        if (queryType === 'SELECT' && !useMaster) {
          return this.pool.read.acquire(priority)
            .then(mayBeConnection => this._determineConnection(mayBeConnection));
        } else {
          return this.pool.write.acquire(priority)
            .then(mayBeConnection => this._determineConnection(mayBeConnection));
        }
      },
      destroy: mayBeConnection => {
        if (mayBeConnection instanceof Error) {
          return Promise.resolve();
        }

        return this.pool[mayBeConnection.queryType].destroy(mayBeConnection)
          .tap(() => { debug('connection destroy'); });
      },
      clear: () => {
        return Promise.join(
          this.pool.read.clear(),
          this.pool.write.clear()
        ).tap(() => { debug('all connection clear'); });
      },
      drain: () => {
        return Promise.join(
          this.pool.write.drain(),
          this.pool.read.drain()
        );
      },
      read: Pooling.createPool({
        create: () => {
          const nextRead = reads++ % config.replication.read.length; // round robin config
          return this
            ._connect(config.replication.read[nextRead])
            .tap(connection => {
              connection.queryType = 'read';
            })
            .catch(err => err);
        },
        destroy: connection => this._disconnect(connection),
        validate: config.pool.validate
      }, {
        Promise: config.pool.Promise,
        testOnBorrow: true,
        returnToHead: true,
        autostart: false,
        max: config.pool.max,
        min: config.pool.min,
        acquireTimeoutMillis: config.pool.acquire,
        idleTimeoutMillis: config.pool.idle,
        evictionRunIntervalMillis: config.pool.evict
      }),
      write: Pooling.createPool({
        create: () => {
          return this
            ._connect(config.replication.write)
            .tap(connection => {
              connection.queryType = 'write';
            })
            .catch(err => err);
        },
        destroy: connection => this._disconnect(connection),
        validate: config.pool.validate
      }, {
        Promise: config.pool.Promise,
        testOnBorrow: true,
        returnToHead: true,
        autostart: false,
        max: config.pool.max,
        min: config.pool.min,
        acquireTimeoutMillis: config.pool.acquire,
        idleTimeoutMillis: config.pool.idle,
        evictionRunIntervalMillis: config.pool.evict
      })
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
  getConnection(options) {
    options = options || {};

    let promise;
    if (this.sequelize.options.databaseVersion === 0) {
      if (this.versionPromise) {
        promise = this.versionPromise;
      } else {
        promise = this.versionPromise = this._connect(this.config.replication.write || this.config)
          .then(connection => {
            const _options = {};

            _options.transaction = {connection}; // Cheat .query to use our private connection
            _options.logging = () => {};
            _options.logging.__testLoggingFn = true;

            return this.sequelize.databaseVersion(_options).then(version => {
              this.sequelize.options.databaseVersion = semver.valid(version) ? version : this.defaultVersion;
              this.versionPromise = null;

              return this._disconnect(connection);
            });
          }).catch(err => {
            this.versionPromise = null;
            throw err;
          });
      }
    } else {
      promise = Promise.resolve();
    }

    return promise.then(() => {
      return this.pool.acquire(options.priority, options.type, options.useMaster)
        .then(mayBeConnection => this._determineConnection(mayBeConnection))
        .tap(() => { debug('connection acquired'); });
    });
  }

  /**
   * Release a pooled connection so it can be utilized by other connection requests
   *
   * @param {Connection} connection
   *
   * @return {Promise}
   */
  releaseConnection(connection) {
    return this.pool.release(connection)
      .tap(() => { debug('connection released'); })
      .catch(/Resource not currently part of this pool/, () => {});
  }

  /**
   * Check if something acquired by pool is indeed a connection but not an Error instance
   * Why we need to do this https://github.com/sequelize/sequelize/pull/8330
   *
   * @param {Object|Error} mayBeConnection Object which can be either connection or error
   *
   * @retun {Promise<Connection>}
   */
  _determineConnection(mayBeConnection) {
    if (mayBeConnection instanceof Error) {
      return Promise.resolve(this.pool.destroy(mayBeConnection))
        .catch(/Resource not currently part of this pool/, () => {})
        .then(() => { throw mayBeConnection; });
    }

    return Promise.resolve(mayBeConnection);
  }

  /**
   * Call dialect library to get connection
   *
   * @param {*} config Connection config
   * @private
   * @return {Promise<Connection>}
   */
  _connect(config) {
    return this.sequelize.runHooks('beforeConnect', config)
      .then(() => this.dialect.connectionManager.connect(config))
      .then(connection => this.sequelize.runHooks('afterConnect', connection, config).return(connection));
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
