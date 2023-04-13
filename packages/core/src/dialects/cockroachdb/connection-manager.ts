import pick from 'lodash/pick';
import type { Client, ClientConfig } from 'pg';
import type { TypeFormat, TypeId } from 'pg-types';
import { ConnectionError, ConnectionRefusedError, ConnectionTimedOutError, HostNotFoundError, HostNotReachableError, InvalidConnectionError } from '../../errors';
import type { CockroachDbDialect } from './index';
import type { ConnectionOptions } from '../../sequelize.js';
import { Sequelize } from '../../sequelize.js';
import { logger } from '../../utils/logger';
import type { Connection } from '../abstract/connection-manager';
import { AbstractConnectionManager } from '../abstract/connection-manager';

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
type TypeParser = (source: string) => unknown;

interface TypeOids {
  oid: number;
  typeName: string;
  type: 'base';
  /** oid of the base type. Available on array, range & range-array */
  baseOid?: number;
  /** oid of the range. Available on range-array */
  rangeOid?: number;
}

const debug = logger.debugContext('connection:crdb');

export class CockroachdbConnectionManager extends AbstractConnectionManager<CockroachdbConnection> {
  private readonly lib: Lib;
  #oidMap = new Map<number, TypeOids>();
  #oidParserCache = new Map<number, TypeParser>();

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
      types: {
        getTypeParser: (oid: TypeId, format?: TypeFormat) => this.getTypeParser(oid, format),
      },
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

    await this.#refreshOidMap(connection);

    return connection;
  }

  async disconnect(connection: CockroachdbConnection): Promise<void> {
    await connection.end();
  }

  getTypeParser(oid: TypeId, format?: TypeFormat): TypeParser {
    const cachedParser = this.#oidParserCache.get(oid);

    if (cachedParser) {
      return cachedParser;
    }

    const customParser = this.#getCustomTypeParser(oid, format);
    if (customParser) {
      this.#oidParserCache.set(oid, customParser);

      return customParser;
    }

    return this.lib.types.getTypeParser(oid, format);
  }

  #getCustomTypeParser(oid: TypeId, _format?: TypeFormat): TypeParser | null {
    const typeData = this.#oidMap.get(oid);

    if (!typeData) {
      return null;
    }

    const parser = this.dialect.getParserForDatabaseDataType(typeData.typeName);

    return parser ?? null;
  }

  async #refreshOidMap(connection: CockroachdbConnection | Sequelize): Promise<void> {
    const sql = `
      WITH ranges AS (SELECT pg_range.rngtypid,
                             pg_type.typname  AS rngtypname,
                             pg_type.typarray AS rngtyparray,
                             pg_range.rngsubtype
                      FROM pg_range
                             LEFT OUTER JOIN pg_type
                                             ON pg_type.oid = pg_range.rngtypid)
      SELECT pg_type.typname,
             pg_type.typtype,
             pg_type.oid,
             pg_type.typarray,
             ranges.rngtypname,
             ranges.rngtypid,
             ranges.rngtyparray
      FROM pg_type
             LEFT OUTER JOIN ranges
                             ON pg_type.oid = ranges.rngsubtype
      WHERE (pg_type.typtype IN ('b', 'e'));
    `;

    let results;
    if (connection instanceof Sequelize) {
      results = (await connection.query(sql)).pop();
    } else {
      results = await connection.query(sql);
    }

    // When searchPath is prepended then two statements are executed and the result is
    // an array of those two statements. First one is the SET search_path and second is
    // the SELECT query result.
    if (Array.isArray(results) && results[0].command === 'SET') {
      results = results.pop();
    }

    const newNameOidMap = new Map<number, TypeOids>();

    for (const row of results.rows) {
      if (!newNameOidMap.has(row.oid)) {
        newNameOidMap.set(row.oid, {
          oid: row.oid,
          typeName: row.typname,
          type: 'base',
        });
      }
    }

    // Replace all OID mappings. Avoids temporary empty OID mappings.
    this.#oidMap = newNameOidMap;
  }

  async refreshDynamicOids() {
    await this.#refreshOidMap(this.sequelize);
  }
}
