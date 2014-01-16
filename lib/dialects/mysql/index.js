var _ = require('lodash')
  , Abstract = require('../abstract')

var MysqlDialect = function(sequelize) {
  this.sequelize = sequelize
}

MysqlDialect.prototype.supports = _.defaults({
	'VALUES ()': true
}, Abstract.prototype.supports)

module.exports = MysqlDialect
