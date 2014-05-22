"use strict";

var _ = require('lodash')
  , MySQL = require('../mysql')

var MariaDialect = function(sequelize) {
  this.sequelize = sequelize
}

MariaDialect.prototype = _.defaults({
    'LIMIT ON UPDATE':true
}, MySQL.prototype)

module.exports = MariaDialect
