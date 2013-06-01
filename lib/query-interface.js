var Utils                = require('./utils')
  , DataTypes            = require('./data-types')
  , SQLiteQueryInterface = require('./dialects/sqlite/query-interface')

module.exports = (function() {
  var QueryInterface = function(sequelize) {
    this.sequelize              = sequelize
    this.QueryGenerator         = require('./dialects/' + this.sequelize.options.dialect + '/query-generator')
    this.QueryGenerator.options = this.sequelize.options
  }
  Utils.addEventEmitter(QueryInterface)

  QueryInterface.prototype.createSchema = function(schema) {
    var sql = this.QueryGenerator.createSchema(schema)
    return queryAndEmit.call(this, sql, 'createSchema')
  }

  QueryInterface.prototype.dropSchema = function(schema) {
    var sql = this.QueryGenerator.dropSchema(schema)
    return queryAndEmit.call(this, sql, 'dropSchema')
  }

  QueryInterface.prototype.dropAllSchemas = function() {
    var self = this

    return new Utils.CustomEventEmitter(function(emitter) {
      var chainer = new Utils.QueryChainer()

      self.showAllSchemas().success(function(schemaNames) {
        schemaNames.forEach(function(schemaName) {
          chainer.add(self.dropSchema(schemaName))
        })
        chainer
          .run()
          .success(function() {
            self.emit('dropAllSchemas', null)
            emitter.emit('success', null)
          })
          .error(function(err) {
            self.emit('dropAllSchemas', err)
            emitter.emit('error', err)
          })
      }).error(function(err) {
        self.emit('dropAllSchemas', err)
        emitter.emit('error', err)
      })
    }).run()
  }

  QueryInterface.prototype.showAllSchemas = function() {
    var self = this

    return new Utils.CustomEventEmitter(function(emitter) {
      var showSchemasSql = self.QueryGenerator.showSchemasQuery()
      self.sequelize.query(showSchemasSql, null, { raw: true }).success(function(schemaNames) {
        self.emit('showAllSchemas', null)
        emitter.emit('success', Utils._.flatten(Utils._.map(schemaNames, function(value){ return value.schema_name })))
      }).error(function(err) {
        self.emit('showAllSchemas', err)
        emitter.emit('error', err)
      })
    }).run()
  }

  QueryInterface.prototype.createTable = function(tableName, attributes, options) {
    var attributeHashes = {}

    Utils._.each(attributes, function(dataTypeOrOptions, attributeName) {
      if (Utils._.values(DataTypes).indexOf(dataTypeOrOptions) > -1) {
        attributeHashes[attributeName] = { type: dataTypeOrOptions, allowNull: true }
      } else {
        attributeHashes[attributeName] = dataTypeOrOptions
      }
    })

    attributes = this.QueryGenerator.attributesToSQL(attributeHashes)

    var sql = this.QueryGenerator.createTableQuery(tableName, attributes, options)
    return queryAndEmit.call(this, sql, 'createTable')
  }

  QueryInterface.prototype.dropTable = function(tableName, options) {
    var sql = this.QueryGenerator.dropTableQuery(tableName, options)
    return queryAndEmit.call(this, sql, 'dropTable')
  }

  QueryInterface.prototype.dropAllTables = function() {
    var self = this

    return new Utils.CustomEventEmitter(function(emitter) {
      var chainer = new Utils.QueryChainer()

      self.showAllTables().success(function(tableNames) {

        chainer.add(self, 'disableForeignKeyConstraints', [])

        tableNames.forEach(function(tableName) {
          chainer.add(self, 'dropTable', [tableName, {cascade: true}])
        })

        chainer.add(self, 'enableForeignKeyConstraints', [])

        chainer
          .runSerially()
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

    if (Utils._.values(DataTypes).indexOf(dataTypeOrOptions) > -1) {
      attributes[attributeName] = { type: dataTypeOrOptions, allowNull: true }
    } else {
      attributes[attributeName] = dataTypeOrOptions
    }

    var options = this.QueryGenerator.attributesToSQL(attributes)
      , sql     = this.QueryGenerator.addColumnQuery(tableName, options)

    return queryAndEmit.call(this, sql, 'addColumn')
  }

  QueryInterface.prototype.removeColumn = function(tableName, attributeName) {
    if (this.sequelize.options.dialect === 'sqlite') {
      // sqlite needs some special treatment as it cannot drop a column
      return new Utils.CustomEventEmitter(function(emitter) {
        SQLiteQueryInterface.removeColumn.call(this, tableName, attributeName, emitter, queryAndEmit)
      }.bind(this)).run()
    } else {
      var sql = this.QueryGenerator.removeColumnQuery(tableName, attributeName)
      return queryAndEmit.call(this, sql, 'removeColumn')
    }
  }

  QueryInterface.prototype.changeColumn = function(tableName, attributeName, dataTypeOrOptions) {
    var attributes = {}

    if (Utils._.values(DataTypes).indexOf(dataTypeOrOptions) > -1) {
      attributes[attributeName] = { type: dataTypeOrOptions, allowNull: true }
    } else {
      attributes[attributeName] = dataTypeOrOptions
    }

    if (this.sequelize.options.dialect === 'sqlite') {
      // sqlite needs some special treatment as it cannot change a column
      return new Utils.CustomEventEmitter(function(emitter) {
        SQLiteQueryInterface.changeColumn.call(this, tableName, attributes, emitter, queryAndEmit)
      }.bind(this)).run()
    } else {
      var options = this.QueryGenerator.attributesToSQL(attributes)
        , sql     = this.QueryGenerator.changeColumnQuery(tableName, options)

      return queryAndEmit.call(this, sql, 'changeColumn')
    }
  }

  QueryInterface.prototype.renameColumn = function(tableName, attrNameBefore, attrNameAfter) {
    return new Utils.CustomEventEmitter(function(emitter) {
      this.describeTable(tableName).success(function(data) {
        data = data[attrNameBefore] || {}

        var options =  {}

        options[attrNameAfter] = {
          attribute:    attrNameAfter,
          type:         data.type,
          allowNull:    data.allowNull,
          defaultValue: data.defaultValue
        }

        if (this.sequelize.options.dialect === 'sqlite') {
          // sqlite needs some special treatment as it cannot rename a column
          SQLiteQueryInterface.renameColumn.call(this, tableName, attrNameBefore, attrNameAfter, emitter, queryAndEmit)
        } else {
          var sql = this.QueryGenerator.renameColumnQuery(tableName,
            attrNameBefore,
            this.QueryGenerator.attributesToSQL(options)
          )
          queryAndEmit.call(this, sql, 'renameColumn', {}, emitter)
        }
      }.bind(this))
      .error(function(err) {
        this.emit('renameColumn', err)
        emitter.emit('error', err)
      }.bind(this))
    }.bind(this)).run()
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

  QueryInterface.prototype.bulkInsert = function(tableName, records) {
    var sql = this.QueryGenerator.bulkInsertQuery(tableName, records)
    return queryAndEmit.call(this, sql, 'bulkInsert')
  }

  QueryInterface.prototype.update = function(dao, tableName, values, identifier) {
    var sql = this.QueryGenerator.updateQuery(tableName, values, identifier)
    return queryAndEmit.call(this, [sql, dao], 'update')
  }

  QueryInterface.prototype.bulkUpdate = function(tableName, values, identifier) {
    var sql = this.QueryGenerator.updateQuery(tableName, values, identifier)
    return queryAndEmit.call(this, sql, 'bulkUpdate')
  }

  QueryInterface.prototype.delete = function(dao, tableName, identifier) {
    var sql = this.QueryGenerator.deleteQuery(tableName, identifier)
    return queryAndEmit.call(this, [sql, dao], 'delete')
  }

  QueryInterface.prototype.bulkDelete = function(tableName, identifier, options) {
    var sql = this.QueryGenerator.deleteQuery(tableName, identifier, Utils._.defaults(options || {}, {limit: null}))
    return queryAndEmit.call(this, sql, 'bulkDelete')
  }

  QueryInterface.prototype.select = function(factory, tableName, options, queryOptions) {
    options = options || {}

    var sql = this.QueryGenerator.selectQuery(tableName, options)
    queryOptions = Utils._.extend({}, queryOptions, { include: options.include })
    return queryAndEmit.call(this, [sql, factory, queryOptions], 'select')
  }

  QueryInterface.prototype.increment = function(dao, tableName, values, identifier) {
    var sql = this.QueryGenerator.incrementQuery(tableName, values, identifier);
    return queryAndEmit.call(this, [sql, dao], 'increment');
  }

  QueryInterface.prototype.rawSelect = function(tableName, options, attributeSelector) {
    var self = this

    if (attributeSelector === undefined) {
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

          if (options && options.parseFloat) {
            result = parseFloat(result)
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

  QueryInterface.prototype.enableForeignKeyConstraints = function() {
    var sql = this.QueryGenerator.enableForeignKeyConstraintsQuery()
    if(sql) {
      return queryAndEmit.call(this, sql, 'enableForeignKeyConstraints')
    } else {
      return new Utils.CustomEventEmitter(function(emitter) {
        this.emit('enableForeignKeyConstraints', null)
        emitter.emit('success')
      }).run()
    }
  }

  QueryInterface.prototype.disableForeignKeyConstraints = function() {
    var sql = this.QueryGenerator.disableForeignKeyConstraintsQuery()
    if(sql){
      return queryAndEmit.call(this, sql, 'disableForeignKeyConstraints')
    } else {
      return new Utils.CustomEventEmitter(function(emitter) {
        this.emit('disableForeignKeyConstraints', null)
        emitter.emit('success')
      }).run()
    }
  }

  // Helper methods useful for querying

  /**
   * Escape an identifier (e.g. a table or attribute name). If force is true,
   * the identifier will be quoted even if the `quoteIdentifiers` option is
   * false.
   */
  QueryInterface.prototype.quoteIdentifier = function(identifier, force) {
    return this.QueryGenerator.quoteIdentifier(identifier, force)
  }

  /**
   * Split an identifier into .-separated tokens and quote each part.
   * If force is true, the identifier will be quoted even if the
   * `quoteIdentifiers` option is false.
   */
  QueryInterface.prototype.quoteIdentifiers = function(identifiers, force) {
    return this.QueryGenerator.quoteIdentifiers(identifiers, force)
  }

  /**
   * Escape a value (e.g. a string, number or date)
   */
  QueryInterface.prototype.escape = function(value) {
    return this.QueryGenerator.escape(value)
  }

  // private

  var queryAndEmit = function(sqlOrQueryParams, methodName, options, emitter) {
    options = Utils._.extend({
      success: function(){},
      error: function(){}
    }, options || {})

    var execQuery = function(emitter) {
      var query = null

      if (Array.isArray(sqlOrQueryParams)) {
        if (sqlOrQueryParams.length === 1) {
          sqlOrQueryParams.push(null)
        }

        if (sqlOrQueryParams.length === 2) {
          sqlOrQueryParams.push({})
        }

        query = this.sequelize.query.apply(this.sequelize, sqlOrQueryParams)
      } else {
        query = this.sequelize.query(sqlOrQueryParams, null, {})
      }

      // append the query for better testing
      emitter.query = query

      query.success(function(obj) {
        options.success && options.success(obj)
        this.emit(methodName, null)
        emitter.emit('success', obj)
      }.bind(this)).error(function(err) {
        options.error && options.error(err)
        this.emit(methodName, err)
        emitter.emit('error', err)
      }.bind(this))

      query.on('sql', function(sql) {
        emitter.emit('sql', sql)
      })
    }.bind(this)

    if (!!emitter) {
      execQuery(emitter)
    } else {
      return new Utils.CustomEventEmitter(execQuery).run()
    }
  }

  return QueryInterface
})()
