"use strict";
var ConnectionManager
  , Promise = require('../../promise');

ConnectionManager = function(dialect, sequelize) {
  try {
    this.lib = require(sequelize.config.dialectModulePath || 'mariasql');
  } catch (err) {
    throw new Error('Please install mariasql package manually');
  }
};

ConnectionManager.prototype.connect = function(config) {
  return new Promise(function (resolve, reject) {

  });
};
ConnectionManager.prototype.disconnect = function(connection) {
  return new Promise(function (resolve, reject) {

  });
};

module.exports = ConnectionManager;