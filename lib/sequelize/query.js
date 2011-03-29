var Utils = require("./utils")
var Query = module.exports = function(databaseConfig, callee, options) {
  this.config = databaseConfig
  this.callee = callee
  this.options = options
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
    if(err) {
      self.emit('failure', err, self.callee)
    } else {
      var result = self.callee
      
      if (self.callee && (query.indexOf('INSERT INTO') == 0) && (results.hasOwnProperty('insertId')))
        self.callee.id = results.insertId
      if (query.indexOf('SELECT') == 0) {
        // will transform result into models
        result = results.map(function(result) { return self.callee.build(result) })
      }
        
      self.emit('success', result)
    }
  })
  client.end()
  
  return this
}