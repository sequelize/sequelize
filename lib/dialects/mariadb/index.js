'use strict';

var _ = require('lodash')
  , MySQL = require('../mysql')
  , ConnectionManager = require('./connection-manager')
  , Query = require('./query')
  , QueryGenerator = require('./query-generator');

var MariaDialect = function(sequelize) {
  this.sequelize = sequelize;
  this.connectionManager = new ConnectionManager(this, sequelize);
  this.connectionManager.initPools();
  this.QueryGenerator = _.extend({}, QueryGenerator, {
    options: sequelize.options,
    _dialect: this,
    sequelize: sequelize
  });};

MariaDialect.prototype = MySQL.prototype;
MariaDialect.prototype.Query = Query;
MariaDialect.prototype.name = 'mariadb';

module.exports = MariaDialect;
