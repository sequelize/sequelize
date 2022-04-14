'use strict';

const PostgresDialect = require('../postgres/index');
const YugabyteDBConnectionManager = require('./connection-manager');
const Query = require('./query');
const Model = require('../../model');
const DataTypes = require('../../data-types').yugabytedb;
const YugabyteDBQueryGenerator = require('./query-generator');
const { YugabyteDBQueryInterface } = require('./query-interface');
const _ = require('lodash');
const Utils = require('../../utils');
const { logger } = require('../../utils/logger');
const sequelizeErrors = require('../../errors');

export class YugabyteDBDialect extends PostgresDialect {
  static supports = _.merge(_.cloneDeep(PostgresDialect.supports), {
    GEOGRAPHY: false,
  });

  constructor(sequelize) {
    super(sequelize);
    this.sequelize = sequelize;
    this.DataTypes = DataTypes;
    this.connectionManager = new YugabyteDBConnectionManager(this, sequelize);
    this.queryGenerator = new YugabyteDBQueryGenerator({
      _dialect: this,
      sequelize,
    });
    this.queryInterface = new YugabyteDBQueryInterface(
      sequelize,
      this.queryGenerator,
    );
  }
}

YugabyteDBDialect.prototype.Query = Query;
YugabyteDBDialect.prototype.DataTypes = DataTypes;
YugabyteDBDialect.prototype.name = 'yugabytedb';

YugabyteDBDialect.prototype.TICK_CHAR = '"';
YugabyteDBDialect.prototype.TICK_CHAR_LEFT = YugabyteDBDialect.prototype.TICK_CHAR;
YugabyteDBDialect.prototype.TICK_CHAR_RIGHT = YugabyteDBDialect.prototype.TICK_CHAR;

