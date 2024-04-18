// Copyright (c) 2024, Oracle and/or its affiliates. All rights reserved

import type { Sequelize } from '@sequelize/core';
import { AbstractDialect } from '@sequelize/core';
import { createNamedParamBindCollector } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/sql.js';
import type { SupportableNumericOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/index.js';
import { OracleConnectionManager } from './connection-manager';
import * as DataTypes from './_internal/data-types-overrides';
import { OracleQuery } from './query.js';
import { OracleQueryGenerator } from './query-generator.js';
import { OracleQueryInterface } from './query-interface.js';

const numericOptions: SupportableNumericOptions = {
  zerofill: false,
  unsigned: true,
};

export class OracleDialect extends AbstractDialect {
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
  readonly dataTypesDocumentationUrl = 'https://docs.oracle.com/en/database/oracle/oracle-database/21/sqlrf/Data-Types.html#GUID-A3C0D836-BADB-44E5-A5D4-265BA5968483';

  // minimum supported version
  readonly defaultVersion = '18.0.0';
  readonly TICK_CHAR = '"';
  readonly TICK_CHAR_LEFT = '"';
  readonly TICK_CHAR_RIGHT = '"';

  constructor(sequelize: Sequelize) {
    super(sequelize, DataTypes, 'oracle');
    this.connectionManager = new OracleConnectionManager(this);
    // this.connectionManager.initPools();
    this.queryGenerator = new OracleQueryGenerator(this);
    this.queryInterface = new OracleQueryInterface(this);
  }

  getDefaultSchema(): string {
    return this.sequelize.config.username.toUpperCase();
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

    val = val.replaceAll('\'', '\'\'');

    return `'${val}'`;
  }

  escapeBuffer(buffer: Buffer): string {
    const hex = buffer.toString('hex');

    return `'${hex}'`;
  }

  static getSupportedOptions() {
    return [];
  }
}
