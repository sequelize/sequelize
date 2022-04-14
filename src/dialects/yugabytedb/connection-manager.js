'use strict';

const _ = require('lodash');
const dataTypes = require('../../data-types');
const PostgresConnectionManager = require('../postgres/connection-manager');

export class YugabyteDBConnectionManager extends PostgresConnectionManager {
  constructor(dialect, sequelize) {
    sequelize.config.port = sequelize.config.port || 5433;
    super(dialect, sequelize);
    this._clearDynamicOIDs();
    this._clearTypeParser();
    this.refreshTypeParser(dataTypes.yugabytedb);
  }

}
