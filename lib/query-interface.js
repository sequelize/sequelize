var Utils = require('./utils')

module.exports = (function() {
  var QueryInterface = function(sequelize) {
    this.sequelize = sequelize
    this.QueryGenerator = require('./connectors/' + this.sequelize.options.connector + '/query-generator')
  }

  QueryInterface.prototype.createTable = function(tableName, attributes, options) {
    return query.call(this, this.QueryGenerator.createTableQuery(tableName, attributes, options))
  }

  QueryInterface.prototype.dropTable = function(tableName) {
    return query.call(this, this.QueryGenerator.dropTableQuery(tableName))
  }

  QueryInterface.prototype.dropAllTables = function() {
    var self = this

    return new Utils.CustomEventEmitter(function(emitter) {
      var chainer = new Utils.QueryChainer()

      self.sequelize.query('SHOW TABLES;', null, { raw: true }).success(function(data) {
        var tableNames = Sequelize.Utils._.map(data, function(hash) {
          return Sequelize.Utils._.values(hash)
        })
        Sequelize.Utils._.flatten(tableNames).forEach(function(tableName) {
          chainer.add(self.sequelize.getQueryInterface().dropTable(tableName))
        })
        chainer
          .run()
          .success(function() { emitter.emit('success', null) })
          .error(function(err) { emitter.emit('failure', err) })
      }).error(function(err) {
        emitter.emit('failure', err)
      })
    }).run()
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

  QueryInterface.prototype.insert = function(model, tableName, values) {
    var self = this

    return new Utils.CustomEventEmitter(function(emitter) {
      query
        .call(self, self.QueryGenerator.insertQuery(tableName, values), model)
        .success(function(obj) {
          obj.isNewRecord = false
          emitter.emit('success', obj)
        })
        .error(function(err) { emitter.emit('failure', err) })
    }).run()
  }

  QueryInterface.prototype.update = function(model, tableName, values, identifier) {
    var sql = this.QueryGenerator.updateQuery(tableName, values, identifier)
    return query.call(this, sql, model)
  }

  QueryInterface.prototype.delete = function(model, tableName, identifier) {
    var sql = this.QueryGenerator.deleteQuery(tableName, identifier)
    return query.call(this, sql, model)
  }

  QueryInterface.prototype.select = function(factory, tableName, options, queryOptions) {
    queryOptions = queryOptions || {}
    return query.call(this, this.QueryGenerator.selectQuery(tableName, options), factory, queryOptions)
  }

  QueryInterface.prototype.rawSelect = function(tableName, options, attributeSelector) {
    var self = this

    if(attributeSelector == undefined)
      throw new Error('Please pass an attribute selector!')

    return new Utils.CustomEventEmitter(function(emitter) {
      var sql = self.QueryGenerator.selectQuery(tableName, options)

      query.call(self, sql, null, { plain: true, raw: true }).success(function(data) {
        emitter.emit('success', data[attributeSelector])
      }).error(function(err) {
        emitter.emit('failure', err)
      })
    }).run()
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
