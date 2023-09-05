import type { Sequelize } from '../../sequelize';
import { AbstractDialect, BindCollector, SupportableNumericOptions } from '../abstract';
import * as DataTypes from './data-types';
import { OracleConnectionManager } from './connection-manager'
import { OracleQueryGenerator } from './query-generator';
import { OracleQueryInterface } from './query-interface';
import { OracleQuery } from './query';
import { createNamedParamBindCollector } from 'src/utils/sql';

const numericOptions: SupportableNumericOptions = {
  zerofill: false,
  unsigned: true
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
      using: false
    },
    constraints: {
      restrict: false
    },
    returnValues: false,
    'ORDER NULLS': true,
    schemas: true,
    inserts: {
      //returnIntoValues: true,
      updateOnDuplicate: false,
    },
    indexViaAlter: false,
    dataTypes: {
      GEOMETRY: false,
      JSON: true,
      INTS: numericOptions,
      DOUBLE: numericOptions,
    },
    upserts: true,
    bulkDefault: true,
    //topLevelOrderByRequired: true,
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
    this.connectionManager = new OracleConnectionManager(this, sequelize);
    //this.connectionManager.initPools();
    this.queryGenerator = new OracleQueryGenerator({
      dialect: this,
      sequelize,
    });
    this.queryInterface = new OracleQueryInterface(
      sequelize,
      this.queryGenerator);
  }

  getDefaultSchema(): string {
    // TODO: what is the default schema in oracle?
    return '';
  }

  createBindCollector() {
    return createNamedParamBindCollector(':');
  }
}