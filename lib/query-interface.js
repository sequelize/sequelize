var Utils = require('./utils')

module.exports = (function() {
  var QueryInterface = function(sequelize) {
    this.sequelize = sequelize
    this.QueryGenerator = require('./connectors/' + this.sequelize.options.connector + '/query-generator')
  }
  Utils.addEventEmitter(QueryInterface)

  QueryInterface.prototype.createTable = function(tableName, attributes, options) {
    var _query = query.call(this, this.QueryGenerator.createTableQuery(tableName, attributes, options))
      , self   = this

    _query
      .success(function(){ self.emit('createTable', null) })
      .error(function(err){ self.emit('createTable', err)})

    return _query
  }

  QueryInterface.prototype.dropTable = function(tableName) {
    var _query = query.call(this, this.QueryGenerator.dropTableQuery(tableName))
      , self   = this

    _query
      .success(function(){ self.emit('dropTable', null) })
      .error(function(err){ self.emit('dropTable', err)})

    return _query
  }

  QueryInterface.prototype.dropAllTables = function() {
    var self = this

    return new Utils.CustomEventEmitter(function(emitter) {
      var chainer = new Utils.QueryChainer()

      self.showAllTables().success(function(tableNames) {
        tableNames.forEach(function(tableName) {
          chainer.add(self.sequelize.getQueryInterface().dropTable(tableName))
        })
        chainer
          .run()
          .success(function() {
            self.emit('dropAllTables', null)
            emitter.emit('success', null)
          })
          .error(function(err) {
            self.emit('dropAllTables', err)
            emitter.emit('failure', err)
          })
      }).error(function(err) {
        self.emit('dropAllTables', err)
        emitter.emit('failure', err)
      })
    }).run()
  }

  QueryInterface.prototype.renameTable = function(before, after) {
    var _query = query.call(this, this.QueryGenerator.renameTableQuery(before, after))
      , self   = this

    _query
      .success(function(){ self.emit('renameTable', null) })
      .error(function(err){ self.emit('renameTable', err)})

    return _query

  }

  QueryInterface.prototype.showAllTables = function() {
    var self = this

    return new Utils.CustomEventEmitter(function(emitter) {
      self.sequelize.query('SHOW TABLES;', null, { raw: true }).success(function(data) {
        var tableNames = Sequelize.Utils._.map(data, function(hash) {
          return Sequelize.Utils._.values(hash)
        })

        self.emit('showAllTables', null)
        emitter.emit('success', Sequelize.Utils._.flatten(tableNames))
      }).error(function(err) {
        self.emit('showAllTables', err)
        emitter.emit('failure', err)
      })
    }).run()
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
          self.emit('insert', null)

          obj.isNewRecord = false
          emitter.emit('success', obj)
        })
        .error(function(err) {
          self.emit('insert', err)
          emitter.emit('failure', err)
        })
    }).run()
  }

  QueryInterface.prototype.update = function(model, tableName, values, identifier) {
    var sql    = this.QueryGenerator.updateQuery(tableName, values, identifier)
      , _query = query.call(this, sql, model)
      , self   = this

    _query
      .success(function(){ self.emit('update', null) })
      .error(function(err){ self.emit('update', err)})

    return _query
  }

  QueryInterface.prototype.delete = function(model, tableName, identifier) {
    var sql    = this.QueryGenerator.deleteQuery(tableName, identifier)
      , _query = query.call(this, sql, model)
      , self   = this

    _query
      .success(function(){ self.emit('delete', null) })
      .error(function(err){ self.emit('delete', err)})

    return _query
  }

  QueryInterface.prototype.select = function(factory, tableName, options, queryOptions) {
    queryOptions = queryOptions || {}

    var sql    = this.QueryGenerator.selectQuery(tableName, options)
      , _query = query.call(this, sql, factory, queryOptions)
      , self   = this

    _query
      .success(function(){ self.emit('select', null) })
      .error(function(err){ self.emit('select', err)})

    return _query
  }

  QueryInterface.prototype.rawSelect = function(tableName, options, attributeSelector) {
    var self = this

    if(attributeSelector == undefined)
      throw new Error('Please pass an attribute selector!')

    return new Utils.CustomEventEmitter(function(emitter) {
      var sql    = self.QueryGenerator.selectQuery(tableName, options)
        , _query = query.call(self, sql, null, { plain: true, raw: true })

      _query.success(function(data) {
        self.emit('rawSelect', null)
        emitter.emit('success', data[attributeSelector])
      }).error(function(err) {
        self.emit('rawSelect', err)
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
