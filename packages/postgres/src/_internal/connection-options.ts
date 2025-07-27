import type { PickByType } from '@sequelize/utils';
import { getSynchronizedTypeKeys } from '@sequelize/utils';
import type { PostgresConnectionOptions } from '../connection-manager.js';

type StringConnectionOptions = PickByType<PostgresConnectionOptions, string>;

const STRING_CONNECTION_OPTION_MAP = {
  application_name: undefined,
  client_encoding: undefined,
  database: undefined,
  host: undefined,
  options: undefined,
  password: undefined,
  user: undefined,
} as const satisfies Record<keyof StringConnectionOptions, undefined>;

export const STRING_CONNECTION_OPTION_NAMES = getSynchronizedTypeKeys<StringConnectionOptions>(
  STRING_CONNECTION_OPTION_MAP,
);

type BooleanConnectionOptions = PickByType<PostgresConnectionOptions, boolean>;

const BOOLEAN_CONNECTION_OPTION_MAP = {
  binary: undefined,
  keepAlive: undefined,
  ssl: undefined,
  statement_timeout: undefined,
} as const satisfies Record<keyof BooleanConnectionOptions, undefined>;

export const BOOLEAN_CONNECTION_OPTION_NAMES = getSynchronizedTypeKeys<BooleanConnectionOptions>(
  BOOLEAN_CONNECTION_OPTION_MAP,
);

type NumberConnectionOptions = PickByType<PostgresConnectionOptions, number>;

const NUMBER_CONNECTION_OPTION_MAP = {
  port: undefined,
  statement_timeout: undefined,
  query_timeout: undefined,
  keepAliveInitialDelayMillis: undefined,
  idle_in_transaction_session_timeout: undefined,
  connectionTimeoutMillis: undefined,
  lock_timeout: undefined,
} as const satisfies Record<keyof NumberConnectionOptions, undefined>;

export const NUMBER_CONNECTION_OPTION_NAMES = getSynchronizedTypeKeys<NumberConnectionOptions>(
  NUMBER_CONNECTION_OPTION_MAP,
);

export const CONNECTION_OPTION_NAMES = getSynchronizedTypeKeys<PostgresConnectionOptions>({
  ...STRING_CONNECTION_OPTION_MAP,
  ...BOOLEAN_CONNECTION_OPTION_MAP,
  ...NUMBER_CONNECTION_OPTION_MAP,
  stream: undefined,
});
