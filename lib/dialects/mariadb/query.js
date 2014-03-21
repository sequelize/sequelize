var Utils         = require("../../utils")
  , AbstractQuery = require('../abstract/query')

module.exports = (function() {
  var Query = function(client, sequelize, callee, options) {
    this.client    = client
    this.callee    = callee
    this.sequelize = sequelize
    this.options   = Utils._.extend({
      logging: console.log,
      plain: false,
      raw: false
    }, options || {})

    this.checkLoggingOption()
  }

  Utils.inherit(Query, AbstractQuery)
  Query.prototype.run = function(sql) {
    this.sql = sql

    if (this.options.logging !== false) {
      this.options.logging('Executing (' + this.options.uuid + '): ' + this.sql)
    }

    var resultSet = [],
        errorDetected = false,
        alreadyEnded = false, // This is needed because CALL queries emit 'end' twice...
        self = this

    this.client.query(this.sql)
      .on('result', function(results) {
        results
          .on('row', function(row, metadata) {
            var type

            for (var prop in row) {
              if (row.hasOwnProperty(prop)) {
                if (row[prop] === null) {
                  continue
                }

                type = metadata.types[prop]

                switch (type) {
                case "TINYINT":
                case "SMALLINT":
                case "INTEGER":
                case "MEDIUMINT":
                case "BIGINT":
                case "YEAR":
                  row[prop] = parseInt(row[prop], 10)
                  break
                case "DECIMAL":
                case "FLOAT":
                case "DOUBLE":
                  row[prop] = parseFloat(row[prop])
                  break
                case "DATE":
                case "TIMESTAMP":
                case "DATETIME":
                  row[prop] = new Date(row[prop] + 'Z')
                  break
                case "BIT":
                case "BLOB":
                case "TINYBLOB":
                case "MEDIUMBLOB":
                case "LONGBLOB":
                  if (metadata.charsetNrs[prop] === 63) { // binary
                    row[prop] = new Buffer(row[prop])
                  }
                  break
                case "TIME":
                case "CHAR":
                case "VARCHAR":
                case "SET":
                case "ENUM":
                case "GEOMETRY":
                case "NULL":
                  break
                default:
                  // blank
                }
              }
            }
            resultSet.push(row)
          })
          .on('error', function(err) {
            errorDetected = true
            self.emit('sql', self.sql)
            err.sql = sql
            self.emit('error', err, self.callee)
          })
          .on('end', function(info) {
            if (alreadyEnded || errorDetected) {
              return
            }
            alreadyEnded = true

            self.emit('sql', self.sql)
            // we need to figure out whether to send the result set
            // or info depending upon the type of query
            if (/^call/.test(self.sql.toLowerCase())) {
              self.emit('success', resultSet)
            } else if( /^show/.test(self.sql.toLowerCase()) ||
                /^select/.test(self.sql.toLowerCase()) ||
              /^describe/.test(self.sql.toLowerCase())) {
              self.emit('success', self.formatResults(resultSet))
            } else {
              self.emit('success', self.formatResults(info))
            }

          })
      })
      .on('error', function(err) {
        if (errorDetected) {
          return
        }
        errorDetected = true
        self.emit('sql', self.sql)
        self.emit('error', err, self.callee)
      })
      .setMaxListeners(100)

    return this
  }

  return Query
})()


