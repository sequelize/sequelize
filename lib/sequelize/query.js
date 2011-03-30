var Utils = require("./utils")
var Query = module.exports = function(databaseConfig, callee, options) {
  this.config = databaseConfig
  this.callee = callee
  this.options = options || {}
}
Utils.addEventEmitter(Query)

Query.prototype.run = function(query) {
  var self = this
  var client = new (require("mysql").Client)({
    user: this.config.username,
    password: this.config.password,
    host: this.config.host,
    port: this.config.port,
    database: this.config.database
  })

  console.log('Executing: ' + query)

  client.connect()
  client.query(query, function(err, results, fields) {
    err ? self.onFailure(err) : self.onSuccess(query, results, fields)
  })
  client.end()
  
  return this
}

Query.prototype.onSuccess = function(query, results, fields) {
  var result = this.callee
    , self   = this
  
  // add the inserted row id to the instance
  if (this.callee && (query.indexOf('INSERT INTO') == 0) && (results.hasOwnProperty('insertId')))
    this.callee.id = results.insertId
    
  // transform results into real model instances
  // return the first real model instance if options.plain is set (e.g. Model.find)
  if (query.indexOf('SELECT') == 0) {
    result = results.map(function(result) { return self.callee.build(result) })

    console.log(this.options)
    if(this.options.plain)
      result = (result.length == 0) ? null : result[0]
  }
    
  this.emit('success', result)
}

Query.prototype.onFailure = function(err) {
  this.emit('failure', err, this.callee)
}