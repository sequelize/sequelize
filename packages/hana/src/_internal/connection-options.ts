import type { PickByType } from '@sequelize/utils';
import { getSynchronizedTypeKeys } from '@sequelize/utils';
import type { HanaConnectionOptions } from '../connection-manager.js';

type StringConnectionOptions = PickByType<HanaConnectionOptions, string>;

const STRING_CONNECTION_OPTION_MAP = {
  host: undefined,
  database: undefined,
  user: undefined,
  password: undefined,
  currentSchema: undefined,
  ca: undefined,
  cert: undefined,
  charset: undefined,
  key: undefined,
  passphrase: undefined,
  poolKey: undefined,
  serverNode: undefined,
  threadPoolKey: undefined,
  vectorOutputType: undefined,
  bindAddress: undefined,
  cursorHoldabilityType: undefined,
  distribution: undefined,
  isoTimestampOutput: undefined,
  networkGroup: undefined,
  proxyHostname: undefined,
  proxyPassword: undefined,
  proxyScpAccount: undefined,
  proxyUserName: undefined,
  resolveHostName: undefined,
  sessionVariable: undefined,
  siteType: undefined,
  traceFile: undefined,
  traceOptions: undefined,
  webSocketURL: undefined,
  cseKeyStorePassword: undefined,
  authenticationMethods: undefined,
  authenticationX509: undefined,
  authenticationX509Password: undefined,
  sslCryptoProvider: undefined,
  sslHostNameInCertificate: undefined,
  sslKeyStore: undefined,
  sslMinProtocolVersion: undefined,
  sslMaxProtocolVersion: undefined,
  sslKeyStorePassword: undefined,
  sslSNIHostname: undefined,
  sslTrustStore: undefined,
} as const satisfies Record<keyof StringConnectionOptions, undefined>;

export const STRING_CONNECTION_OPTION_NAMES = getSynchronizedTypeKeys<StringConnectionOptions>(
  STRING_CONNECTION_OPTION_MAP,
);

type BooleanConnectionOptions = PickByType<HanaConnectionOptions, boolean>;

const BOOLEAN_CONNECTION_OPTION_MAP = {
  allowFetchWarnings: undefined,
  dataTruncationError: undefined,
  pooling: undefined,
  poolingCheck: undefined,
  spatialTypes: undefined,
  abapVarCharMode: undefined,
  allowLocalCompress: undefined,
  allowReconnectOnSelect: undefined,
  chopBlanks: undefined,
  chopBlanksInput: undefined,
  compress: undefined,
  connDownRollbackError: undefined,
  emptyTimestampIsNull: undefined,
  ignoreTopology: undefined,
  packetCaching: undefined,
  prefetch: undefined,
  proxyHttp: undefined,
  reconnect: undefined,
  routeDirectExecute: undefined,
  secondarySessionFallback: undefined,
  splitBatchCommands: undefined,
  statementRoutingFailureBackoff: undefined,
  statementRoutingWarnings: undefined,
  tcpQuickAck: undefined,
  timestampPadding: undefined,
  encrypt: undefined,
  sslSNIRequest: undefined,
  sslUseDefaultTrustStore: undefined,
  sslValidateCertificate: undefined,
} as const satisfies Record<keyof BooleanConnectionOptions, undefined>;

export const BOOLEAN_CONNECTION_OPTION_NAMES = getSynchronizedTypeKeys<BooleanConnectionOptions>(
  BOOLEAN_CONNECTION_OPTION_MAP,
);

type NumberConnectionOptions = PickByType<HanaConnectionOptions, number>;

const NUMBER_CONNECTION_OPTION_MAP = {
  port: undefined,
  connectionLifetime: undefined,
  maxPoolSize: undefined,
  maxPooledIdleTime: undefined,
  resultSetArrayLimitMB: undefined,
  resultSetRowSetLimitKBValue: undefined,
  communicationTimeout: undefined,
  connectTimeout: undefined,
  maxLazyDroppedStatements: undefined,
  nodeConnectTimeout: undefined,
  packetSize: undefined,
  packetSizeLimit: undefined,
  proxyPort: undefined,
  statementCacheSize: undefined,
  tcpKeepAliveCount: undefined,
  tcpKeepAliveIdle: undefined,
  tcpKeepAliveInterval: undefined,
  tcpUserTimeout: undefined,
  tcpSynCnt: undefined,
} as const satisfies Record<keyof NumberConnectionOptions, undefined>;

export const NUMBER_CONNECTION_OPTION_NAMES = getSynchronizedTypeKeys<NumberConnectionOptions>(
  NUMBER_CONNECTION_OPTION_MAP,
);

export const CONNECTION_OPTION_NAMES = getSynchronizedTypeKeys<HanaConnectionOptions>({
  ...STRING_CONNECTION_OPTION_MAP,
  ...BOOLEAN_CONNECTION_OPTION_MAP,
  ...NUMBER_CONNECTION_OPTION_MAP,
});
