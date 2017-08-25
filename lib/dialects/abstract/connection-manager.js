'use strict';

const Pooling = require('generic-pool');
const Promise = require('../../promise');
const _ = require('lodash');
const Utils = require('../../utils');
const debug = Utils.getLogger().debugContext('pool');
const semver = require('semver');
const timers = require('timers');

const defaultPoolingConfig = {
  max: 5,
  min: 0,
  idle: 10000,
  acquire: 10000,
  evict: 60000,
  handleDisconnects: true
};

class ConnectionManager {
  constructor(dialect, sequelize) {
    const config = _.cloneDeep(sequelize.config);

    this.sequelize = sequelize;
    this.config = config;
    this.dialect = dialect;
    this.versionPromise = null;
    this.poolError = null;
    this.dialectName = this.sequelize.options.dialect;

    if (config.pool === false) {
      throw new Error('Support for pool:false was removed in v4.0');
    }

    config.pool =_.defaults(config.pool || {}, defaultPoolingConfig, {
      validate: this._validate.bind(this),
      Promise
    }) ;

    // Save a reference to the bound version so we can remove it with removeListener
    this.onProcessExit = this.onProcessExit.bind(this);

    process.on('exit', this.onProcessExit);

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

  onProcessExit() {
    if (!this.pool) {
      return Promise.resolve();
    }

    return this.pool.drain().then(() => {
      debug('connection drain due to process exit');
      return this.pool.clear();
    });
  }

  close() {
    // Remove the listener, so all references to this instance can be garbage collected.
    process.removeListener('exit', this.onProcessExit);

    // Mark close of pool
    this.getConnection = function getConnection() {
      return Promise.reject(new Error('ConnectionManager.getConnection was called after the connection manager was closed!'));
    };

    return this.onProcessExit();
  }

  initPools() {
    const config = this.config;

    if (!config.replication) {
      this.pool = Pooling.createPool({
        create: () => new Promise(resolve => {
          this
            ._connect(config)
            .tap(() => {
              this.poolError = null;
            })
            .then(resolve)
            .catch(e => {
              // dont throw otherwise pool will release _dispense call
              // which will call _connect even if error is fatal
              // https://github.com/coopernurse/node-pool/issues/161
              this.poolError = e;
            });
        }),
        destroy: connection => {
          return this._disconnect(connection).tap(() => {
            debug('connection destroy');
          });
        },
        validate: config.pool.validate
      }, {
        Promise: config.pool.Promise,
        max: config.pool.max,
        min: config.pool.min,
        testOnBorrow: true,
        autostart: false,
        acquireTimeoutMillis: config.pool.acquire,
        idleTimeoutMillis: config.pool.idle,
        evictionRunIntervalMillis: config.pool.evict
      });

      this.pool.on('factoryCreateError', error => {
        this.poolError = error;
      });

      debug(`pool created max/min: ${config.pool.max}/${config.pool.min} with no replication`);
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
          return this.pool.read.acquire(priority);
        } else {
          return this.pool.write.acquire(priority);
        }
      },
      destroy: connection => {
        debug('connection destroy');
        return this.pool[connection.queryType].destroy(connection);
      },
      clear: () => {
        debug('all connection clear');
        return Promise.join(
          this.pool.read.clear(),
          this.pool.write.clear()
        );
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
          return new Promise(resolve => {
            this
              ._connect(config.replication.read[nextRead])
              .tap(connection => {
                connection.queryType = 'read';
                this.poolError = null;
                resolve(connection);
              })
              .catch(e => {
                this.poolError = e;
              });
          });
        },
        destroy: connection => {
          return this._disconnect(connection);
        },
        validate: config.pool.validate
      }, {
        Promise: config.pool.Promise,
        max: config.pool.max,
        min: config.pool.min,
        testOnBorrow: true,
        autostart: false,
        acquireTimeoutMillis: config.pool.acquire,
        idleTimeoutMillis: config.pool.idle,
        evictionRunIntervalMillis: config.pool.evict
      }),
      write: Pooling.createPool({
        create: () => new Promise(resolve => {
          this
            ._connect(config.replication.write)
            .then(connection => {
              connection.queryType = 'write';
              this.poolError = null;
              return resolve(connection);
            })
            .catch(e => {
              this.poolError = e;
            });
        }),
        destroy: connection => {
          return this._disconnect(connection);
        },
        validate: config.pool.validate
      }, {
        Promise: config.pool.Promise,
        max: config.pool.max,
        min: config.pool.min,
        testOnBorrow: true,
        autostart: false,
        acquireTimeoutMillis: config.pool.acquire,
        idleTimeoutMillis: config.pool.idle,
        evictionRunIntervalMillis: config.pool.evict
      })
    };

    this.pool.read.on('factoryCreateError', error => {
      this.poolError = error;
    });

    this.pool.write.on('factoryCreateError', error => {
      this.poolError = error;
    });
  }

  getConnection(options) {
    options = options || {};

    let promise;
    if (this.sequelize.options.databaseVersion === 0) {
      if (this.versionPromise) {
        promise = this.versionPromise;
      } else {
        promise = this.versionPromise = this._connect(this.config.replication.write || this.config).then(connection => {
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
      return Promise.race([
        this.pool.acquire(options.priority, options.type, options.useMaster),
        new Promise((resolve, reject) =>
          timers.setTimeout(() => {
            if (this.poolError) {
              reject(this.poolError);
            }
          }, 0))
      ])
        .tap(() => { debug('connection acquired'); })
        .catch(e => {
          e = this.poolError || e;
          this.poolError = null;
          throw e;
        });
    });
  }

  releaseConnection(connection) {
    return this.pool.release(connection).tap(() => {
      debug('connection released');
    });
  }

  _connect(config) {
    return this.sequelize.runHooks('beforeConnect', config)
      .then(() => this.dialect.connectionManager.connect(config))
      .then(connection => this.sequelize.runHooks('afterConnect', connection, config).return(connection));
  }

  _disconnect(connection) {
    return this.dialect.connectionManager.disconnect(connection);
  }

  _validate(connection) {
    if (!this.dialect.connectionManager.validate) return true;
    return this.dialect.connectionManager.validate(connection);
  }
}

module.exports = ConnectionManager;
module.exports.ConnectionManager = ConnectionManager;
module.exports.default = ConnectionManager;
