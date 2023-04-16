import assert from 'node:assert';
import NodeUtil from 'node:util';
import type { ConnStr, Database as Db2LibDatabase } from 'ibm_db';
import { ConnectionError, ConnectionRefusedError } from '../../errors/index.js';
import type { ConnectionOptions, Sequelize } from '../../sequelize.js';
import type { Connection } from '../abstract/connection-manager';
import { AbstractConnectionManager } from '../abstract/connection-manager';
import type { Db2Dialect } from './index.js';

// TODO: once the code has been split into packages, we won't need to lazy load this anymore
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
type Lib = typeof import('ibm_db');

export interface Db2Connection extends Connection, Db2LibDatabase {
  // properties added by us
  // TODO: replace with Symbols.
  lib: Lib;
}

/**
 * DB2 Connection Manager
 *
 * Get connections, validate and disconnect them.
 * AbstractConnectionManager pooling use it to handle DB2 specific connections
 * Use https://github.com/ibmdb/node-ibm_db to connect with DB2 server
 *
 * @private
 */
export class Db2ConnectionManager extends AbstractConnectionManager<Db2Connection> {
  private readonly lib;

  constructor(dialect: Db2Dialect, sequelize: Sequelize) {
    super(dialect, sequelize);
    this.lib = this._loadDialectModule('ibm_db') as Lib;
  }

  /**
   * Connect with DB2 database based on config, Handle any errors in connection
   * Set the pool handlers on connection.error
   *
   * @param config
   * @returns
   * @private
   */
  async connect(config: ConnectionOptions): Promise<Db2Connection> {
    const connectionConfig: ConnStr = {
      // @ts-expect-error -- Bad typings
      DATABASE: config.database,
      // @ts-expect-error -- Bad typings
      HOSTNAME: config.host,
      // @ts-expect-error -- Bad typings
      PORT: config.port,
      // @ts-expect-error -- Bad typings
      UID: config.username,
      // @ts-expect-error -- Bad typings
      PWD: config.password,
      ...(config.ssl ? { SECURITY: config.ssl } : undefined),
      // TODO: pass this property through dialectOptions
      // @ts-expect-error -- DB2 specific option that should not be at the top level
      ...(config.sslcertificate ? { SSLServerCertificate: config.ssl } : undefined),
      ...config.dialectOptions,
    };

    try {
      return await new Promise((resolve, reject) => {
        const connection = new this.lib.Database() as Db2Connection;
        connection.lib = this.lib;
        connection.open(connectionConfig, error => {
          if (error) {
            if (error.message && error.message.includes('SQL30081N')) {
              return void reject(new ConnectionRefusedError(error));
            }

            return void reject(new ConnectionError(error));
          }

          return void resolve(connection);
        });
      });
    } catch (error) {
      assert(error instanceof Error, `DB2 threw a non-error value: ${NodeUtil.inspect(error)}`);

      throw new ConnectionError(error);
    }
  }

  async disconnect(connection: Db2Connection) {
    // Don't disconnect a connection that is already disconnected
    if (!connection.connected) {
      return;
    }

    await connection.close();
  }

  validate(connection: Db2Connection): boolean {
    return connection.connected;
  }
}
