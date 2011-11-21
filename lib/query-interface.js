var Utils = require('./utils')

module.exports = (function() {
  var QueryInterface = function(sequelize) {
    this.sequelize = sequelize
    this.QueryGenerator = this.sequelize.connectorManager.getQueryGenerator()
  }

  QueryInterface.prototype.createTable = function(tableName, attributes, options) {
    return query.call(this, this.QueryGenerator.createTableQuery(tableName, attributes, options))
  }

  QueryInterface.prototype.dropTable = function(tableName, id) {
    return query.call(this, this.QueryGenerator.dropTableQuery(tableName, id))
  }

  QueryInterface.prototype.renameTable = function() {

  }

  QueryInterface.prototype.addColumn = function() {

  }

  QueryInterface.prototype.removeColumn = function() {

  }

  QueryInterface.prototype.changeColumn = function() {

  }

  QueryInterface.prototype.renameColumn = function() {

  }

  QueryInterface.prototype.addIndex = function() {

  }

  QueryInterface.prototype.removeIndex = function() {

  }

  QueryInterface.prototype.insert = function() {

  }

  QueryInterface.prototype.update = function() {

  }

  QueryInterface.prototype.destroy = function() {

  }

  QueryInterface.prototype.select = function(factory, tableName, options) {
    return query.call(this, this.QueryGenerator.selectQuery(tableName, options), factory)
  }

  QueryInterface.prototype.count = function(factory, tableName, options) {
    var self        = this
      , countOption = "count(*) as count"

    options = options || {}
    options.attributes = options.attributes || []
    options.attributes.push('count(*) as count')

    return new Utils.CustomEventEmitter(function(emitter) {
      var sql = self.QueryGenerator.selectQuery(tableName, options).replace('`' + countOption + '`', countOption)

      query.call(self, sql, factory, { plain: true }).success(function(data) {
        emitter.emit('success', data.count)
      }).error(function(err) {
        emitter.emit('failure', err)
      })
    }).run()


    var self = this

    var emitter = new Utils.CustomEventEmitter(function() {
      query.call(self, self.QueryGenerator.countQuery(self.tableName, options), self, {plain: true}).success(function(obj) {
        emitter.emit('success', obj['count(*)'])
      })
    })
    return emitter.run()
  }

  // private

  var query = function() {
    var args = Utils._.map(arguments, function(arg, _) { return arg })

    // add this as callee via the second argument
    if(arguments.length == 1) args.push(this)

    return this.sequelize.query.apply(this.sequelize, args)
  }

  return QueryInterface
})()
