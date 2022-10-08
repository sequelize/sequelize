'use strict';

import { createUnspecifiedOrderedBindCollector } from '../../utils/sql';

const _ = require('lodash');
const { AbstractDialect } = require('../abstract');
const { Db2ConnectionManager } = require('./connection-manager');
const { Db2Query } = require('./query');
const { Db2QueryGenerator } = require('./query-generator');
const DataTypes = require('../../data-types').db2;
const { Db2QueryInterface } = require('./query-interface');

export class Db2Dialect extends AbstractDialect {
  static supports = _.merge(_.cloneDeep(AbstractDialect.supports), {
    migrations: false,
    schemas: true,
    finalTable: true,
    autoIncrement: {
      defaultValue: false,
    },
    alterColumn: {
      unique: false,
    },
    index: {
      collate: false,
      using: false,
      where: true,
    },
    NUMERIC: true,
    tmpTableTrigger: true,
  });

  constructor(sequelize) {
    super();
    this.sequelize = sequelize;
    this.connectionManager = new Db2ConnectionManager(this, sequelize);
    this.queryGenerator = new Db2QueryGenerator({
      dialect: this,
      sequelize,
    });
    this.queryInterface = new Db2QueryInterface(sequelize, this.queryGenerator);
  }

  createBindCollector() {
    return createUnspecifiedOrderedBindCollector();
  }

  static getDefaultPort() {
    return 3306;
  }
}

Db2Dialect.prototype.defaultVersion = '1.0.0'; // Db2 supported version comes here
Db2Dialect.prototype.Query = Db2Query;
Db2Dialect.prototype.name = 'db2';
Db2Dialect.prototype.TICK_CHAR = '"';
Db2Dialect.prototype.TICK_CHAR_LEFT = '"';
Db2Dialect.prototype.TICK_CHAR_RIGHT = '"';
Db2Dialect.prototype.DataTypes = DataTypes;
