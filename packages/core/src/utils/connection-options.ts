import { EMPTY_ARRAY, isString, parseSafeInteger } from '@sequelize/utils';
import path from 'node:path';
import { URL } from 'node:url';
import type { ConnectionOptions as PgConnectionOptions } from 'pg-connection-string';
import pgConnectionString from 'pg-connection-string';
import type { AbstractDialect, ConnectionOptions } from '../abstract-dialect/dialect.js';
import type { NormalizedReplicationOptions, RawConnectionOptions } from '../sequelize';
import type { PersistedSequelizeOptions } from '../sequelize.internals.js';
import { encodeHost } from './deprecations';

export function normalizeReplicationConfig<Dialect extends AbstractDialect>(
  dialect: Dialect,
  connectionOptions: RawConnectionOptions<Dialect>,
  replicationOption: PersistedSequelizeOptions<Dialect>['replication'],
): NormalizedReplicationOptions<Dialect> {
  const normalizedConnectionOptions = normalizeRawConnectionOptions(dialect, connectionOptions);

  return {
    write: {
      ...normalizedConnectionOptions,
      ...(replicationOption &&
        replicationOption.write &&
        normalizeRawConnectionOptions(dialect, replicationOption.write)),
    },
    read: !replicationOption
      ? EMPTY_ARRAY
      : replicationOption.read.map(readOptions => {
          return {
            ...normalizedConnectionOptions,
            ...normalizeRawConnectionOptions(dialect, readOptions),
          };
        }),
  };
}

function normalizeRawConnectionOptions<Dialect extends AbstractDialect>(
  dialect: Dialect,
  options: RawConnectionOptions<Dialect>,
): ConnectionOptions<Dialect> {
  if (isString(options)) {
    return parseConnectionString(dialect, options);
  }

  const { url, ...remainingOptions } = options;

  if (url) {
    return {
      ...parseConnectionString(dialect, url),
      ...remainingOptions,
    };
  }

  return remainingOptions;
}

/**
 * Parses a connection string into an Options object with connection properties
 *
 * @param dialect
 * @param connectionString string value in format schema://username:password@host:port/database
 */
export function parseConnectionString<Dialect extends AbstractDialect>(
  dialect: Dialect,
  connectionString: string,
): ConnectionOptions<Dialect> {
  const options: ConnectionOptions<Dialect> = {};

  // The following connectionStrings are not valid URLs, but they are supported by sqlite.
  if (connectionString === 'sqlite://:memory:' || connectionString === 'sqlite::memory:') {
    // @ts-expect-error -- TODO: move url parsing to a dialect-specific function.
    options.storage = ':memory:';

    return options;
  }

  const urlObject = new URL(connectionString);

  if (urlObject.hostname != null) {
    // TODO: rename options.host to options.hostname, as host can accept a port while hostname can't
    // @ts-expect-error -- TODO: move url parsing to a dialect-specific function.
    options.host = decodeURIComponent(urlObject.hostname);
  }

  if (urlObject.pathname) {
    // decode the URI component from urlObject.pathname value
    // @ts-expect-error -- TODO: move url parsing to a dialect-specific function.
    options.database = decodeURIComponent(urlObject.pathname.replace(/^\//, ''));
  }

  if (urlObject.port) {
    // @ts-expect-error -- TODO: move url parsing to a dialect-specific function.
    options.port = parseSafeInteger.orThrow(urlObject.port);
  }

  if (urlObject.username) {
    // @ts-expect-error -- TODO: move url parsing to a dialect-specific function.
    options.user = decodeURIComponent(urlObject.username);
  }

  if (urlObject.password) {
    // @ts-expect-error -- TODO: move url parsing to a dialect-specific function.
    options.password = decodeURIComponent(urlObject.password);
  }

  if (urlObject.searchParams) {
    // Allow host query argument to override the url host.
    // Enables specifying domain socket hosts which cannot be specified via the typical
    // host part of a url.
    // TODO: remove this workaround in Sequelize 8
    if (urlObject.searchParams.has('host')) {
      encodeHost();
      // @ts-expect-error -- TODO: move url parsing to a dialect-specific function.
      options.host = decodeURIComponent(urlObject.searchParams.get('host')!);
    }

    if (dialect.name === 'sqlite' && urlObject.pathname) {
      // @ts-expect-error -- TODO: move url parsing to a dialect-specific function.
      const storagePath = path.join(options.host, urlObject.pathname);
      // @ts-expect-error -- TODO: move url parsing to a dialect-specific function.
      delete options.host;
      // @ts-expect-error -- TODO: move url parsing to a dialect-specific function.
      options.storage = path.resolve(options.storage || storagePath);
    }

    for (const [key, value] of urlObject.searchParams.entries()) {
      // @ts-expect-error -- TODO: move url parsing to a dialect-specific function.
      options[key] = value;
    }

    if (urlObject.searchParams.has('options')) {
      try {
        const o = JSON.parse(urlObject.searchParams.get('options')!);
        // @ts-expect-error -- TODO: move url parsing to a dialect-specific function.
        options.options = o;
      } catch {
        // Nothing to do, string is not a valid JSON
        // and thus does not need any further processing
      }
    }
  }

  // For postgres, we can use this helper to load certs directly from the
  // connection string.
  if (dialect.name === 'postgres') {
    const parseResult: Partial<PgConnectionOptions> = pgConnectionString.parse(connectionString);

    delete parseResult.database;
    delete parseResult.password;
    delete parseResult.user;
    delete parseResult.host;
    delete parseResult.port;
    delete parseResult.options; // we JSON.parse it

    Object.assign(options, parseResult);
  }

  return options;
}
