var _ = require('lodash')
  , Abstract = require('./abstract/dialect')

var MysqlDialect = function(sequelize) {
  this.sequelize = sequelize
}

MysqlDialect.prototype.supports = _.extend(Abstract.prototype.supports, {
	'VALUES ()': true
})

module.exports = MysqlDialect