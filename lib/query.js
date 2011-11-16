var Utils = require("./utils")

module.exports = (function() {
  var Query = function(client, callee, options) {
    var self = this

    this.client = client
    this.callee = callee
    this.options = options || {}
    this.bindClientFunction = function(err) { onFailure.call(self, err) }
  }
  Utils.addEventEmitter(Query)

  Query.prototype.run = function(query) {
    var self = this
    this.sql = query

    bindClient.call(this)

    if(this.options.logging)
      console.log('Executing: ' + this.sql)

    this.client.query(this.sql, function(err, results, fields) {
      err ? onFailure.call(self, err) : onSuccess.call(self, self.sql, results, fields)
    }).setMaxListeners(100)

    return this
  }

  Query.prototype.success = Query.prototype.ok = function(fct) {
    this.on('success', fct)
    return this
  }

  Query.prototype.failure = Query.prototype.fail = Query.prototype.error = function(fct) {
    this.on('failure', fct)
    return this
  }

  //private

  var bindClient = function() {
    this.client.on('error', this.bindClientFunction)
  }

  var unbindClient = function() {
    this.client.removeListener('error', this.bindClientFunction)
  }

  var onSuccess = function(query, results, fields) {
    var result = this.callee
      , self   = this

    // add the inserted row id to the instance
    if (this.callee && (query.indexOf('INSERT INTO') == 0) && (results.hasOwnProperty('insertId')))
      this.callee[this.callee.__definition.autoIncrementField] = results.insertId

    // transform results into real model instances
    // return the first real model instance if options.plain is set (e.g. Model.find)
    if (query.indexOf('SELECT') == 0) {
      result = results.map(function(result) { return self.callee.build(result, {isNewRecord: false}) })

      if(this.options.plain)
        result = (result.length == 0) ? null : result[0]
    }

    unbindClient.call(this)
    this.emit('success', result)
  }

  var onFailure = function(err) {
    unbindClient.call(this)
    this.emit('failure', err, this.callee)
  }

  return Query
})()
