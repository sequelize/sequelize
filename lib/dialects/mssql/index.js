'use strict';

var _ = require('lodash')
  , Abstract = require('../abstract')
  , ConnectionManager = require('./connection-manager')
  , Query = require('./query');

//MSSQL uses a single connection that pools on its own
var MssqlDialect = function(sequelize) {
  this.sequelize = sequelize;
  this.connectionManager = new ConnectionManager(this, sequelize);
};

MssqlDialect.prototype.supports = _.merge(_.cloneDeep(Abstract.prototype.supports), {
  'RETURNING': true,  
  'LIMIT ON UPDATE': true,
  lock: true,
  forShare: 'LOCK IN SHARE MODE',
  index: {
    collate: false,
    length: false,
    parser: false,
    type: true,
    using: 1,
  }
});

MssqlDialect.prototype.Query = Query;

module.exports = MssqlDialect;
