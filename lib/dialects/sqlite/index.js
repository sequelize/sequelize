'use strict';

var _ = require('lodash')
  , Abstract = require('../abstract')
  , ConnectionManager = require('./connection-manager')
  , Query = require('./query');

var SqliteDialect = function(sequelize) {
  this.sequelize = sequelize;
  this.connectionManager = new ConnectionManager(this, sequelize);
};

SqliteDialect.prototype.supports = _.merge(Abstract.prototype.supports, {
  'DEFAULT': false,
  'DEFAULT VALUES': true,
  index: {
    using: false
  }
});

SqliteDialect.prototype.Query = Query;
SqliteDialect.prototype.name = 'sqlite';

module.exports = SqliteDialect;
