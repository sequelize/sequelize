var _        = require('lodash')
  , Abstract = require('../abstract')

var MssqlDialect = function(sequelize) {
  this.sequelize = sequelize
}

MssqlDialect.prototype.supports = _.extend(Abstract.prototype.supports, {
})

module.exports = MssqlDialect
