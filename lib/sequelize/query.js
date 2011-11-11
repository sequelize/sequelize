var Utils = require("./utils")
var Query = module.exports = function(client, callee, options) {
  var self = this

  this.client = client
  this.callee = callee
  this.options = options || {}
  this.bindClientFunction = function(err) { self.onFailure(err) }
}
Utils.addEventEmitter(Query)

Query.prototype.run = function(query) {
  var self = this
  this.sql = query

  this.bindClient()

  if(this.options.logging)
    console.log('Executing: ' + this.sql)  

  this.client.query(this.sql, function(err, results, fields) {
    //allow clients to listen to sql to do their own logging or whatnot
    self.emit('sql', self.sql)
    err ? self.onFailure(err) : self.onSuccess(self.sql, results, fields)
  }).setMaxListeners(100)



  return this
}

Query.prototype.bindClient = function() {
  this.client.on('error', this.bindClientFunction)
}

Query.prototype.unbindClient = function() {
  this.client.removeListener('error', this.bindClientFunction)
}

Query.prototype.onSuccess = function(query, results, fields) {
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

  this.unbindClient()

  this.emit('success', result)
}

Query.prototype.onFailure = function(err) {
  this.unbindClient()

  this.emit('failure', err, this.callee)
}
