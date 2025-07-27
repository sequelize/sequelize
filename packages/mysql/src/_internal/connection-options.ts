import type { PickByType } from '@sequelize/utils';
import { getSynchronizedTypeKeys } from '@sequelize/utils';
import type { MySqlConnectionOptions } from '../connection-manager.js';

type AnyOptions = 'debug' | 'stream';

type StringConnectionOptions = PickByType<Omit<MySqlConnectionOptions, AnyOptions>, string>;

const STRING_CONNECTION_OPTION_MAP: Record<keyof StringConnectionOptions, undefined> = {
  charset: undefined,
  database: undefined,
  host: undefined,
  localAddress: undefined,
  password: undefined,
  password1: undefined,
  password2: undefined,
  password3: undefined,
  passwordSha1: undefined,
  socketPath: undefined,
  ssl: undefined,
  user: undefined,
} as const;

export const STRING_CONNECTION_OPTION_NAMES = getSynchronizedTypeKeys<StringConnectionOptions>(
  STRING_CONNECTION_OPTION_MAP,
);

type BooleanConnectionOptions = PickByType<Omit<MySqlConnectionOptions, AnyOptions>, boolean>;

const BOOLEAN_CONNECTION_OPTION_MAP = {
  compress: undefined,
  disableEval: undefined,
  enableKeepAlive: undefined,
  insecureAuth: undefined,
  isServer: undefined,
  jsonStrings: undefined,
  multipleStatements: undefined,
  trace: undefined,
  waitForConnections: undefined,
} as const satisfies Record<keyof BooleanConnectionOptions, undefined>;

export const BOOLEAN_CONNECTION_OPTION_NAMES = getSynchronizedTypeKeys<BooleanConnectionOptions>(
  BOOLEAN_CONNECTION_OPTION_MAP,
);

type NumberConnectionOptions = PickByType<Omit<MySqlConnectionOptions, AnyOptions>, number>;

const NUMBER_CONNECTION_OPTION_MAP = {
  port: undefined,
  connectionLimit: undefined,
  connectTimeout: undefined,
  charsetNumber: undefined,
  maxIdle: undefined,
  queueLimit: undefined,
  idleTimeout: undefined,
  maxPreparedStatements: undefined,
  keepAliveInitialDelay: undefined,
} as const satisfies Record<keyof NumberConnectionOptions, undefined>;

export const NUMBER_CONNECTION_OPTION_NAMES = getSynchronizedTypeKeys<NumberConnectionOptions>(
  NUMBER_CONNECTION_OPTION_MAP,
);

export const CONNECTION_OPTION_NAMES = getSynchronizedTypeKeys<MySqlConnectionOptions>({
  ...STRING_CONNECTION_OPTION_MAP,
  ...BOOLEAN_CONNECTION_OPTION_MAP,
  ...NUMBER_CONNECTION_OPTION_MAP,
  infileStreamFactory: undefined,
  flags: undefined,
  authSwitchHandler: undefined,
  connectAttributes: undefined,
  authPlugins: undefined,
  debug: undefined,
  stream: undefined,
});
