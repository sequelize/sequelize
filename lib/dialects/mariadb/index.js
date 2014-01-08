var _ = require('lodash')
  , MySQL = require('../mysql')

var MariaDialect = function(sequelize) {
  this.sequelize = sequelize
}

MariaDialect.prototype = _.extend({

}, MySQL.prototype)

module.exports = MariaDialect
