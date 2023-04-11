import cloneDeep from 'lodash/cloneDeep';
import semver from 'semver';
import { TimeoutError } from 'sequelize-pool';
import { ConnectionAcquireTimeoutError } from '../../errors';
import type { ConnectionOptions, Dialect, Sequelize } from '../../sequelize.js';
import { isNodeError } from '../../utils/check.js';
import * as deprecations from '../../utils/deprecations';
import { logger } from '../../utils/logger';
import { ReplicationPool } from './replication-pool.js';
import type { AbstractDialect } from './index.js';

const debug = logger.debugContext('connection-manager');

export interface GetConnectionOptions {
  /**
   * Set which replica to use. Available options are `read` and `write`
   */
  type: 'read' | 'write';

  /**
   * Force master or write replica to get connection from
   */
  useMaster?: boolean;

  /**
   * ID of the connection.
   */
  uuid?: string | 'default';
}

export interface Connection {
  /** custom property we attach to different dialect connections */
  // TODO: replace with Symbols.
  uuid?: string | undefined;
}

/**
 * Abstract Connection Manager
 *
 * Connection manager which handles pooling & replication.
 * Uses sequelize-pool for pooling
 *
 * @param connection
 * @private
 */
export class AbstractConnectionManager<TConnection extends Connection = Connection> {
  protected readonly sequelize: Sequelize;
  protected readonly config: Sequelize['config'];
  protected readonly dialect: AbstractDialect;
  protected readonly dialectName: Dialect;
  readonly pool: ReplicationPool<TConnection>;

  #versionPromise: Promise<void> | null = null;
  #closed: boolean = false;

  constructor(dialect: AbstractDialect, sequelize: Sequelize) {
    const config: Sequelize['config'] = cloneDeep(sequelize.config);

    this.sequelize = sequelize;
    this.config = config;
    this.dialect = dialect;
    this.dialectName = this.sequelize.options.dialect;

    // ===========================================================
    // Init Pool
    // ===========================================================

    this.pool = new ReplicationPool<TConnection>({
      ...config,
      connect: async (options: ConnectionOptions): Promise<TConnection> => {
        return this._connect(options);
      },
      disconnect: async (connection: TConnection): Promise<void> => {
        return this._disconnect(connection);
      },
      validate: (connection: TConnection): boolean => {
        if (config.pool.validate) {
          return config.pool.validate(connection);
        }

        return this.validate(connection);
      },
      readConfig: config.replication.read,
      writeConfig: config.replication.write,
    });

    if (config.replication.read.length > 0) {
      debug(`pool created with max/min: ${config.pool.max}/${config.pool.min}, no replication`);
    } else {
      debug(`pool created with max/min: ${config.pool.max}/${config.pool.min}, with replication`);
    }
  }

  get isClosed() {
    return this.#closed;
  }

  /**
   * Determine if a connection is still valid or not
   *
   * @param _connection
   */
  validate(_connection: TConnection): boolean {
    return true;
  }

  async connect(_config: ConnectionOptions): Promise<TConnection> {
    throw new Error(`connect not implemented in ${this.constructor.name}`);
  }

  async disconnect(_connection: TConnection): Promise<void> {
    throw new Error(`disconnect not implemented in ${this.constructor.name}`);
  }

  /**
   * Try to load dialect module from various configured options.
   * Priority goes like dialectModulePath > dialectModule > require(default)
   *
   * @param moduleName Name of dialect module to lookup
   *
   * @private
   */
  _loadDialectModule(moduleName: string): unknown {
    try {
      if (this.sequelize.config.dialectModulePath) {
        return require(this.sequelize.config.dialectModulePath);
      }

      if (this.sequelize.config.dialectModule) {
        return this.sequelize.config.dialectModule;
      }

      return require(moduleName);
    } catch (error) {
      if (isNodeError(error) && error.code === 'MODULE_NOT_FOUND') {
        if (this.sequelize.config.dialectModulePath) {
          throw new Error(`Unable to find dialect at ${this.sequelize.config.dialectModulePath}`);
        }

        throw new Error(`Please install ${moduleName} package manually`);
      }

      throw error;
    }
  }

  /**
   * Handler which executes on process exit or connection manager shutdown
   */
  async _onProcessExit() {
    if (!this.pool) {
      return;
    }

    await this.pool.drain();
    debug('connection drain due to process exit');

    await this.pool.destroyAllNow();
  }

  /**
   * Drain the pool and close it permanently
   */
  async close() {
    this.#closed = true;

    // Mark close of pool
    this.getConnection = async function getConnection() {
      throw new Error('ConnectionManager.getConnection was called after the connection manager was closed!');
    };

    return this._onProcessExit();
  }

  /**
   * Get connection from pool. It sets database version if it's not already set.
   * Call pool.acquire to get a connection.
   *
   * @param options
   */
  async getConnection(options?: GetConnectionOptions) {
    await this._initDatabaseVersion();

    try {

      await this.sequelize.hooks.runAsync('beforePoolAcquire', options);

      const result = await this.pool.acquire(options?.type, options?.useMaster);

      await this.sequelize.hooks.runAsync('afterPoolAcquire', result, options);

      debug('connection acquired');

      return result;
    } catch (error) {
      if (error instanceof TimeoutError) {
        throw new ConnectionAcquireTimeoutError(error);
      }

      throw error;
    }
  }

  async _initDatabaseVersion(conn?: TConnection) {
    if (this.sequelize.options.databaseVersion != null) {
      return;
    }

    if (this.#versionPromise) {
      await this.#versionPromise;

      return;
    }

    this.#versionPromise = (async () => {
      try {
        const connection = conn ?? await this._connect(this.config.replication.write || this.config);

        const version = await this.sequelize.fetchDatabaseVersion({
          logging: false,
          // we must use the current connection for this, otherwise it will try to create a
          // new connection, which will try to initialize the database version again, and loop forever
          connection,
        });

        const parsedVersion = semver.coerce(version)?.version || version;
        this.sequelize.options.databaseVersion = semver.valid(parsedVersion)
          ? parsedVersion
          : this.dialect.defaultVersion;

        if (semver.lt(this.sequelize.getDatabaseVersion(), this.dialect.defaultVersion)) {
          deprecations.unsupportedEngine();
          debug(`Unsupported database engine version ${this.sequelize.getDatabaseVersion()}`);
        }

        return await this._disconnect(connection);
      } finally {
        this.#versionPromise = null;
      }
    })();

    await this.#versionPromise;
  }

  /**
   * Release a pooled connection so it can be utilized by other connection requests
   *
   * @param connection
   */
  releaseConnection(connection: TConnection) {
    this.pool.release(connection);
    debug('connection released');
  }

  /**
   * Destroys a pooled connection and removes it from the pool.
   *
   * @param connection
   */
  async destroyConnection(connection: TConnection) {
    await this.pool.destroy(connection);
    debug(`connection ${connection.uuid} destroyed`);
  }

  /**
   * Call dialect library to get connection
   *
   * @param config Connection config
   */
  protected async _connect(config: ConnectionOptions): Promise<TConnection> {
    await this.sequelize.hooks.runAsync('beforeConnect', config);
    const connection = await this.connect(config);
    await this.sequelize.hooks.runAsync('afterConnect', connection, config);

    return connection;
  }

  /**
   * Call dialect library to disconnect a connection
   *
   * @param connection
   */
  protected async _disconnect(connection: TConnection) {
    await this.sequelize.hooks.runAsync('beforeDisconnect', connection);
    await this.disconnect(connection);
    await this.sequelize.hooks.runAsync('afterDisconnect', connection);
  }
}
