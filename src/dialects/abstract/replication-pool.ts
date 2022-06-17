import { Pool } from 'sequelize-pool';
import type { NormalizedPoolOptions, ConnectionOptions } from '../../sequelize.js';
import { logger } from '../../utils/logger.js';

const debug = logger.debugContext('pool');

export type PoolType = 'read' | 'write';

export interface RWResource {
  queryType: PoolType;
}

type ReplicationPoolConfig<Resource extends RWResource> = {
  readConfig: ConnectionOptions[] | null,
  writeConfig: ConnectionOptions,
  pool: Omit<NormalizedPoolOptions, 'validate'>,

  connect(options: ConnectionOptions): Promise<Resource>,
  disconnect(connection: Resource): Promise<void>,
  validate(connection: Resource): boolean,
};

export class ReplicationPool<Resource extends RWResource> {
  /**
   * Replication read pool. Will only be used if the 'read' replication option has been provided,
   * otherwise the {@link write} will be used instead.
   */
  readonly read: Pool<Resource> | null;
  readonly write: Pool<Resource>;

  constructor(config: ReplicationPoolConfig<Resource>) {
    const { connect, disconnect, validate, readConfig, writeConfig } = config;

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
          connection.queryType = 'read';

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
        connection.queryType = 'write';

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

  async acquire(queryType: PoolType = 'write', useMaster = false) {
    if (queryType !== 'read' && queryType !== 'write') {
      throw new Error(`Expected queryType to be either read or write. Received ${queryType}`);
    }

    if (this.read != null && queryType === 'read' && !useMaster) {
      return this.read.acquire();
    }

    return this.write.acquire();
  }

  release(client: Resource): void {
    this.getPool(client.queryType).release(client);
  }

  async destroy(client: Resource): Promise<void> {
    await this.getPool(client.queryType).destroy(client);
    debug('connection destroy');
  }

  async destroyAllNow() {
    await Promise.all([
      this.read?.destroyAllNow(),
      this.write.destroyAllNow(),
    ]);

    debug('all connections destroyed');
  }

  async drain() {
    await Promise.all([
      this.write.drain(),
      this.read?.drain(),
    ]);
  }

  getPool(poolType: PoolType): Pool<Resource> {
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
