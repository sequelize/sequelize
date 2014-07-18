'use strict';

var _ = require('lodash')
  , MySQL = require('../mysql')
  , ConnectionManager = require('./connection-manager')
  , Query = require('./query');

var MariaDialect = function(sequelize) {
  this.sequelize = sequelize;
  this.connectionManager = new ConnectionManager(this, sequelize);
  this.connectionManager.initPools();
};

MariaDialect.prototype = MySQL.prototype;

MariaDialect.prototype.Query = Query;

module.exports = MariaDialect;
