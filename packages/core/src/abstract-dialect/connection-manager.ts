import type { AbstractDialect, ConnectionOptions } from './dialect.js';

export interface GetConnectionOptions {
  /**
   * Set which replica to use. Available options are `read` and `write`
   */
  type: 'read' | 'write';

  /**
   * Force master or write replica to get connection from
   */
  useMaster?: boolean;
}

export interface AbstractConnection {
  /** The UUID of the transaction that is using this connection */
  // TODO: replace with the transaction object itself.
  uuid?: string | undefined;
}

declare const ConnectionType: unique symbol;
export type Connection<
  DialectOrConnectionManager extends AbstractDialect | AbstractConnectionManager,
> = DialectOrConnectionManager extends AbstractDialect
  ? Connection<DialectOrConnectionManager['connectionManager']>
  : DialectOrConnectionManager extends AbstractConnectionManager
    ? DialectOrConnectionManager[typeof ConnectionType]
    : never;

/**
 * Abstract Connection Manager
 *
 * Connection manager which handles pooling & replication.
 * Uses sequelize-pool for pooling
 *
 * @param connection
 */
export class AbstractConnectionManager<
  Dialect extends AbstractDialect = AbstractDialect,
  TConnection extends AbstractConnection = AbstractConnection,
> {
  declare [ConnectionType]: TConnection;

  protected readonly dialect: Dialect;

  constructor(dialect: Dialect) {
    this.dialect = dialect;
  }

  protected get sequelize() {
    return this.dialect.sequelize;
  }

  get pool(): never {
    throw new Error('The "pool" property has been moved to the Sequelize instance.');
  }

  /**
   * Determine if a connection is still valid or not
   *
   * @param _connection
   */
  validate(_connection: TConnection): boolean {
    throw new Error(`validate not implemented in ${this.constructor.name}`);
  }

  async connect(_config: ConnectionOptions<Dialect>): Promise<TConnection> {
    throw new Error(`connect not implemented in ${this.constructor.name}`);
  }

  /**
   * Called after {@link connect}, once the connection has been registered with the pool.
   * Override this to attach error handlers or run post-connection setup queries.
   * If this method throws, the connection is closed with {@link disconnect}.
   * Calling `pool.destroy()` on the connection from here does not throw, but it does not
   * close the connection either: the pool only takes ownership once setup is done.
   *
   * @param _connection The connection returned by {@link connect}
   */
  async initializeConnection(_connection: TConnection): Promise<void> {}

  /**
   * Closes the connection. This can also be called with a connection whose setup failed,
   * which the pool never handed out, and which may already be closed.
   *
   * @param _connection The connection to close
   */
  async disconnect(_connection: TConnection): Promise<void> {
    throw new Error(`disconnect not implemented in ${this.constructor.name}`);
  }
}
