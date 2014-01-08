var _ = require('lodash')
  , Abstract = require('../abstract')

var PostgresDialect = function(sequelize) {
  this.sequelize = sequelize
}

PostgresDialect.prototype.supports = _.extend(Abstract.prototype.supports, {
	'RETURNING': true,
	'DEFAULT VALUES': true
})

module.exports = PostgresDialect
