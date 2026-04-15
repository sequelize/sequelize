// Copyright (c) 2025, Oracle and/or its affiliates. All rights reserved

import type { Sequelize } from '@sequelize/core';
import { AbstractDialect } from '@sequelize/core';
import type { SupportableNumericOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/dialect.js';
import { createSpecifiedOrderedBindCollector } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/sql.js';
import { EMPTY_ARRAY } from '@sequelize/utils';
import { CONNECTION_OPTION_NAMES } from './_internal/connection-options.js';
import * as DataTypes from './_internal/data-types-overrides';
import { OracleConnectionManager } from './connection-manager';
import type { OracleConnectionOptions } from './connection-manager.js';
import { OracleQueryGenerator } from './query-generator.js';
import { OracleQueryInterface } from './query-interface.js';
import { OracleQuery } from './query.js';

export interface OracleDialectOptions {}

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
      ignoreDuplicates: false,
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
      concurrentDropConstraints: false, // parallel DDL on same table gives ORA-00054: resource busy and acquire with NOWAIT specified
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
    select: { dummyTable: 'DUAL' },
  });

  readonly connectionManager: OracleConnectionManager;
  readonly queryGenerator: OracleQueryGenerator;
  readonly queryInterface: OracleQueryInterface;
  readonly Query = OracleQuery;

  constructor(sequelize: Sequelize, options: OracleDialectOptions) {
    super({
      dataTypesDocumentationUrl:
        'https://docs.oracle.com/en/database/oracle/oracle-database/18/sqlrf/Data-Types.html',
      minimumDatabaseVersion: '18.0.0',
      identifierDelimiter: '"',
      name: 'oracle',
      options,
      sequelize,
      dataTypeOverrides: DataTypes,
    });

    this.connectionManager = new OracleConnectionManager(this);
    this.queryGenerator = new OracleQueryGenerator(this);
    this.queryInterface = new OracleQueryInterface(this);
  }

  parseConnectionUrl(): OracleConnectionOptions {
    throw new Error(
      'The "url" option is not supported by the Oracle dialect. Instead, please use the "connectionString" option.',
    );
  }

  getDefaultSchema(): string {
    return this.sequelize.options.replication.write.username?.toUpperCase() ?? '';
  }

  createBindCollector() {
    return createSpecifiedOrderedBindCollector(':');
  }

  escapeString(val: string): string {
    if (val.startsWith('TO_TIMESTAMP_TZ') || val.startsWith('TO_DATE')) {
      this.assertDateLiteral(val);

      return val;
    }

    val = val.replaceAll("'", "''");

    return `'${val}'`;
  }

  escapeBuffer(buffer: Buffer): string {
    const hex = buffer.toString('hex');

    return `'${hex}'`;
  }

  assertDateLiteral(val: string): void {
    if (/^TO_DATE\('[^']*'\s*,\s*'YYYY\/MM\/DD'\)$/.test(val)) {
      return;
    }

    if (/^TO_TIMESTAMP_TZ\('[^']*'\s*,\s*'YYYY-MM-DD HH24:MI:SS\.FFTZH:TZM'\)$/.test(val)) {
      return;
    }

    throw new Error('Invalid SQL function call.');
  }

  static getSupportedOptions() {
    return EMPTY_ARRAY;
  }

  static getSupportedConnectionOptions() {
    return CONNECTION_OPTION_NAMES;
  }
}
