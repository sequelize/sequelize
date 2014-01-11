var _ = require('lodash')
  , Abstract = require('../abstract')

var PostgresDialect = function(sequelize) {
  this.sequelize = sequelize
}

PostgresDialect.prototype.supports = _.defaults({
	'RETURNING': true,
	'DEFAULT VALUES': true
}, Abstract.prototype.supports)

module.exports = PostgresDialect
