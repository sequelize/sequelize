import { pojo, shallowClonePojo } from '@sequelize/utils';
import { Pool, TimeoutError } from 'sequelize-pool';
import type { Class } from 'type-fest';
import { logger } from '../utils/logger.js';

const debug = logger.debugContext('pool');

export type ConnectionType = 'read' | 'write';

export interface ReplicationPoolOptions {
  /**
   * Maximum number of connections in pool. Default is 5
   */
  max: number;

  /**
   * Minimum number of connections in pool. Default is 0
   */
  min: number;

  /**
   * The maximum time, in milliseconds, that a connection can be idle before being released
   */
  idle: number;

  /**
   * The maximum time, in milliseconds, that pool will try to get connection before throwing error
   */
  acquire: number;

  /**
   * The time interval, in milliseconds, after which sequelize-pool will remove idle connections.
   */
  evict: number;

  /**
   * The number of times to use a connection before closing and replacing it.  Default is Infinity
   */
  maxUses: number;
}

export interface AcquireConnectionOptions {
  /**
   * Set which replica to use. Available options are `read` and `write`
   */
  type?: 'read' | 'write';

  /**
   * Force master or write replica to get connection from
   */
  useMaster?: boolean;
}

interface ReplicationPoolConfig<Connection extends object, ConnectionOptions extends object> {
  readConfig: readonly ConnectionOptions[] | null;
  writeConfig: ConnectionOptions;
  pool: ReplicationPoolOptions;

  // TODO: move this option to sequelize-pool so it applies to sub-pools as well
  timeoutErrorClass?: Class<Error>;

  connect(options: ConnectionOptions): Promise<Connection>;

  disconnect(connection: Connection): Promise<void>;

  validate(connection: Connection): boolean;

  beforeAcquire?(options: AcquireConnectionOptions): Promise<void>;
  afterAcquire?(connection: Connection, options: AcquireConnectionOptions): Promise<void>;
}

const owningPools = new WeakMap<object, 'read' | 'write'>();

export class ReplicationPool<Connection extends object, ConnectionOptions extends object> {
  /**
   * Replication read pool. Will only be used if the 'read' replication option has been provided,
   * otherwise the {@link write} will be used instead.
   */
  readonly read: Pool<Connection> | null;
  readonly write: Pool<Connection>;

  readonly #timeoutErrorClass: Class<TimeoutError> | undefined;
  readonly #beforeAcquire: ((options: AcquireConnectionOptions) => Promise<void>) | undefined;
  readonly #afterAcquire:
    | ((connection: Connection, options: AcquireConnectionOptions) => Promise<void>)
    | undefined;

  constructor(config: ReplicationPoolConfig<Connection, ConnectionOptions>) {
    const {
      connect,
      disconnect,
      validate,
      beforeAcquire,
      afterAcquire,
      timeoutErrorClass,
      readConfig,
      writeConfig,
    } = config;

    this.#beforeAcquire = beforeAcquire;
    this.#afterAcquire = afterAcquire;
    this.#timeoutErrorClass = timeoutErrorClass;

    if (!readConfig || readConfig.length === 0) {
      // no replication, the write pool will always be used instead
      this.read = null;
    } else {
      let reads = 0;

      this.read = new Pool({
        name: 'sequelize:read',
        create: async () => {
          // round robin config
          const nextRead = reads++ % readConfig.length;
          const connection = await connect(readConfig[nextRead]);

          owningPools.set(connection, 'read');

          return connection;
        },
        destroy: disconnect,
        validate,
        max: config.pool.max,
        min: config.pool.min,
        acquireTimeoutMillis: config.pool.acquire,
        idleTimeoutMillis: config.pool.idle,
        reapIntervalMillis: config.pool.evict,
        maxUses: config.pool.maxUses,
      });
    }

    this.write = new Pool({
      name: 'sequelize:write',
      create: async () => {
        const connection = await connect(writeConfig);

        owningPools.set(connection, 'write');

        return connection;
      },
      destroy: disconnect,
      validate,
      max: config.pool.max,
      min: config.pool.min,
      acquireTimeoutMillis: config.pool.acquire,
      idleTimeoutMillis: config.pool.idle,
      reapIntervalMillis: config.pool.evict,
      maxUses: config.pool.maxUses,
    });

    if (!this.read) {
      debug(`pool created with max/min: ${config.pool.max}/${config.pool.min}, no replication`);
    } else {
      debug(`pool created with max/min: ${config.pool.max}/${config.pool.min}, with replication`);
    }
  }

  async acquire(options?: AcquireConnectionOptions | undefined) {
    options = options ? shallowClonePojo(options) : pojo();
    await this.#beforeAcquire?.(options);
    Object.freeze(options);

    const { useMaster = false, type = 'write' } = options;

    if (type !== 'read' && type !== 'write') {
      throw new Error(`Expected queryType to be either read or write. Received ${type}`);
    }

    const pool = this.read != null && type === 'read' && !useMaster ? this.read : this.write;

    let connection;
    try {
      connection = await pool.acquire();
    } catch (error) {
      if (this.#timeoutErrorClass && error instanceof TimeoutError) {
        throw new this.#timeoutErrorClass(error.message, { cause: error });
      }

      throw error;
    }

    await this.#afterAcquire?.(connection, options);

    return connection;
  }

  release(client: Connection): void {
    const connectionType = owningPools.get(client);
    if (!connectionType) {
      throw new Error('Unable to determine to which pool the connection belongs');
    }

    this.getPool(connectionType).release(client);
  }

  async destroy(client: Connection): Promise<void> {
    const connectionType = owningPools.get(client);
    if (!connectionType) {
      throw new Error('Unable to determine to which pool the connection belongs');
    }

    await this.getPool(connectionType).destroy(client);
    debug('connection destroy');
  }

  async destroyAllNow() {
    await Promise.all([this.read?.destroyAllNow(), this.write.destroyAllNow()]);

    debug('all connections destroyed');
  }

  async drain() {
    await Promise.all([this.write.drain(), this.read?.drain()]);
  }

  getPool(poolType: ConnectionType): Pool<Connection> {
    if (poolType === 'read' && this.read != null) {
      return this.read;
    }

    return this.write;
  }

  get size(): number {
    return (this.read?.size ?? 0) + this.write.size;
  }

  get available(): number {
    return (this.read?.available ?? 0) + this.write.available;
  }

  get using(): number {
    return (this.read?.using ?? 0) + this.write.using;
  }

  get waiting(): number {
    return (this.read?.waiting ?? 0) + this.write.waiting;
  }
}
