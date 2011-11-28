var moment = require("moment")
  , Utils  = require("./utils")

module.exports = (function() {
  var Migration = function(path) {
    var split = path.split('/')

    this.path = path
    this.filename = Utils._.last(this.path.split('/'))
    this.date = Migration.stringToDate(split[split.length - 1])
  }

  ///////////////
  // static /////
  ///////////////

  Migration.getFormattedDateString = function(s) {
    var result = null

    try {
      result = s.match(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/).slice(1, 6).join('-')
    } catch(e) {
      throw new Error(s + ' is no valid migration timestamp format! Use YYYYMMDDHHmmss!')
    }

    return result
  }

  Migration.stringToDate = function(s) {
    return moment(Migration.getFormattedDateString(s), "YYYYMMDDHHmmss")
  }

  ///////////////
  // member /////
  ///////////////

  Migration.prototype.execute = function() {

  }

  Migration.prototype.isBefore = function(dateString, options) {
    options = Utils._.extend({
      withoutEquals: false
    }, options || {})

    var date = Migration.stringToDate(dateString.toString())

    return options.withoutEqual ? (date > this.date) : (date >= this.date)
  }

  Migration.prototype.isAfter = function(dateString, options) {
    options = Utils._.extend({
      withoutEquals: false
    }, options || {})

    var date = Migration.stringToDate(dateString.toString())

    return options.withoutEqual ? (date < this.date) : (date <= this.date)
  }

  return Migration
})()
