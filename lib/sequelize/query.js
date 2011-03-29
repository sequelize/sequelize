var Utils = require("./utils")
var Query = module.exports = function(databaseConfig, callee) {
  this.config = databaseConfig
  this.callee = callee
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
  client.query(query, function(err, info) {
    if(err) {
      self.emit('failure', err, self.callee)
    } else {
      if (self.callee && (query.indexOf('INSERT INTO') == 0) && (info.hasOwnProperty('insertId')))
        self.callee.id = info.insertId
      self.emit('success', self.callee)
    }
  })
  client.end()
  
  return this
}