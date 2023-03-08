import pick from 'lodash/pick';
import type { Client, ClientConfig } from 'pg';
import type { ConnectionOptions, Sequelize } from 'src/sequelize';
import { ConnectionError, ConnectionRefusedError, ConnectionTimedOutError, HostNotFoundError, HostNotReachableError, InvalidConnectionError } from '../../errors';
import { logger } from '../../utils/logger';
import type { Connection } from '../abstract/connection-manager';
import { AbstractConnectionManager } from '../abstract/connection-manager';
import type { CockroachDbDialect } from './index';

export interface CockroachdbConnection extends Connection, Client {
  options?: string;
  // custom property we attach to the client
  // TODO: replace with Symbols.
  _invalid?: boolean;
  standard_conforming_strings?: boolean;

  // Private property of pg-client
  // TODO: ask pg to expose a stable, readonly, property we can use
  _ending?: boolean;
}

// TODO: once the code has been split into packages, we won't need to lazy load pg anymore
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
type Lib = typeof import('pg');

const debug = logger.debugContext('connection:crdb');

export class CockroachdbConnectionManager extends AbstractConnectionManager<CockroachdbConnection> {
  private readonly lib: Lib;

  constructor(dialect: CockroachDbDialect, sequelize: Sequelize) {
    super(dialect, sequelize);
    this.lib = this._loadDialectModule('pg') as Lib;
  }

  async connect(config: ConnectionOptions): Promise<CockroachdbConnection> {
    const port = Number(config.port ?? this.dialect.getDefaultPort());

    // @ts-expect-error -- "dialectOptions.options" must be a string in PG, but a Record in MSSQL. We'll fix the typings when we split the dialects into their own modules.
    const connectionConfig: ClientConfig = {
      ...(config.dialectOptions && pick(config.dialectOptions, [
        // Value for application name variable see here https://www.cockroachlabs.com/docs/stable/connection-parameters.html#additional-connection-parameters
        'application_name',
        // Define the type of secure connection to use. See here https://www.cockroachlabs.com/docs/stable/connection-parameters.html#secure-connections-with-urls
        'sslmode',
        // Path to the client certificate, when sslmode is not disable. See here https://www.cockroachlabs.com/docs/v22.2/cockroach-cert
        'sslcert',
        // Path to the client private key, when sslmode is not disable. See here https://www.cockroachlabs.com/docs/v22.2/cockroach-cert
        'sslkey',
        // Cockroachdb allows additional variables to be configured in the connection string under options parameter.
        // See here https://www.cockroachlabs.com/docs/stable/connection-parameters.html#supported-options-parameters
        'options',
      ])),
      ...pick(config, ['password', 'host', 'database']),
      port,
      user: config.username,
    };

    const connection: CockroachdbConnection = new this.lib.Client(connectionConfig);

    await new Promise((resolve, reject) => {
      const responded: boolean = false; // Variable to track if the connection was unsuccessful

      /**
       * Handler used if we don't ever hear from the client.connect() callback
       *
       * @throws {ConnectionTimedOutError} when we don't hear back from the callback.
       */
      const endHandler = () => {
        debug('connection timeout');
        if (!responded) {
          reject(new ConnectionTimedOutError(new Error('Connection timed out')));
        }
      };

      connection.once('end', endHandler);

      connection.connect(err => {
        if (err) {
          // @ts-expect-error -- undeclared type
          if (err.code) {
            // @ts-expect-error -- undeclared type
            switch (err.code) {
              case 'ECONNREFUSED':
                reject(new ConnectionRefusedError(err));
                break;
              case 'ENOTFOUND':
                reject(new HostNotFoundError(err));
                break;
              case 'EHOSTUNREACH':
                reject(new HostNotReachableError(err));
                break;
              case 'EINVAL':
                reject(new InvalidConnectionError(err));
                break;
              default:
                reject(new ConnectionError(err));
                break;
            }
          } else {
            reject(new ConnectionError(err));
          }
        } else {
          debug('connection acquired');
          connection.removeListener('end', endHandler);
          resolve(connection);
        }

      });
    });

    return connection;
  }

  async disconnect(connection: CockroachdbConnection): Promise<void> {
    await connection.end();
  }
}
