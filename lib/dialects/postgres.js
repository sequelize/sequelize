var _ = require('lodash')
  , Abstract = require('./abstract/dialect')

var PostgresDialect = function(sequelize) {
  this.sequelize = sequelize
}

PostgresDialect.prototype.supports = _.extend(Abstract.prototype.supports, {
	'RETURNING': true
})

module.exports = PostgresDialect