import type { AbstractConnection, ConnectionOptions } from '@sequelize/core';
import {
  AbstractConnectionManager,
  AccessDeniedError,
  ConnectionError,
  ConnectionRefusedError,
  HostNotFoundError,
  HostNotReachableError,
  InvalidConnectionError,
} from '@sequelize/core';
import { isErrorWithStringCode } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import { timeZoneToOffsetString } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/dayjs.js';
import { logger } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/logger.js';
import { removeUndefined } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/object.js';
import { isError } from '@sequelize/utils';
import * as MariaDb from 'mariadb';
import semver from 'semver';
import type { MariaDbDialect } from './dialect.js';

const debug = logger.debugContext('connection:mariadb');

// Attached by connect() until initializeConnection() replaces it with the real handler.
function ignoreErrorUntilInitialized() {}

export type MariaDbModule = typeof MariaDb;

export interface MariaDbConnection extends AbstractConnection, MariaDb.Connection {}

export interface MariaDbConnectionOptions extends Omit<
  MariaDb.ConnectionConfig,
  // Can only be set by Sequelize to prevent users from making it return a format
  // that is incompatible with Sequelize
  | 'typeCast'
  // Replaced by Sequelize's global option
  | 'timezone'
  // Users cannot use MariaDB's placeholders, they use Sequelize's syntax instead
  | 'namedPlaceholders'
  | 'arrayParenthesis'

  // The following options will conflict with the format expected by Sequelize
  | 'insertIdAsNumber'
  | 'metaAsArray'
  | 'rowsAsArray'
  | 'nestTables'
  | 'dateStrings'
  | 'decimalAsNumber'
  | 'bigIntAsNumber'
  | 'supportBigNumbers'
  | 'bigNumberStrings'
  | 'autoJsonMap'
  // This option is not necessary because we do not allow using decimalAsNumber,
  // insertIdAsNumber, nor bigIntAsNumber.
  // If someone requests to enable this option, do not accept it.
  // Instead, the same feature should be added to Sequelize as a cross-dialect feature.
  | 'checkNumberRange'
  // unsafe compatibility option
  | 'permitSetMultiParamEntries'
> {}

/**
 * Normalizes a charset or collation name for comparison (lowercase, `utf8` family unified).
 *
 * `utf8` is an alias whose meaning depends on the server: it is `utf8mb3` on
 * MariaDB <= 10.5, and on MariaDB >= 10.6 it resolves to `utf8mb3` only while the
 * server's `old_mode` includes `UTF8_IS_UTF8MB3` (the default until MariaDB 13.1,
 * where `utf8` becomes an alias of `utf8mb4`). The connector likewise resolves a
 * requested `utf8` charset to `utf8mb3`, but a requested `utf8_*` collation to
 * `utf8mb4`. The requested spelling therefore cannot be compared literally, so all
 * three names normalize to `utf8`: they share the same client-side escaping, which
 * means the escaper and the session are in sync for any match inside the family.
 *
 * @param name
 */
function normalizeName(name: string | undefined): string | undefined {
  if (name === undefined) {
    return undefined;
  }

  return name.toLowerCase().replace(/^utf8mb[34]/, 'utf8');
}

/**
 * MariaDB Connection Manager
 *
 * Get connections, validate and disconnect them.
 * AbstractConnectionManager pooling use it to handle MariaDB specific connections
 * Use https://github.com/MariaDB/mariadb-connector-nodejs to connect with MariaDB server
 */
export class MariaDbConnectionManager extends AbstractConnectionManager<
  MariaDbDialect,
  MariaDbConnection
> {
  readonly #lib: MariaDbModule;

  constructor(dialect: MariaDbDialect) {
    super(dialect);
    this.#lib = dialect.options.mariaDbModule ?? MariaDb;
  }

  #typeCast(field: MariaDb.FieldInfo, next: MariaDb.TypeCastNextFunction): MariaDb.TypeCastResult {
    const parser = this.dialect.getParserForDatabaseDataType(field.type);

    if (parser) {
      return parser(field) as MariaDb.TypeCastResult;
    }

    return next();
  }

  /**
   * Connect with MariaDB database based on config, Handle any errors in connection
   * Set the pool handlers on connection.error
   * Also set proper timezone once connection is connected.
   *
   * @param config
   */
  async connect(config: ConnectionOptions<MariaDbDialect>): Promise<MariaDbConnection> {
    // Named timezone is not supported in mariadb, convert to offset
    let tzOffset = this.sequelize.options.timezone;
    if (tzOffset.includes('/')) {
      try {
        tzOffset = timeZoneToOffsetString(tzOffset);
      } catch (error) {
        if (!isError(error)) {
          throw error;
        }

        throw new ConnectionError(error);
      }
    }

    const connectionConfig: MariaDb.ConnectionConfig = removeUndefined({
      foundRows: false,
      ...config,
      timezone: tzOffset,
      typeCast: (field: MariaDb.FieldInfo, next: MariaDb.TypeCastNextFunction) =>
        this.#typeCast(field, next),
    });

    if (!this.sequelize.options.keepDefaultTimezone) {
      // set timezone for this connection
      if (connectionConfig.initSql) {
        if (!Array.isArray(connectionConfig.initSql)) {
          connectionConfig.initSql = [connectionConfig.initSql];
        }

        connectionConfig.initSql.push(`SET time_zone = '${tzOffset}'`);
      } else {
        connectionConfig.initSql = `SET time_zone = '${tzOffset}'`;
      }
    }

    try {
      const connection = await this.#lib.createConnection(connectionConfig);
      this.sequelize.setDatabaseVersion(semver.coerce(connection.serverVersion())!.version);

      debug('connection acquired');

      // Temporary no-op placeholder: the driver can emit 'error' before initializeConnection()
      // attaches the real handler below - unexpectedPacket() emits it directly for out-of-band
      // fatal packets. Without a listener here, that error would crash the process instead of
      // waiting to be handled, including while the charset check below is awaiting its query.
      connection.on('error', ignoreErrorUntilInitialized);

      try {
        await this.#assertServerHonoredCharset(connection, connectionConfig);
      } catch (error: unknown) {
        // do not leak the connection: it is not registered in the pool yet
        await connection.end().catch(() => {});

        throw error;
      }

      return connection;
    } catch (error: unknown) {
      if (!isErrorWithStringCode(error)) {
        throw error;
      }

      switch (error.code) {
        case 'ECONNREFUSED':
          throw new ConnectionRefusedError(error);
        case 'ER_ACCESS_DENIED_ERROR':
        case 'ER_ACCESS_DENIED_NO_PASSWORD_ERROR':
          throw new AccessDeniedError(error);
        case 'ENOTFOUND':
          throw new HostNotFoundError(error);
        case 'EHOSTUNREACH':
        case 'ENETUNREACH':
        case 'EADDRNOTAVAIL':
          throw new HostNotReachableError(error);
        case 'EINVAL':
          throw new InvalidConnectionError(error);
        default:
          throw new ConnectionError(error);
      }
    }
  }

  /**
   * Verifies that the server actually honored a user-requested `charset` or `collation`.
   *
   * The mariadb connector switches its client-side string escaper to the requested
   * charset even when the server does not support that charset and silently keeps the
   * session on the fallback one. Client and server then disagree on how bytes decode,
   * and a crafted string parameter can break out of its quotes (SQL injection) under
   * the default sql_mode. See https://github.com/sequelize/sequelize/issues/18282
   *
   * Fail fast instead of running with a desynced escaper.
   *
   * @param connection
   * @param connectionConfig
   */
  async #assertServerHonoredCharset(
    connection: MariaDbConnection,
    connectionConfig: MariaDb.ConnectionConfig,
  ): Promise<void> {
    const requested = connectionConfig.collation ?? connectionConfig.charset;

    // No explicit charset/collation requested: the connector and server negotiate
    // the default together, nothing to verify.
    if (requested === undefined) {
      return;
    }

    // The session is the only reliable source of what the server honored. The connector's
    // promise API resolves to a ConnectionPromise wrapper whose inner Connection (and its
    // resolved options) is a private field, and connection.info.collation is the server's
    // default collation from the initial handshake - neither reflects an explicit request.
    // When the server honors the request, @@character_set_client is the requested charset
    // or @@collation_connection is the requested collation; when it does not, the session
    // silently stays on the fallback.
    const rows: Array<{ coll?: string; cs?: string }> = await connection.query(
      'SELECT @@character_set_client AS cs, @@collation_connection AS coll',
    );

    const expected = normalizeName(requested);
    const sessionCharset = normalizeName(rows[0]?.cs);
    const sessionCollation = normalizeName(rows[0]?.coll);

    if (sessionCharset !== expected && sessionCollation !== expected) {
      throw new ConnectionError(
        new Error(
          `The MariaDB server does not support the requested charset/collation '${requested}' (session uses charset '${rows[0]?.cs}', collation '${rows[0]?.coll}'). ` +
            'Refusing to connect: the client-side string escaper would be desynced from the server, ' +
            'which can enable SQL injection (https://github.com/sequelize/sequelize/issues/18282).',
        ),
      );
    }
  }

  async initializeConnection(connection: MariaDbConnection): Promise<void> {
    connection.off('error', ignoreErrorUntilInitialized).on('error', error => {
      switch (error.code) {
        case 'ESOCKET':
        case 'ECONNRESET':
        case 'EPIPE':
        case 'PROTOCOL_CONNECTION_LOST':
          void this.sequelize.pool.destroy(connection);
          break;
        default:
      }
    });
  }

  async disconnect(connection: MariaDbConnection) {
    // Don't disconnect connections with CLOSED state
    if (!connection.isValid()) {
      debug('connection tried to disconnect but was already at CLOSED state');

      return;
    }

    await connection.end();
  }

  validate(connection: MariaDbConnection): boolean {
    return connection && connection.isValid();
  }
}
