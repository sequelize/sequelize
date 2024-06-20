import type { AbstractConnection, ConnectionOptions } from '@sequelize/core';
import {
  AbstractConnectionManager,
  ConnectionError,
  ConnectionRefusedError,
  ConnectionTimedOutError,
  HostNotFoundError,
  HostNotReachableError,
  InvalidConnectionError,
  Sequelize,
} from '@sequelize/core';
import { isValidTimeZone } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/dayjs.js';
import { logger } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/logger.js';
import type { ClientConfig } from 'pg';
import * as Pg from 'pg';
import type { TypeId, TypeParser } from 'pg-types';
import { parse as parseArray } from 'postgres-array';
import semver from 'semver';
import type { PostgresDialect } from './dialect.js';

const debug = logger.debugContext('connection:pg');

type TypeFormat = 'text' | 'binary';

interface TypeOids {
  oid: number;
  typeName: string;
  type: 'base' | 'array' | 'range' | 'range-array';
  /** oid of the base type. Available on array, range & range-array */
  baseOid?: number;
  /** oid of the range. Available on range-array */
  rangeOid?: number;
}

export type PgModule = typeof Pg;

export interface PostgresConnection extends AbstractConnection, Pg.Client {
  // custom property we attach to the client
  // TODO: replace with Symbols.
  _invalid?: boolean;
  standard_conforming_strings?: boolean;

  // Private property of pg-client
  // TODO: ask pg to expose a stable, readonly, property we can use
  _ending?: boolean;
}

export interface PostgresConnectionOptions
  extends Omit<ClientConfig, 'types' | 'connectionString'> {
  /**
   * !! DO NOT SET THIS TO TRUE !!
   * (unless you know what you're doing)
   * see [http://www.postgresql.org/message-id/flat/bc9549a50706040852u27633f41ib1e6b09f8339d845@mail.gmail.com#bc9549a50706040852u27633f41ib1e6b09f8339d845@mail.gmail.com]
   */
  binary?: boolean;

  /**
   * see [http://www.postgresql.org/docs/9.3/static/runtime-config-logging.html#GUC-APPLICATION-NAME]
   * choose the SSL mode with the PGSSLMODE environment variable
   * object format: [https://github.com/brianc/node-postgres/blob/ee19e74ffa6309c9c5e8e01746261a8f651661f8/lib/connection.js#L79]
   * see also [http://www.postgresql.org/docs/9.3/static/libpq-ssl.html]
   * In addition to the values accepted by the corresponding server,
   * you can use "auto" to determine the right encoding from the
   * current locale in the client (LC_CTYPE environment variable on Unix systems)
   */
  client_encoding?: string;

  /**
   * This should help with backends incorrectly considering idle clients to be dead and prematurely disconnecting them.
   * this feature has been added in pg module v6.0.0, check pg/CHANGELOG.md
   * Times out queries after a set time in milliseconds in the database end. Added in pg v7.3
   * Times out queries after a set time in milliseconds in client end, query would be still running in database end.
   * Number of milliseconds to wait for connection, default is no timeout.
   * Terminate any session with an open transaction that has been idle for longer than the specified duration in milliseconds. Added in pg v7.17.0 only supported in postgres >= 10
   * Maximum wait time for lock requests in milliseconds. Added in pg v8.8.0.
   */
  lock_timeout?: number;
}

export class PostgresConnectionManager extends AbstractConnectionManager<
  PostgresDialect,
  PostgresConnection
> {
  readonly #lib: PgModule;
  readonly #oidMap = new Map<number, TypeOids>();
  readonly #oidParserCache = new Map<number, TypeParser<any, any>>();

  constructor(dialect: PostgresDialect) {
    super(dialect);

    const pgModule = dialect.options.pgModule ?? Pg;

    if (dialect.options.native && dialect.options.pgModule) {
      throw new Error(
        'You cannot specify both the "pgModule" option and the "native" option at the same time, as the "native" option is only used to use "pg-native" as the "pgModule" instead of "pg"',
      );
    }

    if (dialect.options.native && !pgModule.native) {
      throw new Error(
        'The "native" option was specified, but the "pg-native" module is not installed. You must install it to use the native bindings.',
      );
    }

    this.#lib = dialect.options.native ? pgModule.native! : pgModule;
  }

  async connect(config: ConnectionOptions<PostgresDialect>): Promise<PostgresConnection> {
    const connectionConfig: ClientConfig = {
      port: 5432,
      ...config,
      types: {
        getTypeParser: (oid: TypeId, format?: TypeFormat) => this.getTypeParser(oid, format),
      },
    };

    const connection: PostgresConnection = new this.#lib.Client(connectionConfig);

    await new Promise((resolve, reject) => {
      let responded = false;

      const parameterHandler = (message: { parameterName: string; parameterValue: string }) => {
        switch (message.parameterName) {
          case 'server_version': {
            const version = semver.coerce(message.parameterValue)?.version;
            this.sequelize.setDatabaseVersion(
              version && semver.valid(version) ? version : this.dialect.minimumDatabaseVersion,
            );

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

      if (!this.dialect.options.native) {
        // Receive various server parameters for further configuration
        // @ts-expect-error -- undeclared type
        connection.connection.on('parameterStatus', parameterHandler);
      }

      connection.connect(err => {
        responded = true;

        if (!this.dialect.options.native) {
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
    connection.on('error', (error: any) => {
      connection._invalid = true;
      debug(`connection error ${error.code || error.message}`);
      void this.sequelize.pool.destroy(connection);
    });

    let query = '';

    if (
      this.dialect.options.standardConformingStrings !== false &&
      connection.standard_conforming_strings
    ) {
      // Disable escape characters in strings
      // see https://github.com/sequelize/sequelize/issues/3545 (security issue)
      // see https://www.postgresql.org/docs/current/static/runtime-config-compatible.html#GUC-STANDARD-CONFORMING-STRINGS
      query += 'SET standard_conforming_strings=on;';
    }

    // TODO: make this a connection option
    const clientMinMessages = this.dialect.options.clientMinMessages ?? 'warning';
    if (clientMinMessages) {
      query += `SET client_min_messages TO ${clientMinMessages};`;
    }

    if (!this.sequelize.options.keepDefaultTimezone) {
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

  async disconnect(connection: PostgresConnection): Promise<void> {
    if (connection._ending) {
      debug('connection tried to disconnect but was already at ENDING state');

      return;
    }

    await connection.end();
  }

  validate(connection: PostgresConnection) {
    return !connection._invalid && !connection._ending;
  }

  async #refreshOidMap(connection: PostgresConnection | Sequelize): Promise<void> {
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

    const oidMap = this.#oidMap;
    oidMap.clear();

    for (const row of results.rows) {
      // Mapping base types and their arrays
      // Array types are declared twice, once as part of the same row as the base type, once as their own row.
      if (!oidMap.has(row.oid)) {
        oidMap.set(row.oid, {
          oid: row.oid,
          typeName: row.typname,
          type: 'base',
        });
      }

      if (row.typarray) {
        oidMap.set(row.typarray, {
          oid: row.typarray,
          typeName: row.typname,
          type: 'array',
          baseOid: row.oid,
        });
      }

      if (row.rngtypid) {
        oidMap.set(row.rngtypid, {
          oid: row.rngtypid,
          typeName: row.rngtypname,
          type: 'range',
          baseOid: row.oid,
        });
      }

      if (row.rngtyparray) {
        oidMap.set(row.rngtyparray, {
          oid: row.rngtyparray,
          typeName: row.rngtypname,
          type: 'range-array',
          baseOid: row.oid,
          rangeOid: row.rngtypid,
        });
      }
    }
  }

  #buildArrayParser(subTypeParser: (value: string) => unknown): (source: string) => unknown[] {
    return (source: string) => {
      return parseArray(source, subTypeParser);
    };
  }

  getTypeParser(oid: TypeId, format?: TypeFormat): TypeParser<any, any> {
    const cachedParser = this.#oidParserCache.get(oid);

    if (cachedParser) {
      return cachedParser;
    }

    const customParser = this.#getCustomTypeParser(oid, format);
    if (customParser) {
      this.#oidParserCache.set(oid, customParser);

      return customParser;
    }

    // This verbose switch statement is here because `getTypeParser` is missing a signature
    // where "format" is a union of 'text' and 'binary' and undefined, so TypeScript can't
    // infer the correct return type.
    switch (format) {
      case 'text':
        return this.#lib.types.getTypeParser(oid, format);
      case 'binary':
        return this.#lib.types.getTypeParser(oid, format);
      default:
        return this.#lib.types.getTypeParser(oid);
    }
  }

  #getCustomTypeParser(oid: TypeId, format?: TypeFormat): TypeParser<any, any> | null {
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
