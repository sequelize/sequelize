import { getSynchronizedTypeKeys, type PickByType } from '@sequelize/utils';
import type { MariaDbConnectionOptions } from '../connection-manager.js';

/** Options that are typed as "any" */
type AnyOptions = 'sessionVariables' | 'connectAttributes';

type StringConnectionOptions = PickByType<Omit<MariaDbConnectionOptions, AnyOptions>, string>;

const STRING_CONNECTION_OPTION_MAP = {
  cachingRsaPublicKey: undefined,
  charset: undefined,
  collation: undefined,
  database: undefined,
  host: undefined,
  initSql: undefined,
  password: undefined,
  rsaPublicKey: undefined,
  socketPath: undefined,
  user: undefined,
} as const satisfies Record<keyof StringConnectionOptions, undefined>;

export const STRING_CONNECTION_OPTION_NAMES = getSynchronizedTypeKeys<StringConnectionOptions>(
  STRING_CONNECTION_OPTION_MAP,
);

type BooleanConnectionOptions = PickByType<Omit<MariaDbConnectionOptions, AnyOptions>, boolean>;

const BOOLEAN_CONNECTION_OPTION_MAP = {
  debug: undefined,
  debugCompress: undefined,
  // TODO: https://github.com/sequelize/sequelize/issues/11832 - replace with a unified "logging" option
  logParam: undefined,
  trace: undefined,
  multipleStatements: undefined,
  ssl: undefined,
  compress: undefined,
  logPackets: undefined,
  forceVersionCheck: undefined,
  foundRows: undefined,
  allowPublicKeyRetrieval: undefined,
  metaEnumerable: undefined,
  bulk: undefined,
  pipelining: undefined,
  permitLocalInfile: undefined,
  checkDuplicate: undefined,
} as const satisfies Record<keyof BooleanConnectionOptions, undefined>;

export const BOOLEAN_CONNECTION_OPTION_NAMES = getSynchronizedTypeKeys<BooleanConnectionOptions>(
  BOOLEAN_CONNECTION_OPTION_MAP,
);

type NumberConnectionOptions = PickByType<Omit<MariaDbConnectionOptions, AnyOptions>, number>;

const NUMBER_CONNECTION_OPTION_MAP = {
  port: undefined,
  connectTimeout: undefined,
  socketTimeout: undefined,
  debugLen: undefined,
  maxAllowedPacket: undefined,
  keepAliveDelay: undefined,
  prepareCacheLength: undefined,
  queryTimeout: undefined,
} as const satisfies Record<keyof NumberConnectionOptions, undefined>;

export const NUMBER_CONNECTION_OPTION_NAMES = getSynchronizedTypeKeys<NumberConnectionOptions>(
  NUMBER_CONNECTION_OPTION_MAP,
);

export const CONNECTION_OPTION_NAMES = getSynchronizedTypeKeys<MariaDbConnectionOptions>({
  ...STRING_CONNECTION_OPTION_MAP,
  ...BOOLEAN_CONNECTION_OPTION_MAP,
  ...NUMBER_CONNECTION_OPTION_MAP,
  connectAttributes: undefined,
  infileStreamFactory: undefined,
  // TODO: https://github.com/sequelize/sequelize/issues/11832 - replace with a unified "logging" option
  logger: undefined,
  sessionVariables: undefined,
  stream: undefined,
});
