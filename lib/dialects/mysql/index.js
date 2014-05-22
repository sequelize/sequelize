"use strict";

var _ = require('lodash')
  , Abstract = require('../abstract')

var MysqlDialect = function(sequelize) {
  this.sequelize = sequelize
}

MysqlDialect.prototype.supports = _.defaults({
  'VALUES ()': true,
  'LIMIT ON UPDATE':true,
  lock: true,
  forShare: 'LOCK IN SHARE MODE'
}, Abstract.prototype.supports)

module.exports = MysqlDialect
