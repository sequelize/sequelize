import type { PickByType } from '@sequelize/utils';
import {
  EMPTY_ARRAY,
  inspect,
  isString,
  join,
  parseBoolean,
  parseFiniteNumber,
  parseSafeInteger,
  pojo,
} from '@sequelize/utils';
import type { StringKeyOf } from 'type-fest';
import type { AbstractDialect, ConnectionOptions } from '../abstract-dialect/dialect.js';
import type { NormalizedReplicationOptions, RawConnectionOptions } from '../sequelize';
import type { PersistedSequelizeOptions } from '../sequelize.internals.js';

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
    return dialect.parseConnectionUrl(options);
  }

  const { url, ...remainingOptions } = options;

  if (url) {
    return {
      ...dialect.parseConnectionUrl(url),
      ...remainingOptions,
    };
  }

  return remainingOptions;
}

export function parseCommonConnectionUrlOptions<TConnectionOptions extends object>(options: {
  url: URL | string;

  /**
   * The list of protocols that the URL can use
   */
  allowedProtocols: readonly string[];

  /**
   * The name of the dialect-specific connection option to use for the hostname
   */
  hostname: keyof PickByType<TConnectionOptions, string>;

  /**
   * The name of the dialect-specific connection option to use for the port
   */
  port: keyof PickByType<TConnectionOptions, number>;

  /**
   * The name of the dialect-specific connection option to use for the database name
   */
  pathname: keyof PickByType<TConnectionOptions, string>;

  /**
   * The name of the dialect-specific connection option to use for the username
   *
   * If not provided, the username will be ignored
   */
  username?: keyof PickByType<TConnectionOptions, string>;

  /**
   * The name of the dialect-specific connection option to use for the password
   *
   * If not provided, the password will be ignored
   */
  password?: keyof PickByType<TConnectionOptions, string>;

  /**
   * The string options that can be set via the search parameters in the URL
   */
  stringSearchParams?: ReadonlyArray<StringKeyOf<PickByType<TConnectionOptions, string>>>;

  /**
   * The boolean options that can be set via the search parameters in the URL.
   * Will be parsed as a boolean.
   */
  booleanSearchParams?: ReadonlyArray<StringKeyOf<PickByType<TConnectionOptions, boolean>>>;

  /**
   * The number options that can be set via the search parameters in the URL.
   * Will be parsed as a JS number.
   */
  numberSearchParams?: ReadonlyArray<StringKeyOf<PickByType<TConnectionOptions, number>>>;
}): TConnectionOptions {
  const url: URL = isString(options.url) ? new URL(options.url) : options.url;

  const assignTo = pojo<TConnectionOptions>();

  const scheme = url.protocol.slice(0, -1);
  if (!options.allowedProtocols.includes(scheme)) {
    throw new Error(
      `URL ${inspect(url.toString())} is not a valid connection URL. Expected the protocol to be one of ${options.allowedProtocols.map(inspect).join(', ')}, but it's ${inspect(scheme)}.`,
    );
  }

  if (url.hostname) {
    // @ts-expect-error -- the above typings ensure this is a string
    assignTo[options.hostname] = decodeURIComponent(url.hostname);
  }

  if (url.port) {
    // @ts-expect-error -- the above typings ensure this is a number
    assignTo[options.port] = parseSafeInteger.orThrow(url.port);
  }

  if (url.pathname) {
    // @ts-expect-error -- the above typings ensure this is a string
    assignTo[options.pathname] = decodeURIComponent(url.pathname.replace(/^\//, ''));
  }

  if (options.username && url.username) {
    // @ts-expect-error -- the above typings ensure this is a string
    assignTo[options.username] = decodeURIComponent(url.username);
  }

  if (options.password && url.password) {
    // @ts-expect-error -- the above typings ensure this is a string
    assignTo[options.password] = decodeURIComponent(url.password);
  }

  const allSearchParams = new Set<string>([
    ...(options.stringSearchParams ?? EMPTY_ARRAY),
    ...(options.booleanSearchParams ?? EMPTY_ARRAY),
    ...(options.numberSearchParams ?? EMPTY_ARRAY),
  ]);

  if (url.searchParams) {
    for (const key of url.searchParams.keys()) {
      if (!allSearchParams.has(key)) {
        throw new Error(
          `Option ${inspect(key)} cannot be set as a connection URL search parameter. Only the following options can be set: ${join(allSearchParams, ', ')}`,
        );
      }

      if (options.stringSearchParams?.includes(key as any)) {
        // @ts-expect-error -- the above typings ensure this is a string
        assignTo[key] = url.searchParams.get(key)!;
      }

      try {
        if (options.booleanSearchParams?.includes(key as any)) {
          // @ts-expect-error -- the above typings ensure this is a boolean
          assignTo[key] = parseBoolean.orThrow(url.searchParams.get(key));
        }

        if (options.numberSearchParams?.includes(key as any)) {
          // @ts-expect-error -- the above typings ensure this is a number
          assignTo[key] = parseFiniteNumber.orThrow(url.searchParams.get(key));
        }
      } catch (error) {
        throw new Error(`Could not parse URL search parameter ${key}`, { cause: error });
      }
    }
  }

  return assignTo;
}
