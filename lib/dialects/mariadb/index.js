'use strict';

var MySQLDialect = require('../mysql')
  , util = require('util');

var MariaDialect = function(sequelize) {
  MySQLDialect.call(this, sequelize);
};

util.inherits(MariaDialect, MySQLDialect);
MariaDialect.prototype.name = 'mariadb';

module.exports = MariaDialect;
