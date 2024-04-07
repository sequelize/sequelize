import { getSynchronizedTypeKeys, type PickByType } from '@sequelize/utils';
import type { MariaDbConnectionOptions } from '../connection-manager.js';

type StringConnectionOptions = PickByType<MariaDbConnectionOptions, string>;

const STRING_CONNECTION_OPTION_MAP = {
  cachingRsaPublicKey: undefined,
  charset: undefined,
  collation: undefined,
  connectAttributes: undefined,
  database: undefined,
  host: undefined,
  initSql: undefined,
  password: undefined,
  rsaPublicKey: undefined,
  sessionVariables: undefined,
  socketPath: undefined,
  user: undefined,
} as const satisfies Record<keyof StringConnectionOptions, undefined>;

export const STRING_CONNECTION_OPTION_NAMES = getSynchronizedTypeKeys<StringConnectionOptions>(
  STRING_CONNECTION_OPTION_MAP,
);

type BooleanConnectionOptions = PickByType<MariaDbConnectionOptions, boolean>;

const BOOLEAN_CONNECTION_OPTION_MAP = {
  debug: undefined,
  debugCompress: undefined,
  logParam: undefined,
  trace: undefined,
  multipleStatements: undefined,
  ssl: undefined,
  compress: undefined,
  logPackets: undefined,
  forceVersionCheck: undefined,
  foundRows: undefined,
  sessionVariables: undefined,
  allowPublicKeyRetrieval: undefined,
  metaEnumerable: undefined,
  connectAttributes: undefined,
  permitSetMultiParamEntries: undefined,
  bulk: undefined,
  pipelining: undefined,
  permitLocalInfile: undefined,
  autoJsonMap: undefined,
  arrayParenthesis: undefined,
  checkDuplicate: undefined,
  checkNumberRange: undefined,
} as const satisfies Record<keyof BooleanConnectionOptions, undefined>;

export const BOOLEAN_CONNECTION_OPTION_NAMES = getSynchronizedTypeKeys<BooleanConnectionOptions>(
  BOOLEAN_CONNECTION_OPTION_MAP,
);

type NumberConnectionOptions = PickByType<MariaDbConnectionOptions, number>;

const NUMBER_CONNECTION_OPTION_MAP = {
  port: undefined,
  connectTimeout: undefined,
  socketTimeout: undefined,
  debugLen: undefined,
  sessionVariables: undefined,
  maxAllowedPacket: undefined,
  keepAliveDelay: undefined,
  prepareCacheLength: undefined,
  connectAttributes: undefined,
  timeout: undefined,
} as const satisfies Record<keyof NumberConnectionOptions, undefined>;

export const NUMBER_CONNECTION_OPTION_NAMES = getSynchronizedTypeKeys<NumberConnectionOptions>(
  NUMBER_CONNECTION_OPTION_MAP,
);

export const CONNECTION_OPTION_NAMES = getSynchronizedTypeKeys<MariaDbConnectionOptions>({
  ...STRING_CONNECTION_OPTION_MAP,
  ...BOOLEAN_CONNECTION_OPTION_MAP,
  ...NUMBER_CONNECTION_OPTION_MAP,
  stream: undefined,
  infileStreamFactory: undefined,
  logger: undefined,
});
