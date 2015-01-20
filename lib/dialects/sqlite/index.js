'use strict';

var _ = require('lodash')
  , Abstract = require('../abstract')
  , ConnectionManager = require('./connection-manager')
  , Query = require('./query')
  , QueryGenerator = require('./query-generator');

var SqliteDialect = function(sequelize) {
  this.sequelize = sequelize;
  this.connectionManager = new ConnectionManager(this, sequelize);
  this.QueryGenerator = _.extend({}, QueryGenerator, {
    options: sequelize.options,
    _dialect: this,
    sequelize: sequelize
  });
};

SqliteDialect.prototype.supports = _.merge(_.cloneDeep(Abstract.prototype.supports), {
  'DEFAULT': false,
  'DEFAULT VALUES': true,
  'IGNORE': ' OR IGNORE',
  index: {
    using: false
  },
  joinTableDependent: false
});

SqliteDialect.prototype.Query = Query;
SqliteDialect.prototype.name = 'sqlite';

module.exports = SqliteDialect;
