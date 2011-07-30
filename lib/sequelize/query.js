var Utils = require("./utils")
var Query = module.exports = function(pool, callee, options) {
	this.pool = pool
  this.callee = callee
  this.options = options || {}
}
Utils.addEventEmitter(Query)

Query.prototype.run = function(query) {
  var self = this
  this.sql = query

  if(this.options.logging)
    console.log('Executing: ' + this.sql)

  this.pool.query(this.sql, function(err, results, fields) {
    err ? self.onFailure(err) : self.onSuccess(self.sql, results, fields)
  })
  
  return this
}

Query.prototype.onSuccess = function(query, results, fields) {
  var result = this.callee
    , self   = this
 
  // add the inserted row id to the instance
  if (this.callee && (query.indexOf('INSERT INTO') == 0) && (results.hasOwnProperty('insertId')))
    this.callee[this.callee.definition.autoIncrementField] = results.insertId

  // transform results into real model instances
  // return the first real model instance if options.plain is set (e.g. Model.find)
  if (this.callee && query.indexOf('SELECT') == 0) {
    result = results.map(function(result) { return self.callee.build(result, {isNewRecord: false}) })

    if(this.options.plain)
      result = (result.length == 0) ? null : result[0]
  }

  this.emit('success', result)
}

Query.prototype.onFailure = function(err) {
  this.emit('failure', err, this.callee)
}
