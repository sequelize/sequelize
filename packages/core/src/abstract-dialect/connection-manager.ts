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

  /**
   * ID of the connection.
   */
  uuid?: string | 'default';
}

export interface AbstractConnection {
  /** custom property we attach to different dialect connections */
  // TODO: replace with Symbols.
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
    return true;
  }

  async connect(_config: ConnectionOptions<Dialect>): Promise<TConnection> {
    throw new Error(`connect not implemented in ${this.constructor.name}`);
  }

  async disconnect(_connection: TConnection): Promise<void> {
    throw new Error(`disconnect not implemented in ${this.constructor.name}`);
  }
}
