import type { PickByType } from '@sequelize/utils';
import { getSynchronizedTypeKeys } from '@sequelize/utils';
import type { HanaConnectionOptions } from '../connection-manager.js';

type StringConnectionOptions = PickByType<HanaConnectionOptions, string>;

const STRING_CONNECTION_OPTION_MAP = {
  host: undefined,
  // port: undefined,
  database: undefined,
  username: undefined,
  password: undefined,
} as const satisfies Record<keyof StringConnectionOptions, undefined>;

export const STRING_CONNECTION_OPTION_NAMES = getSynchronizedTypeKeys<StringConnectionOptions>(
  STRING_CONNECTION_OPTION_MAP,
);

type BooleanConnectionOptions = PickByType<HanaConnectionOptions, boolean>;

const BOOLEAN_CONNECTION_OPTION_MAP = {
  binary: undefined,
  keepAlive: undefined,
  ssl: undefined,
  statement_timeout: undefined,
} as const satisfies Record<keyof BooleanConnectionOptions, undefined>;

export const BOOLEAN_CONNECTION_OPTION_NAMES = getSynchronizedTypeKeys<BooleanConnectionOptions>(
  BOOLEAN_CONNECTION_OPTION_MAP,
);

type NumberConnectionOptions = PickByType<HanaConnectionOptions, number>;

const NUMBER_CONNECTION_OPTION_MAP = {
  port: undefined,
} as const satisfies Record<keyof NumberConnectionOptions, undefined>;

export const NUMBER_CONNECTION_OPTION_NAMES = getSynchronizedTypeKeys<NumberConnectionOptions>(
  NUMBER_CONNECTION_OPTION_MAP,
);

export const CONNECTION_OPTION_NAMES = getSynchronizedTypeKeys<HanaConnectionOptions>({
  ...STRING_CONNECTION_OPTION_MAP,
  ...BOOLEAN_CONNECTION_OPTION_MAP,
  ...NUMBER_CONNECTION_OPTION_MAP,
});
