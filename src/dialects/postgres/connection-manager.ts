import pick from 'lodash/pick';
import type { ClientConfig, Client } from 'pg';
import type { TypeFormat, TypeId } from 'pg-types';
import semver from 'semver';
import {
  ConnectionError, ConnectionRefusedError,
  ConnectionTimedOutError,
  HostNotFoundError,
  HostNotReachableError,
  InvalidConnectionError,
} from '../../errors';
import { Sequelize } from '../../sequelize.js';
import type { ConnectionOptions } from '../../sequelize.js';
import { isValidTimeZone } from '../../utils/dayjs';
import { logger } from '../../utils/logger';
import type { Connection } from '../abstract/connection-manager';
import { AbstractConnectionManager } from '../abstract/connection-manager';
import type { PostgresDialect } from './index.js';

const debug = logger.debugContext('connection:pg');

// TODO: once the code has been split into packages, we won't need to lazy load pg anymore
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
type Lib = typeof import('pg');
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
type ArrayParserLib = typeof import('postgres-array');

type TypeParser = (source: string) => unknown;

interface TypeOids {
  oid: number;
  typeName: string;
  type: 'base' | 'array' | 'range' | 'range-array';
  /** oid of the base type. Available on array, range & range-array */
  baseOid?: number;
  /** oid of the range. Available on range-array */
  rangeOid?: number;
}

interface PgConnection extends Connection, Client {
  // custom property we attach to the client
  // TODO: replace with Symbols.
  _invalid?: boolean;
  standard_conforming_strings?: boolean;

  // Private property of pg-client
  // TODO: ask pg to expose a stable, readonly, property we can use
  _ending?: boolean;
}

export class PostgresConnectionManager extends AbstractConnectionManager<PgConnection> {
  private readonly lib: Lib;
  readonly #arrayParserLib: ArrayParserLib;

  #oidMap = new Map<number, TypeOids>();
  #oidParserCache = new Map<number, TypeParser>();

  constructor(dialect: PostgresDialect, sequelize: Sequelize) {
    super(dialect, sequelize);

    const pgLib = this._loadDialectModule('pg') as Lib;
    this.lib = this.sequelize.config.native ? pgLib.native! : pgLib;

    this.#arrayParserLib = this._loadDialectModule('postgres-array') as ArrayParserLib;
  }

  async connect(config: ConnectionOptions): Promise<PgConnection> {
    const port = Number(config.port ?? this.dialect.getDefaultPort());

    // @ts-expect-error -- "dialectOptions.options" must be a string in PG, but a Record in MSSQL. We'll fix the typings when we split the dialects into their own modules.
    const connectionConfig: ClientConfig = {
      ...(config.dialectOptions && pick(config.dialectOptions, [
        // see [http://www.postgresql.org/docs/9.3/static/runtime-config-logging.html#GUC-APPLICATION-NAME]
        'application_name',
        // choose the SSL mode with the PGSSLMODE environment variable
        // object format: [https://github.com/brianc/node-postgres/blob/ee19e74ffa6309c9c5e8e01746261a8f651661f8/lib/connection.js#L79]
        // see also [http://www.postgresql.org/docs/9.3/static/libpq-ssl.html]
        'ssl',
        // In addition to the values accepted by the corresponding server,
        // you can use "auto" to determine the right encoding from the
        // current locale in the client (LC_CTYPE environment variable on Unix systems)
        'client_encoding',
        // !! DO NOT SET THIS TO TRUE !!
        // (unless you know what you're doing)
        // see [http://www.postgresql.org/message-id/flat/bc9549a50706040852u27633f41ib1e6b09f8339d845@mail.gmail.com#bc9549a50706040852u27633f41ib1e6b09f8339d845@mail.gmail.com]
        'binary',
        // This should help with backends incorrectly considering idle clients to be dead and prematurely disconnecting them.
        // this feature has been added in pg module v6.0.0, check pg/CHANGELOG.md
        'keepAlive',
        // Times out queries after a set time in milliseconds in the database end. Added in pg v7.3
        'statement_timeout',
        // Times out queries after a set time in milliseconds in client end, query would be still running in database end.
        'query_timeout',
        // Terminate any session with an open transaction that has been idle for longer than the specified duration in milliseconds. Added in pg v7.17.0 only supported in postgres >= 10
        'idle_in_transaction_session_timeout',
        // Postgres allows additional session variables to be configured in the connection string in the `options` param.
        // see [https://www.postgresql.org/docs/14/libpq-connect.html#LIBPQ-CONNECT-OPTIONS]
        'options',
      ])),
      port,
      ...pick(config, ['password', 'host', 'database']),
      user: config.username,
      types: {
        getTypeParser: (oid: TypeId, format?: TypeFormat) => this.getTypeParser(oid, format),
      },
    };

    const connection: PgConnection = new this.lib.Client(connectionConfig);

    await new Promise((resolve, reject) => {
      let responded = false;

      const parameterHandler = (message: { parameterName: string, parameterValue: string }) => {
        switch (message.parameterName) {
          case 'server_version': {
            const version = semver.coerce(message.parameterValue)?.version;
            this.sequelize.options.databaseVersion = version && semver.valid(version)
              ? version
              : this.dialect.defaultVersion;

            break;
          }

          case 'standard_conforming_strings': {
            connection.standard_conforming_strings = message.parameterValue === 'on';
            break;
          }

          default:
        }
      };

      const endHandler = () => {
        debug('connection timeout');
        if (!responded) {
          reject(new ConnectionTimedOutError(new Error('Connection timed out')));
        }
      };

      // If we didn't ever hear from the client.connect() callback the connection timeout
      // node-postgres does not treat this as an error since no active query was ever emitted
      connection.once('end', endHandler);

      if (!this.sequelize.config.native) {
        // Receive various server parameters for further configuration
        // @ts-expect-error -- undeclared type
        connection.connection.on('parameterStatus', parameterHandler);
      }

      connection.connect(err => {
        responded = true;

        if (!this.sequelize.config.native) {
          // remove parameter handler
          // @ts-expect-error -- undeclared type
          connection.connection.removeListener('parameterStatus', parameterHandler);
        }

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

    // Don't let a Postgres restart (or error) to take down the whole app
    connection.once('error', error => {
      connection._invalid = true;
      debug(`connection error ${error.code || error.message}`);
      void this.pool.destroy(connection);
    });

    let query = '';

    if (this.sequelize.options.standardConformingStrings !== false && connection.standard_conforming_strings) {
      // Disable escape characters in strings
      // see https://github.com/sequelize/sequelize/issues/3545 (security issue)
      // see https://www.postgresql.org/docs/current/static/runtime-config-compatible.html#GUC-STANDARD-CONFORMING-STRINGS
      query += 'SET standard_conforming_strings=on;';
    }

    if (this.sequelize.options.clientMinMessages !== undefined) {
      console.warn('Usage of "options.clientMinMessages" is deprecated and will be removed in v7.');
      console.warn('Please use the sequelize option "dialectOptions.clientMinMessages" instead.');
    }

    // Redshift dosen't support client_min_messages, use 'ignore' to skip this settings.
    // If no option, the default value in sequelize is 'warning'
    if (!(config.dialectOptions && config.dialectOptions.clientMinMessages && config.dialectOptions.clientMinMessages.toLowerCase() === 'ignore'
      || this.sequelize.options.clientMinMessages === false)) {
      const clientMinMessages = config.dialectOptions && config.dialectOptions.clientMinMessages || this.sequelize.options.clientMinMessages || 'warning';
      query += `SET client_min_messages TO ${clientMinMessages};`;

    }

    if (!this.sequelize.config.keepDefaultTimezone) {
      if (this.sequelize.options.timezone && isValidTimeZone(this.sequelize.options.timezone)) {
        query += `SET TIME ZONE '${this.sequelize.options.timezone}';`;
      } else {
        query += `SET TIME ZONE INTERVAL '${this.sequelize.options.timezone}' HOUR TO MINUTE;`;
      }
    }

    if (query) {
      await connection.query(query);
    }

    await this.#refreshOidMap(connection);

    return connection;
  }

  async disconnect(connection: PgConnection): Promise<void> {
    if (connection._ending) {
      debug('connection tried to disconnect but was already at ENDING state');

      return;
    }

    await connection.end();
  }

  validate(connection: PgConnection) {
    return !connection._invalid && !connection._ending;
  }

  async #refreshOidMap(connection: PgConnection | Sequelize): Promise<void> {
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
      // Mapping base types and their arrays
      // Array types are declared twice, once as part of the same row as the base type, once as their own row.
      if (!newNameOidMap.has(row.oid)) {
        newNameOidMap.set(row.oid, {
          oid: row.oid,
          typeName: row.typname,
          type: 'base',
        });
      }

      if (row.typarray) {
        newNameOidMap.set(row.typarray, {
          oid: row.typarray,
          typeName: row.typname,
          type: 'array',
          baseOid: row.oid,
        });
      }

      if (row.rngtypid) {
        newNameOidMap.set(row.rngtypid, {
          oid: row.rngtypid,
          typeName: row.rngtypname,
          type: 'range',
          baseOid: row.oid,
        });
      }

      if (row.rngtyparray) {
        newNameOidMap.set(row.rngtyparray, {
          oid: row.rngtyparray,
          typeName: row.rngtypname,
          type: 'range-array',
          baseOid: row.oid,
          rangeOid: row.rngtypid,
        });
      }
    }

    // Replace all OID mappings. Avoids temporary empty OID mappings.
    this.#oidMap = newNameOidMap;
  }

  #buildArrayParser(subTypeParser: (value: string) => unknown): (source: string) => unknown[] {
    return (source: string) => {
      return this.#arrayParserLib.parse(source, subTypeParser);
    };
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

  #getCustomTypeParser(oid: TypeId, format?: TypeFormat): TypeParser | null {
    const typeData = this.#oidMap.get(oid);

    if (!typeData) {
      return null;
    }

    if (typeData.type === 'range-array') {
      return this.#buildArrayParser(this.getTypeParser(typeData.rangeOid!, format));
    }

    if (typeData.type === 'array') {
      return this.#buildArrayParser(this.getTypeParser(typeData.baseOid!, format));
    }

    const parser = this.dialect.getParserForDatabaseDataType(typeData.typeName);

    return parser ?? null;
  }

  /**
   * Refreshes the local registry of Custom Types (e.g. enum) OIDs
   */
  async refreshDynamicOids() {
    await this.#refreshOidMap(this.sequelize);
  }
}
