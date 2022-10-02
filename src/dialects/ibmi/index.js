'use strict';

import { createUnspecifiedOrderedBindCollector } from '../../utils/sql';

const _ = require('lodash');
const { AbstractDialect } = require('../abstract');
const { IBMiConnectionManager } = require('./connection-manager');
const { IBMiQuery } = require('./query');
const { IBMiQueryGenerator } = require('./query-generator');
const { IBMiQueryInterface } = require('./query-interface');
const DataTypes = require('../../data-types').ibmi;

export class IBMiDialect extends AbstractDialect {

  static supports = _.merge(
    _.cloneDeep(AbstractDialect.supports),
    {
      'VALUES ()': true,
      'ON DUPLICATE KEY': false,
      transactions: false,

      bulkDefault: true,
      index: {
        using: false,
        where: true,
        functionBased: true,
        collate: false,
      },
      constraints: {
        onUpdate: false,
      },
      groupedLimit: false,
      JSON: false,
      upserts: false,
      schemas: true,
    },
  );

  constructor(sequelize) {
    super();
    this.sequelize = sequelize;
    this.connectionManager = new IBMiConnectionManager(this, sequelize);
    this.queryGenerator = new IBMiQueryGenerator({
      dialect: this,
      sequelize,
    });
    this.queryInterface = new IBMiQueryInterface(this.sequelize, this.queryGenerator);
  }

  createBindCollector() {
    return createUnspecifiedOrderedBindCollector();
  }

  static getDefaultPort() {
    return 25_000;
  }
}

IBMiDialect.prototype.defaultVersion = '7.3.0';
IBMiDialect.prototype.Query = IBMiQuery;
IBMiDialect.prototype.DataTypes = DataTypes;
IBMiDialect.prototype.name = 'ibmi';
IBMiDialect.prototype.TICK_CHAR = '"';
IBMiDialect.prototype.TICK_CHAR_LEFT = IBMiDialect.prototype.TICK_CHAR;
IBMiDialect.prototype.TICK_CHAR_RIGHT = IBMiDialect.prototype.TICK_CHAR;
