var _ = require('lodash')
  , Abstract = require('./abstract/dialect')

var SqliteDialect = function(sequelize) {
  this.sequelize = sequelize
}

SqliteDialect.prototype.supports = _.extend(Abstract.prototype.supports, {

})

module.exports = SqliteDialect