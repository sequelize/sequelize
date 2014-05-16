var _ = require('lodash')
  , Abstract = require('../abstract')

var MysqlDialect = function(sequelize) {
  this.sequelize = sequelize
}

MysqlDialect.prototype.supports = _.defaults({
  'VALUES ()': true,
  'LIMIT ON UPDATE':true,
  rowLocking: true,
  forUpdate: 'FOR UPDATE',
  forShare: 'LOCK IN SHARE MODE'
}, Abstract.prototype.supports)

module.exports = MysqlDialect
