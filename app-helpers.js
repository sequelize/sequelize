/*global module:false, require:false*/

var request = require('request')

module.exports = {
  Changelog: {
    load: function(callback) {
      this.getRawData(function(err, res, body) {
        callback(this.parseRawData(body))
      }.bind(this))
    },

    getRawData: function(callback) {
      request('https://raw.github.com/sequelize/sequelize/master/changelog.md', callback)
    },

    parseRawData: function(body) {
      var changelog = []

      ;(function() {
        var version   = null
          , match     = null
          , changes   = []

        body.split('\n').forEach(function(line) {
          if (match = line.match(/^#\sv(\d+\.\d+\.\d+)\s#$/)) {
            if (version !== null) {
              changelog.push({ version: version, changes: changes })
              changes = []
            }

            version = match[1]
          } else {
            if (line.trim() !== '') {
              var parsed = line.match(/-\s(\[.+\])?\s?(.+)/)

              changes.push({
                type:        (parsed[1] || "").replace('[', '').replace(']', '').toLowerCase(),
                description: parsed[2]
              })
            }
          }
        })
      })()

      return changelog
    }
  }
}
