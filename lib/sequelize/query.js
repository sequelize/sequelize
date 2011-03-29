var Query = module.exports = function(databaseConfig) {
  this.config = databaseConfig
}
require("sys").inherits(Query, require('events').EventEmitter)

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
  client.query(query, function() { self.emit('end') })
  client.end()
  
  return this
}