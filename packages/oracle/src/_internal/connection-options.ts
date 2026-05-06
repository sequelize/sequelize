// Copyright (c) 2025, Oracle and/or its affiliates. All rights reserved

import type { PickByType } from '@sequelize/utils';
import { getSynchronizedTypeKeys } from '@sequelize/utils';
import type { OracleConnectionOptions } from '../connection-manager.js';

type StringConnectionOptions = PickByType<OracleConnectionOptions, string>;

const STRING_CONNECTION_OPTION_MAP = {
  configDir: undefined,
  connectionIdPrefix: undefined,
  connectString: undefined,
  database: undefined,
  debugJdwp: undefined,
  driverName: undefined,
  edition: undefined,
  host: undefined,
  httpsProxy: undefined,
  machine: undefined,
  newPassword: undefined,
  osUser: undefined,
  password: undefined,
  poolAlias: undefined,
  program: undefined,
  sourceRoute: undefined,
  sslServerCertDN: undefined,
  tag: undefined,
  terminal: undefined,
  username: undefined,
  walletPassword: undefined,
  walletLocation: undefined,
  walletContent: undefined,
} as const satisfies Record<keyof StringConnectionOptions, undefined>;

export const STRING_CONNECTION_OPTION_NAMES = getSynchronizedTypeKeys<StringConnectionOptions>(
  STRING_CONNECTION_OPTION_MAP,
);

type BooleanConnectionOptions = PickByType<OracleConnectionOptions, boolean>;

const BOOLEAN_CONNECTION_OPTION_MAP = {
  events: undefined,
  externalAuth: undefined,
  matchAny: undefined,
  networkCompression: undefined,
  sslAllowWeakDNMatch: undefined,
  sslServerDNMatch: undefined,
  useSNI: undefined,
} as const satisfies Record<keyof BooleanConnectionOptions, undefined>;

export const BOOLEAN_CONNECTION_OPTION_NAMES = getSynchronizedTypeKeys<BooleanConnectionOptions>(
  BOOLEAN_CONNECTION_OPTION_MAP,
);

type NumberConnectionOptions = PickByType<OracleConnectionOptions, number>;

const NUMBER_CONNECTION_OPTION_MAP = {
  connectTimeout: undefined,
  expireTime: undefined,
  httpsProxyPort: undefined,
  networkCompressionThreshold: undefined,
  port: undefined,
  privilege: undefined,
  retryCount: undefined,
  retryDelay: undefined,
  sdu: undefined,
  stmtCacheSize: undefined,
  transportConnectTimeout: undefined,
} as const satisfies Record<keyof NumberConnectionOptions, undefined>;

export const NUMBER_CONNECTION_OPTION_NAMES = getSynchronizedTypeKeys<NumberConnectionOptions>(
  NUMBER_CONNECTION_OPTION_MAP,
);

export const CONNECTION_OPTION_NAMES = getSynchronizedTypeKeys<OracleConnectionOptions>({
  ...STRING_CONNECTION_OPTION_MAP,
  ...BOOLEAN_CONNECTION_OPTION_MAP,
  ...NUMBER_CONNECTION_OPTION_MAP,
  appContext: undefined,
  accessToken: undefined,
  accessTokenConfig: undefined,
  shardingKey: undefined,
  superShardingKey: undefined,
});
