'use strict';

var MySQLDialect = require('../mysql');

var MariaDialect = function(sequelize) {
  MySQLDialect.call(this, sequelize);
};

MariaDialect.prototype = MySQLDialect.prototype;
MariaDialect.prototype.name = 'mariadb';

module.exports = MariaDialect;
