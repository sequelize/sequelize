var fs = require('fs')

module.exports = {
  getSupportedDialects: function() {
    return fs.readdirSync(__dirname + '/../lib/dialects').filter(function(file) {
      return ((file.indexOf('.js') === -1) && (file.indexOf('abstract') === -1))
    })
  },

  getTestDialect: function() {
    var envDialect = process.env.DIALECT || 'mysql'

    if (envDialect === 'postgres-native') {
      envDialect = 'postgres'
    }

    if (this.getSupportedDialects().indexOf(envDialect) === -1) {
      throw new Error('The dialect you have passed is unknown. Did you really mean: ' + envDialect)
    }

    return envDialect
  },

  getTestDialectTeaser: function(moduleName) {
    var dialect = this.getTestDialect()

    if (process.env.DIALECT === 'postgres-native') {
      dialect = 'postgres-native'
    }

    return "[" + dialect.toUpperCase() + "] " + moduleName
  }
}
