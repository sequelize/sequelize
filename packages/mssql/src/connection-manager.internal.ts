import { getSynchronizedTypeKeys, type NonUndefined } from '@sequelize/utils';
import type * as Tedious from 'tedious';

export type InlinedTediousOptions = Omit<
  NonUndefined<Tedious.ConnectionConfiguration['options']>,
  'camelCaseColumns' | 'columnNameReplacer' | 'enableQuotedIdentifier' | 'useUTC' | 'useColumnNames'
>;

export const INLINED_OPTION_OBJ = {
  port: undefined,
  abortTransactionOnError: undefined,
  appName: undefined,
  cancelTimeout: undefined,
  connectionRetryInterval: undefined,
  connector: undefined,
  connectTimeout: undefined,
  connectionIsolationLevel: undefined,
  cryptoCredentialsDetails: undefined,
  database: undefined,
  datefirst: undefined,
  dateFormat: undefined,
  debug: undefined,
  enableAnsiNull: undefined,
  enableAnsiNullDefault: undefined,
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
  isolationLevel: undefined,
  language: undefined,
  localAddress: undefined,
  lowerCaseGuids: undefined,
  maxRetriesOnTransientErrors: undefined,
  multiSubnetFailover: undefined,
  packetSize: undefined,
  readOnlyIntent: undefined,
  requestTimeout: undefined,
  rowCollectionOnDone: undefined,
  rowCollectionOnRequestCompletion: undefined,
  tdsVersion: undefined,
  textsize: undefined,
  trustServerCertificate: undefined,
  serverName: undefined,
  workstationId: undefined,
} as const satisfies Record<keyof InlinedTediousOptions, undefined>;

export const INLINED_OPTION_NAMES =
  getSynchronizedTypeKeys<InlinedTediousOptions>(INLINED_OPTION_OBJ);
