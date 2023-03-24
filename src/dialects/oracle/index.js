// Copyright (c) 2022, Oracle and/or its affiliates. All rights reserved

'use strict';

const _ = require('lodash');
const { AbstractDialect } = require('../abstract');
const { OracleConnectionManager } = require('./connection-manager');
const { OracleQuery } = require('./query');
const { OracleQueryGenerator } = require('./query-generator');
const DataTypes = require('../../data-types').oracle;
const { OracleQueryInterface } = require('./query-interface');

class OracleDialect extends AbstractDialect {
  constructor(sequelize) {
    super();
    this.sequelize = sequelize;
    this.connectionManager = new OracleConnectionManager(this, sequelize);
    this.connectionManager.initPools();
    this.queryGenerator = new OracleQueryGenerator({
      _dialect: this,
      sequelize
    });
    this.queryInterface = new OracleQueryInterface(sequelize, this.queryGenerator);
  }
}

OracleDialect.prototype.supports = _.merge(_.cloneDeep(AbstractDialect.prototype.supports), {
  'VALUES ()': true,
  'LIMIT ON UPDATE': true,
  IGNORE: ' IGNORE',
  lock: false,
  forShare: ' IN SHARE MODE',
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
  returnIntoValues: true,
  'ORDER NULLS': true,
  schemas: true,
  updateOnDuplicate: false,
  indexViaAlter: false,
  NUMERIC: true,
  JSON: true,
  upserts: true,
  bulkDefault: true,
  topLevelOrderByRequired: true,
  GEOMETRY: false
});

OracleDialect.prototype.defaultVersion = '18.0.0';
OracleDialect.prototype.Query = OracleQuery;
OracleDialect.prototype.queryGenerator = OracleQueryGenerator;
OracleDialect.prototype.DataTypes = DataTypes;
OracleDialect.prototype.name = 'oracle';
OracleDialect.prototype.TICK_CHAR = '"';
OracleDialect.prototype.TICK_CHAR_LEFT = OracleDialect.prototype.TICK_CHAR;
OracleDialect.prototype.TICK_CHAR_RIGHT = OracleDialect.prototype.TICK_CHAR;

module.exports = OracleDialect;
