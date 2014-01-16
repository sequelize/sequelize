var _ = require('lodash')
  , Abstract = require('../abstract')

var SqliteDialect = function(sequelize) {
  this.sequelize = sequelize
}

SqliteDialect.prototype.supports = _.defaults({
	'DEFAULT': false,
	'DEFAULT VALUES': true
}, Abstract.prototype.supports)

module.exports = SqliteDialect
