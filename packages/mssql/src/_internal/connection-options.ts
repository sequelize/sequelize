import { getSynchronizedTypeKeys, type NonUndefined, type PickByType } from '@sequelize/utils';
import type * as Tedious from 'tedious';
import type { MsSqlConnectionOptions } from '../connection-manager.js';

export type InlinedTediousOptions = Omit<
  NonUndefined<Tedious.ConnectionConfiguration['options']>,
  // Default nullability of columns is not needed as Sequelize explicitly sets it,
  // and this option will be confusing with Sequelize's option about default nullability.
  | 'enableAnsiNullDefault'
  | 'camelCaseColumns'
  | 'columnNameReplacer'
  | 'enableQuotedIdentifier'
  | 'useUTC'
  | 'useColumnNames'
  // Conflicts with our own isolationLevel option, which does the same thing
  | 'isolationLevel'
>;

export const INLINED_OPTION_OBJ = {
  abortTransactionOnError: undefined,
  appName: undefined,
  cancelTimeout: undefined,
  connectTimeout: undefined,
  connectionIsolationLevel: undefined,
  connectionRetryInterval: undefined,
  connector: undefined,
  cryptoCredentialsDetails: undefined,
  database: undefined,
  dateFormat: undefined,
  datefirst: undefined,
  debug: undefined,
  enableAnsiNull: undefined,
  enableAnsiPadding: undefined,
  enableAnsiWarnings: undefined,
  enableArithAbort: undefined,
  enableConcatNullYieldsNull: undefined,
  enableCursorCloseOnCommit: undefined,
  enableImplicitTransactions: undefined,
  enableNumericRoundabort: undefined,
  encrypt: undefined,
  fallbackToDefaultDb: undefined,
  instanceName: undefined,
  language: undefined,
  localAddress: undefined,
  lowerCaseGuids: undefined,
  maxRetriesOnTransientErrors: undefined,
  multiSubnetFailover: undefined,
  packetSize: undefined,
  port: undefined,
  readOnlyIntent: undefined,
  requestTimeout: undefined,
  rowCollectionOnDone: undefined,
  rowCollectionOnRequestCompletion: undefined,
  serverName: undefined,
  tdsVersion: undefined,
  textsize: undefined,
  trustServerCertificate: undefined,
  workstationId: undefined,
} as const satisfies Record<keyof InlinedTediousOptions, undefined>;

export const INLINED_OPTION_NAMES =
  getSynchronizedTypeKeys<InlinedTediousOptions>(INLINED_OPTION_OBJ);

export const CONNECTION_OPTION_NAMES = getSynchronizedTypeKeys<MsSqlConnectionOptions>({
  ...INLINED_OPTION_OBJ,
  authentication: undefined,
  server: undefined,
});

type StringConnectionOptions = PickByType<MsSqlConnectionOptions, string>;

export const STRING_CONNECTION_OPTION_NAMES = getSynchronizedTypeKeys<StringConnectionOptions>({
  appName: undefined,
  database: undefined,
  dateFormat: undefined,
  encrypt: undefined,
  instanceName: undefined,
  language: undefined,
  localAddress: undefined,
  server: undefined,
  serverName: undefined,
  tdsVersion: undefined,
  workstationId: undefined,
});

type BooleanConnectionOptions = PickByType<MsSqlConnectionOptions, boolean>;

export const BOOLEAN_CONNECTION_OPTION_NAMES = getSynchronizedTypeKeys<BooleanConnectionOptions>({
  abortTransactionOnError: undefined,
  enableAnsiNull: undefined,
  enableAnsiPadding: undefined,
  enableAnsiWarnings: undefined,
  enableArithAbort: undefined,
  enableConcatNullYieldsNull: undefined,
  enableCursorCloseOnCommit: undefined,
  enableImplicitTransactions: undefined,
  enableNumericRoundabort: undefined,
  encrypt: undefined,
  fallbackToDefaultDb: undefined,
  lowerCaseGuids: undefined,
  multiSubnetFailover: undefined,
  readOnlyIntent: undefined,
  rowCollectionOnDone: undefined,
  rowCollectionOnRequestCompletion: undefined,
  trustServerCertificate: undefined,
});

type NumberConnectionOptions = PickByType<MsSqlConnectionOptions, number>;

export const NUMBER_CONNECTION_OPTION_NAMES = getSynchronizedTypeKeys<NumberConnectionOptions>({
  cancelTimeout: undefined,
  connectionRetryInterval: undefined,
  connectTimeout: undefined,
  connectionIsolationLevel: undefined,
  datefirst: undefined,
  maxRetriesOnTransientErrors: undefined,
  packetSize: undefined,
  port: undefined,
  requestTimeout: undefined,
  textsize: undefined,
});
