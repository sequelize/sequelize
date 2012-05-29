var Utils = require("../../utils")

module.exports = (function() {
  var Query = function(client, callee, options) {
    var self = this

    this.client = client
    this.callee = callee
    this.options = Utils._.extend({
      logging: true,
      plain: false,
      raw: false
    }, options || {})
  }
  Utils._.extend(Query.prototype, require("../query").prototype)

  Query.prototype.run = function(sql) {
    var self = this

    this.sql = sql

    var results = [];
    var receivedError = false;

    var query = this.client.query(sql)
    query.on('row', function(row) {
      if (self.callee && (self.sql.indexOf('INSERT INTO') == 0 || self.sql.indexOf('UPDATE') == 0)) {
        Utils._.forEach(row, function(value, key) {
          self.callee[key] = value
        })
        results.push(self.callee)
      }

      if (self.sql.indexOf('SELECT table_name FROM information_schema.tables') == 0) {
        results.push(Utils._.values(row))
      } else if (self.sql.indexOf('SELECT relname FROM pg_class WHERE oid IN') == 0) {
        results.push(Utils._.values(row))
      } else if (self.sql.indexOf('SELECT') == 0) {
        // transform results into real model instances
        // return the first real model instance if options.plain is set (e.g. Model.find)
        if (self.options.raw) {
          results.push(row);
        } else {
          results.push(self.callee.build(row, { isNewRecord: false }))
        }
      } else if((self.sql.indexOf('SHOW') == 0) || (self.sql.indexOf('DESCRIBE') == 0)) {
        results.push(row)
      }
    });

    query.on('end', function() {
      self.emit('sql', self.sql)
      if (receivedError) return;

      if (self.sql.indexOf('SELECT') == 0) {
        if (self.options.plain) {
          self.emit('success', (results.length == 0) ? null : results[0])
        } else {
          self.emit('success', results)
        }
      } else if((self.sql.indexOf('SHOW') == 0) || (self.sql.indexOf('DESCRIBE') == 0)) {
        self.emit('success', results)
      } else if (self.sql.indexOf('INSERT INTO') == 0) {
        self.emit('success', results[0])
      } else if (self.sql.indexOf('UPDATE') == 0) {
        self.emit('success', self.callee)
      } else {
        self.emit('success', results)
      }
    });

    query.on('error', function(err) {
      receivedError = true
      self.emit('failure', err, self.callee)
    });

    return this
  }

  return Query
})()
