// Copyright (c) 2024, Oracle and/or its affiliates. All rights reserved

import type { Sequelize } from '@sequelize/core';
import { AbstractDialect } from '@sequelize/core';
import type { SupportableNumericOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/dialect.js';
import { createNamedParamBindCollector } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/sql.js';
import { getSynchronizedTypeKeys } from '@sequelize/utils';
import * as DataTypes from './_internal/data-types-overrides';
import { OracleConnectionManager } from './connection-manager';
import type { OracleConnectionOptions, oracledbModule } from './connection-manager.js';
import { OracleQueryGenerator } from './query-generator.js';
import { OracleQueryInterface } from './query-interface.js';
import { OracleQuery } from './query.js';

export interface OracleDialectOptions {
  /**
   *  The oracledb module to user.
   */
  oracledbModule?: oracledbModule;
}

const CONNECTION_OPTION_NAMES = getSynchronizedTypeKeys<OracleConnectionOptions>({
  database: undefined,
  host: undefined,
  oracleOptions: undefined,
  port: undefined,
  accessToken: undefined,
  accessTokenConfig: undefined,
  connectString: undefined,
  connectionString: undefined,
  walletPassword: undefined,
  walletLocation: undefined,
  edition: undefined,
  events: undefined,
  externalAuth: undefined,
  matchAny: undefined,
  newPassword: undefined,
  password: undefined,
  sslAllowWeakDNMatch: undefined,
  httpsProxy: undefined,
  httpsProxyPort: undefined,
  debugJdwp: undefined,
  retryCount: undefined,
  retryDelay: undefined,
  connectTimeout: undefined,
  transportConnectTimeout: undefined,
  expireTime: undefined,
  sdu: undefined,
  connectionIdPrefix: undefined,
  configDir: undefined,
  sourceRoute: undefined,
  sslServerCertDN: undefined,
  sslServerDNMatch: undefined,
  poolAlias: undefined,
  privilege: undefined,
  shardingKey: undefined,
  stmtCacheSize: undefined,
  superShardingKey: undefined,
  tag: undefined,
  user: undefined,
  username: undefined,
});

const numericOptions: SupportableNumericOptions = {
  zerofill: false,
  unsigned: true,
};

export class OracleDialect extends AbstractDialect<OracleDialectOptions, OracleConnectionOptions> {
  static readonly supports = AbstractDialect.extendSupport({
    'VALUES ()': true,
    'LIMIT ON UPDATE': true,
    lock: false,
    forShare: 'LOCK IN SHARE MODE',
    index: {
      collate: false,
      length: false,
      parser: false,
      type: false,
      using: false,
    },
    constraints: {
      restrict: false,
      onUpdate: false,
    },
    returnValues: false,
    returnIntoValues: true,
    'ORDER NULLS': true,
    schemas: true,
    inserts: {
      updateOnDuplicate: false,
    },
    indexViaAlter: false,
    dataTypes: {
      COLLATE_BINARY: true,
      GEOMETRY: false,
      JSON: true,
      INTS: numericOptions,
      DOUBLE: numericOptions,
      DECIMAL: { unconstrained: true },
      TIME: {
        precision: false,
      },
    },
    jsonOperations: true,
    jsonExtraction: {
      quoted: true,
    },
    dropTable: {
      cascade: true,
    },
    renameTable: {
      changeSchema: false,
    },
    delete: {
      limit: true,
    },
    startTransaction: {
      useBegin: true,
    },
    upserts: true,
    bulkDefault: true,
    topLevelOrderByRequired: true,
  });

  readonly connectionManager: OracleConnectionManager;
  readonly queryGenerator: OracleQueryGenerator;
  readonly queryInterface: OracleQueryInterface;
  readonly Query = OracleQuery;
  readonly dataTypesDocumentationUrl =
    'https://docs.oracle.com/en/database/oracle/oracle-database/23/sqlrf/Data-Types.html';

  constructor(sequelize: Sequelize, options: OracleDialectOptions) {
    super({
      dataTypesDocumentationUrl:
        'https://docs.oracle.com/en/database/oracle/oracle-database/23/sqlrf/Data-Types.html',
      minimumDatabaseVersion: '18.0.0',
      identifierDelimiter: '"',
      name: 'oracle',
      options,
      sequelize,
      dataTypeOverrides: DataTypes,
    });

    this.connectionManager = new OracleConnectionManager(this);
    // this.connectionManager.initPools();
    this.queryGenerator = new OracleQueryGenerator(this);
    this.queryInterface = new OracleQueryInterface(this);
  }

  parseConnectionUrl(): OracleConnectionOptions {
    throw new Error(
      'The "url" option is not supported by the Db2 dialect. Instead, please use the "odbcOptions" option.',
    );
  }

  getDefaultSchema(): string {
    return this.sequelize.options.replication.write.username?.toUpperCase() ?? '';
  }

  createBindCollector() {
    return createNamedParamBindCollector(':');
  }

  static getDefaultPort(): number {
    return 1521;
  }

  escapeString(val: string): string {
    if (val.startsWith('TO_TIMESTAMP') || val.startsWith('TO_DATE')) {
      return val;
    }

    val = val.replaceAll("'", "''");

    return `'${val}'`;
  }

  escapeBuffer(buffer: Buffer): string {
    const hex = buffer.toString('hex');

    return `'${hex}'`;
  }

  static getSupportedOptions() {
    return [];
  }

  static getSupportedConnectionOptions() {
    return CONNECTION_OPTION_NAMES;
  }
}
