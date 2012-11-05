var Utils     = require('./utils')
  , DataTypes = require('./data-types')

module.exports = (function() {
  var QueryInterface = function(sequelize) {
    this.sequelize = sequelize
    this.QueryGenerator = require('./dialects/' + this.sequelize.options.dialect + '/query-generator')
   this.QueryGenerator.options = this.sequelize.options;
  }
  Utils.addEventEmitter(QueryInterface)

  QueryInterface.prototype.createTable = function(tableName, attributes, options) {
    var attributeHashes = {}

    Utils._.each(attributes, function(dataTypeOrOptions, attributeName) {
      if(Utils._.values(DataTypes).indexOf(dataTypeOrOptions) > -1)
        attributeHashes[attributeName] = { type: dataTypeOrOptions }
      else
        attributeHashes[attributeName] = dataTypeOrOptions
    })

    attributes = this.QueryGenerator.attributesToSQL(attributeHashes)

    var sql = this.QueryGenerator.createTableQuery(tableName, attributes, options)
    return queryAndEmit.call(this, sql, 'createTable')
  }

  QueryInterface.prototype.dropTable = function(tableName) {
    var sql = this.QueryGenerator.dropTableQuery(tableName)
    return queryAndEmit.call(this, sql, 'dropTable')
  }

  QueryInterface.prototype.dropAllTables = function() {
    var self = this

    return new Utils.CustomEventEmitter(function(emitter) {
      var chainer = new Utils.QueryChainer()

      self.showAllTables().success(function(tableNames) {
        tableNames.forEach(function(tableName) {
          chainer.add(self.dropTable(tableName))
        })
        chainer
          .run()
          .success(function() {
            self.emit('dropAllTables', null)
            emitter.emit('success', null)
          })
          .error(function(err) {
            self.emit('dropAllTables', err)
            emitter.emit('error', err)
          })
      }).error(function(err) {
        self.emit('dropAllTables', err)
        emitter.emit('error', err)
      })
    }).run()
  }

  QueryInterface.prototype.renameTable = function(before, after) {
    var sql = this.QueryGenerator.renameTableQuery(before, after)
    return queryAndEmit.call(this, sql, 'renameTable')
  }

  QueryInterface.prototype.showAllTables = function() {
    var self = this

    return new Utils.CustomEventEmitter(function(emitter) {
      var showTablesSql = self.QueryGenerator.showTablesQuery()
      self.sequelize.query(showTablesSql, null, { raw: true }).success(function(tableNames) {
        self.emit('showAllTables', null)
        emitter.emit('success', Utils._.flatten(tableNames))
      }).error(function(err) {
        self.emit('showAllTables', err)
        emitter.emit('error', err)
      })
    }).run()
  }

  QueryInterface.prototype.describeTable = function(tableName) {
    var self = this

    return new Utils.CustomEventEmitter(function(emitter) {
      var sql;
      if (self.QueryGenerator.describeTableQuery) {
        sql = self.QueryGenerator.describeTableQuery(tableName)
      } else {
        sql = 'DESCRIBE `' + tableName + '`;'
      }
      self.sequelize.query(sql, null, { raw: true }).success(function(data) {
        emitter.emit('success', data)
      }).error(function(err) {
        emitter.emit('error', err)
      })
    }).run()
  }

  QueryInterface.prototype.addColumn = function(tableName, attributeName, dataTypeOrOptions) {
    var attributes = {}

    if(Utils._.values(DataTypes).indexOf(dataTypeOrOptions) > -1)
      attributes[attributeName] = { type: dataTypeOrOptions, allowNull: false }
    else
      attributes[attributeName] = dataTypeOrOptions

    var options = this.QueryGenerator.attributesToSQL(attributes)
      , sql     = this.QueryGenerator.addColumnQuery(tableName, options)

    return queryAndEmit.call(this, sql, 'addColumn')
  }

  QueryInterface.prototype.removeColumn = function(tableName, attributeName) {
    var sql = this.QueryGenerator.removeColumnQuery(tableName, attributeName)
    return queryAndEmit.call(this, sql, 'removeColumn')
  }

  QueryInterface.prototype.changeColumn = function(tableName, attributeName, dataTypeOrOptions) {
    var attributes = {}

    if(Utils._.values(DataTypes).indexOf(dataTypeOrOptions) > -1)
      attributes[attributeName] = { type: dataTypeOrOptions, allowNull: false }
    else
      attributes[attributeName] = dataTypeOrOptions

    var options = this.QueryGenerator.attributesToSQL(attributes)
      , sql     = this.QueryGenerator.changeColumnQuery(tableName, options)

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
          self.QueryGenerator.attributesToSQL(options)
        )

        self.sequelize.query(sql, null, {}).success(function() {
          self.emit('renameColumn', null)
          emitter.emit('success', null)
        }).error(function(err) {
          self.emit('renameColumn', err)
          emitter.emit('error', err)
        })
      }).error(function(err) {
        self.emit('renameColumn', err)
        emitter.emit('error', err)
      })
    }).run()
  }

  QueryInterface.prototype.addIndex = function(tableName, attributes, options) {
    var sql = this.QueryGenerator.addIndexQuery(tableName, attributes, options)
    return queryAndEmit.call(this, sql, 'addIndex')
  }

  QueryInterface.prototype.showIndex = function(tableName, options) {
    var sql = this.QueryGenerator.showIndexQuery(tableName, options)
    return queryAndEmit.call(this, sql, 'showIndex')
  }

  QueryInterface.prototype.removeIndex = function(tableName, indexNameOrAttributes) {
    var sql = this.QueryGenerator.removeIndexQuery(tableName, indexNameOrAttributes)
    return queryAndEmit.call(this, sql, "removeIndex")
  }

  QueryInterface.prototype.insert = function(dao, tableName, values) {
    var sql = this.QueryGenerator.insertQuery(tableName, values)
    return queryAndEmit.call(this, [sql, dao], 'insert', {
      success: function(obj) { obj.isNewRecord = false }
    })
  }

  QueryInterface.prototype.update = function(dao, tableName, values, identifier) {
    var sql = this.QueryGenerator.updateQuery(tableName, values, identifier)
    return queryAndEmit.call(this, [sql, dao], 'update')
  }

  QueryInterface.prototype.delete = function(dao, tableName, identifier) {
    var sql = this.QueryGenerator.deleteQuery(tableName, identifier)
    return queryAndEmit.call(this, [sql, dao], 'delete')
  }

  QueryInterface.prototype.select = function(factory, tableName, options, queryOptions) {
    var sql = this.QueryGenerator.selectQuery(tableName, options)
    return queryAndEmit.call(this, [sql, factory, queryOptions], 'select')
  }

  QueryInterface.prototype.rawSelect = function(tableName, options, attributeSelector) {
    var self = this

    if(attributeSelector == undefined) {
      throw new Error('Please pass an attribute selector!')
    }

    return new Utils.CustomEventEmitter(function(emitter) {
      var sql = self.QueryGenerator.selectQuery(tableName, options)
        , qry = self.sequelize.query(sql, null, { plain: true, raw: true, type: 'SELECT' })

      qry
        .success(function(data) {
          var result = data[attributeSelector]

          if (options && options.parseInt) {
            result = parseInt(result)
          }

          self.emit('rawSelect', null)
          emitter.emit('success', result)
        })
        .error(function(err) {
          self.emit('rawSelect', err)
          emitter.emit('error', err)
        })
        .on('sql', function(sql) {
          emitter.emit('sql', sql)
        })
    }).run()
  }

  // private

  var queryAndEmit = function(sqlOrQueryParams, methodName, options) {
    var self = this

    options = Utils._.extend({
      success: function(){},
      error: function(){}
    }, options || {})

    return new Utils.CustomEventEmitter(function(emitter) {
      var query = null

      if(Array.isArray(sqlOrQueryParams)) {
        if (sqlOrQueryParams.length === 1) {
          sqlOrQueryParams.push(null)
        }

        if (sqlOrQueryParams.length === 2) {
          sqlOrQueryParams.push({})
        }

        query = self.sequelize.query.apply(self.sequelize, sqlOrQueryParams)
      } else {
        query = self.sequelize.query(sqlOrQueryParams, null, {})
      }

      // append the query for better testing
      emitter.query = query

      query.success(function(obj) {
        options.success && options.success(obj)
        self.emit(methodName, null)
        emitter.emit('success', obj)
      }).error(function(err) {
        options.error && options.error(err)
        self.emit(methodName, err)
        emitter.emit('error', err)
      })
      query.on('sql', function(sql) {
        emitter.emit('sql', sql)
      });
    }).run()
  }

  return QueryInterface
})()
