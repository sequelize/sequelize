var Utils     = require('./utils')
  , DataTypes = require('./data-types')

module.exports = (function() {
  var QueryInterface = function(sequelize) {
    this.sequelize = sequelize
    this.QueryGenerator = require('./connectors/' + this.sequelize.options.connector + '/query-generator')
  }
  Utils.addEventEmitter(QueryInterface)

  QueryInterface.prototype.createTable = function(tableName, attributes, options) {
    var sql  = this.QueryGenerator.createTableQuery(tableName, attributes, options)
      , self = this

    return queryAndEmit.call(this, sql, 'createTable')
  }

  QueryInterface.prototype.dropTable = function(tableName) {
    var sql  = this.QueryGenerator.dropTableQuery(tableName)
      , self = this

    return queryAndEmit.call(this, sql, 'dropTable')
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
    var sql  = this.QueryGenerator.renameTableQuery(before, after)
      , self = this

    return queryAndEmit.call(this, sql, 'renameTable')
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

  QueryInterface.prototype.describeTable = function(tableName) {
    var self = this

    return new Utils.CustomEventEmitter(function(emitter) {
      self.sequelize.query('DESCRIBE `' + tableName + '`;', null, { raw: true }).success(function(data) {
        emitter.emit('success', data)
      }).error(function(err) {
        emitter.emit('failure', err)
      })
    }).run()
  }

  QueryInterface.prototype.addColumn = function(tableName, attributeName, dataTypeOrOptions) {
    var attributes = {}

    if(Utils._.values(DataTypes).indexOf(dataTypeOrOptions) > -1)
      attributes[attributeName] = { type: dataTypeOrOptions, allowNull: false }
    else
      attributes[attributeName] = dataTypeOrOptions

    var options = Utils.simplifyAttributes(attributes)
      , sql     = this.QueryGenerator.addColumnQuery(tableName, options)
      , self    = this

    return queryAndEmit.call(this, sql, 'addColumn')
  }

  QueryInterface.prototype.removeColumn = function(tableName, attributeName) {
    var sql  = this.QueryGenerator.removeColumnQuery(tableName, attributeName)
      , self = this

    return queryAndEmit.call(this, sql, 'removeColumn')
  }

  QueryInterface.prototype.changeColumn = function(tableName, attributeName, dataTypeOrOptions) {
    var attributes = {}

    if(Utils._.values(DataTypes).indexOf(dataTypeOrOptions) > -1)
      attributes[attributeName] = { type: dataTypeOrOptions, allowNull: false }
    else
      attributes[attributeName] = dataTypeOrOptions

    var options = Utils.simplifyAttributes(attributes)
      , sql     = this.QueryGenerator.changeColumnQuery(tableName, options)
      , self    = this

    return queryAndEmit.call(this, sql, 'changeColumn')
  }

  QueryInterface.prototype.renameColumn = function(tableName, attrNameBefore, attrNameAfter) {
    var self = this

    return new Utils.CustomEventEmitter(function(emitter) {
      self.describeTable(tableName).success(function(data) {
        data = data.filter(function(h) { return h.Field == attrNameBefore })[0]

        var options =  {}

        options[attrNameAfter] = {
          type: data.Type,
          allowNull: data.Null == 'YES',
          defaultValue: data.Default
        }

        var sql = self.QueryGenerator.renameColumnQuery(tableName,
          attrNameBefore,
          Utils.simplifyAttributes(options)
        )

        self.sequelize.query(sql).success(function() {
          self.emit('renameColumn', null)
          emitter.emit('success', null)
        }).error(function(err) {
          self.emit('renameColumn', err)
          emitter.emit('failure', err)
        })
      }).error(function(err) {
        self.emit('renameColumn', err)
        emitter.emit('failure', err)
      })
    }).run()
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
    var sql  = this.QueryGenerator.updateQuery(tableName, values, identifier)
      , self = this

    return queryAndEmit.call(this, sql, 'update')
  }

  QueryInterface.prototype.delete = function(model, tableName, identifier) {
    var sql  = this.QueryGenerator.deleteQuery(tableName, identifier)
      , self = this

    return queryAndEmit.call(this, sql, 'delete')
  }

  QueryInterface.prototype.select = function(factory, tableName, options, queryOptions) {
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

  var queryAndEmit = function(sql, methodName) {
    var self = this

    return new Utils.CustomEventEmitter(function(emitter) {
      self.sequelize.query(sql).success(function() {
        self.emit(methodName, null)
        emitter.emit('success', null)
      }).error(function(err) {
        self.emit(methodName, err)
        emitter.emit('failure', err)
      })
    }).run()
  }

  var query = function() {
    var args = Utils._.map(arguments, function(arg, _) { return arg })

    // add this as callee via the second argument
    if(arguments.length == 1) args.push(this)

    return this.sequelize.query.apply(this.sequelize, args)
  }

  return QueryInterface
})()
