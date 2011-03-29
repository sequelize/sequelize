var Utils = require("./utils")
var Query = module.exports = function(databaseConfig) {
  this.config = databaseConfig
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
  client.query(query, function() { self.emit('success') })
  client.on("error", function(err) { self.emit('failure', err) })
  client.end()
  
  return this
}