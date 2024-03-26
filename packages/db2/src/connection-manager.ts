import type { Connection, ConnectionOptions } from '@sequelize/core';
import {
  AbstractConnectionManager,
  ConnectionError,
  ConnectionRefusedError,
} from '@sequelize/core';
import type { ConnStr } from 'ibm_db';
import * as Db2 from 'ibm_db';
import assert from 'node:assert';
import NodeUtil from 'node:util';
import type { Db2Dialect } from './dialect.js';

export interface Db2Connection extends Connection, Db2.Database {}

/**
 * DB2 Connection Manager
 *
 * Get connections, validate and disconnect them.
 * AbstractConnectionManager pooling use it to handle DB2 specific connections
 * Use https://github.com/ibmdb/node-ibm_db to connect with DB2 server
 *
 * @private
 */
export class Db2ConnectionManager extends AbstractConnectionManager<Db2Dialect, Db2Connection> {
  readonly #lib: typeof Db2;

  constructor(dialect: Db2Dialect) {
    super(dialect);
    this.#lib = Db2;
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
      ...(config.ssl ? { Security: 'SSL' } : undefined),
      // TODO: pass this property through dialectOptions
      // @ts-expect-error -- DB2 specific option that should not be at the top level
      ...(config.sslcertificate ? { SSLServerCertificate: config.ssl } : undefined),
      ...config.dialectOptions,
    };

    try {
      return await new Promise((resolve, reject) => {
        const connection = new this.#lib.Database() as Db2Connection;
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
