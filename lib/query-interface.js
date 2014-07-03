var Utils                = require(__dirname + '/utils')
  , DataTypes            = require(__dirname + '/data-types')
  , SQLiteQueryInterface = require(__dirname + '/dialects/sqlite/query-interface')
  , Transaction          = require(__dirname + '/transaction')
  , QueryTypes           = require('./query-types')

module.exports = (function() {
  var QueryInterface = function(sequelize) {
    this.sequelize                = sequelize
    this.QueryGenerator           = require('./dialects/' + this.sequelize.options.dialect + '/query-generator')
    this.QueryGenerator.options   = this.sequelize.options
    this.QueryGenerator._dialect  = this.sequelize.dialect
    this.QueryGenerator.sequelize = this.sequelize
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

  QueryInterface.prototype.showAllSchemas = function(options) {
    var self = this

    options = Utils._.extend({
      transaction: null,
      raw:         true
    }, options || {})

    return new Utils.CustomEventEmitter(function(emitter) {
      var showSchemasSql = self.QueryGenerator.showSchemasQuery()
      self.sequelize.query(showSchemasSql, null, options).success(function(schemaNames) {
        self.emit('showAllSchemas', null)
        emitter.emit('success', Utils._.flatten(Utils._.map(schemaNames, function(value){ return (!!value.schema_name ? value.schema_name : value) })))
      }).error(function(err) {
        self.emit('showAllSchemas', err)
        emitter.emit('error', err)
      })
    }).run()
  }

  QueryInterface.prototype.createTable = function(tableName, attributes, options) {
    var attributeHashes   = {}
      , dataTypeValues    = Utils._.values(DataTypes)
      , keys              = Object.keys(attributes)
      , keyLen            = keys.length
      , self              = this
      , sql               = ''
      , i                 = 0

    for (i = 0; i < keyLen; i++) {
      if (dataTypeValues.indexOf(attributes[keys[i]]) > -1) {
        attributeHashes[keys[i]] = { type: attributes[keys[i]], allowNull: true }
      } else {
        attributeHashes[keys[i]] = attributes[keys[i]]
      }
    }

    options = Utils._.extend({
      logging: this.sequelize.options.logging
    }, options || {})

    return new Utils.CustomEventEmitter(function(emitter) {
      // Postgres requires a special SQL command for enums
      if (self.sequelize.options.dialect === "postgres") {
        var chainer = new Utils.QueryChainer()
          // For backwards-compatibility, public schemas don't need to
          // explicitly state their schema when creating a new enum type
          , getTableName = (!options || !options.schema || options.schema === "public" ? '' : options.schema + '_') + tableName

        for (i = 0; i < keyLen; i++) {
          if (attributes[keys[i]].toString().match(/^ENUM\(/) || attributes[keys[i]].toString() === "ENUM" || (attributes[keys[i]].type && attributes[keys[i]].type.toString() === "ENUM")) {
            sql = self.QueryGenerator.pgListEnums(getTableName, keys[i], options)
            chainer.add(self.sequelize.query(sql, null, { plain: true, raw: true, type: QueryTypes.SELECT, logging: options.logging }))
          }
        }

        chainer.runSerially().success(function(results) {
          var chainer2 = new Utils.QueryChainer()
            // Find the table that we're trying to create throgh DAOFactoryManager
            , daoTable = self.sequelize.daoFactoryManager.daos.filter(function(dao) { return dao.tableName === tableName })
            , enumIdx  = 0

          daoTable = daoTable.length > 0 ? daoTable[0] : null

          for (i = 0; i < keyLen; i++) {
            if (attributes[keys[i]].toString().match(/^ENUM\(/) || attributes[keys[i]].toString() === "ENUM" || (attributes[keys[i]].type && attributes[keys[i]].type.toString() === "ENUM")) {
              // If the enum type doesn't exist then create it
              if (!results[enumIdx]) {
                sql = self.QueryGenerator.pgEnum(getTableName, keys[i], attributes[keys[i]], options)
                chainer2.add(self.sequelize.query(sql, null, { raw: true, logging: options.logging }))
              } else if (!!results[enumIdx] && !!daoTable) {
                var enumVals = self.QueryGenerator.fromArray(results[enumIdx].enum_value)
                  , vals = daoTable.rawAttributes[keys[i]].values

                vals.forEach(function(value, idx) {
                  // reset out after/before options since it's for every enum value
                  options.before = null
                  options.after = null

                  if (enumVals.indexOf(value) === -1) {
                    if (!!vals[idx+1]) {
                      options.before = vals[idx+1]
                    }
                    else if (!!vals[idx-1]) {
                      options.after = vals[idx-1]
                    }

                    chainer2.add(self.sequelize.query(self.QueryGenerator.pgEnumAdd(getTableName, keys[i], value, options)))
                  }
                })
                enumIdx++
              }
            }
          }

          attributes = self.QueryGenerator.attributesToSQL(attributeHashes)
          sql = self.QueryGenerator.createTableQuery(tableName, attributes, options)

          chainer2.run().success(function() {
            queryAndEmit
              .call(self, sql, 'createTable', options)
              .success(function(res) {
                self.emit('createTable', null)
                emitter.emit('success', res)
              })
              .error(function(err) {
                self.emit('createTable', err)
                emitter.emit('error', err)
              })
              .on('sql', function(sql)  {
                emitter.emit('sql', sql)
              })
          }).error(function(err) {
            emitter.emit('error', err)
          }).on('sql', function(sql) {
            emitter.emit('sql', sql)
          })
        })
      } else {
        attributes = self.QueryGenerator.attributesToSQL(attributeHashes)
        sql = self.QueryGenerator.createTableQuery(tableName, attributes, options)

        queryAndEmit.call(self, sql, 'createTable', options).success(function(results) {
          self.emit('createTable', null)
          emitter.emit('success', results)
        }).error(function(err) {
          self.emit('createTable', err)
          emitter.emit('error', err)
        }).on('sql', function(sql) {
          emitter.emit('sql', sql)
        })
      }
    }).run()
  }

  QueryInterface.prototype.dropTable = function(tableName, options) {
    // if we're forcing we should be cascading unless explicitly stated otherwise
    options = options || {}
    options.cascade = options.cascade || options.force || false

    var sql  = this.QueryGenerator.dropTableQuery(tableName, options)
      , self = this

    return new Utils.CustomEventEmitter(function(emitter) {
      var chainer = new Utils.QueryChainer()

      chainer.add(self, 'queryAndEmit', [sql, 'dropTable'], options)

      // Since postgres has a special case for enums, we should drop the related
      // enum type within the table and attribute
      if (self.sequelize.options.dialect === "postgres") {
        // Find the table that we're trying to drop
        daoTable = self.sequelize.daoFactoryManager.daos.filter(function(dao) {
          return dao.tableName === tableName
        })

        // Just in case if we're trying to drop a non-existing table
        daoTable = daoTable.length > 0 ? daoTable[0] : null
        if (!!daoTable) {
          var getTableName = (!options || !options.schema || options.schema === "public" ? '' : options.schema + '_') + tableName

          var keys = Object.keys(daoTable.rawAttributes)
            , keyLen = keys.length
            , i = 0

          for (i = 0; i < keyLen; i++) {
            if (daoTable.rawAttributes[keys[i]].type && daoTable.rawAttributes[keys[i]].type.toString() === "ENUM") {
              chainer.add(self.sequelize, 'query', [self.QueryGenerator.pgEnumDrop(getTableName, keys[i]), null, {logging: options.logging, raw: true}])
            }
          }
        }
      }

      chainer.runSerially().success(function(results) {
        emitter.emit('success', results[0])
        self.emit('dropTable', null)
      }).error(function(err) {
        emitter.emit('error', err)
        self.emit('dropTable', err)
      }).on('sql', function(sql) {
        emitter.emit('sql', sql)
      })
    }).run()
  }

  QueryInterface.prototype.dropAllTables = function(options) {
    var self = this

    if (!options) {
      options = {}
    }

    var skip = options.skip || [];

    if (this.sequelize.options.dialect === 'sqlite') {
      // sqlite needs some special treatment as it cannot drop a column
      return SQLiteQueryInterface.dropAllTables.call(this, options)
    } else {
      return new Utils.CustomEventEmitter(function(dropAllTablesEmitter) {
        var events  = []
          , chainer = new Utils.QueryChainer()
          , onError = function(err) {
              self.emit('dropAllTables', err)
              dropAllTablesEmitter.emit('error', err)
            }

        self.showAllTables().success(function(tableNames) {
          self.getForeignKeysForTables(tableNames).success(function(foreignKeys) {

            // add the foreign key removal query to the chainer
            Object.keys(foreignKeys).forEach(function(tableName) {
              foreignKeys[tableName].forEach(function(foreignKey) {
                var sql = self.QueryGenerator.dropForeignKeyQuery(tableName, foreignKey)
                chainer.add(self.sequelize, 'query', [ sql ])
              })
            })

            // add the table removal query to the chainer
            tableNames.forEach(function(tableName) {
              // if tableName is not in the Array of tables names then dont drop it
              if (skip.indexOf(tableName) === -1) {
                chainer.add(self, 'dropTable', [ tableName, { cascade: true } ])
              }
            })

            chainer
              .runSerially()
              .success(function() {
                self.emit('dropAllTables', null)
                dropAllTablesEmitter.emit('success', null)
              })
              .error(onError)
          }).error(onError)
        }).error(onError)
      }).run()
    }
  }

  QueryInterface.prototype.dropAllEnums = function(options) {
    if (this.sequelize.getDialect() !== 'postgres') {
      return new Utils.CustomEventEmitter(function (emitter) {
        emitter.emit('success')
      }).run()
    }

    options = options || {}

    var self = this
      , emitter = new Utils.CustomEventEmitter()
      , chainer = new Utils.QueryChainer()
      , sql = this.QueryGenerator.pgListEnums()

    this.sequelize.query(sql, null, { plain: false, raw: true, type: QueryTypes.SELECT, logging: options.logging })
      .proxy(emitter, {events: ['sql', 'error']})
      .success(function (results) {
        results.forEach(function (result) {
          chainer.add(self.sequelize.query(
            self.QueryGenerator.pgEnumDrop(null, null, result.enum_name),
            null,
            {logging: options.logging, raw: true}
          ))
        })
        chainer.run().proxy(emitter)
      })

    return emitter
  }

  QueryInterface.prototype.renameTable = function(before, after) {
    var sql = this.QueryGenerator.renameTableQuery(before, after)
    return queryAndEmit.call(this, sql, 'renameTable')
  }

  QueryInterface.prototype.showAllTables = function(options) {
    var self = this

    options = Utils._.extend({
      transaction: null,
      raw:         true
    }, options || {})

    return new Utils.CustomEventEmitter(function(emitter) {
      var showTablesSql = self.QueryGenerator.showTablesQuery()

      self.sequelize.query(showTablesSql, null, options).success(function(tableNames) {
        self.emit('showAllTables', null)
        emitter.emit('success', Utils._.flatten(tableNames))
      }).error(function(err) {
        self.emit('showAllTables', err)
        emitter.emit('error', err)
      })
    }).run()
  }

  QueryInterface.prototype.describeTable = function(tableName, options) {
    var self = this
      , schema = null
      , schemaDelimiter = null

    if (typeof options === "string") {
      schema = options
    }
    else if (typeof options === "object") {
      schema = options.schema || null
      schemaDelimiter = options.schemaDelimiter || null
    }

    return new Utils.CustomEventEmitter(function(emitter) {
      var sql;

      if (self.QueryGenerator.describeTableQuery) {
        sql = self.QueryGenerator.describeTableQuery(tableName, schema, schemaDelimiter)
      } else {
        var table = self.QueryGenerator.quoteIdentifier(self.QueryGenerator.addSchema({tableName: tableName, options: {schema: schema, schemaDelimiter: schemaDelimiter}}), self.QueryGenerator.options.quoteIdentifiers)
        sql = 'DESCRIBE ' + table + ';'
      }

      self.sequelize.query(sql, null, { raw: true }).success(function(data) {
        if(Utils._.isEmpty(data)) {
          // If no data is returned from the query, then the table name may be wrong.
          // Query generators that use information_schema for retrieving table info will just return an empty result set,
          // it will not throw an error like built-ins do (e.g. DESCRIBE on MySql).
          emitter.emit('error', 'No description found for "' + tableName + '" table. Check the table name and schema; remember, they _are_ case sensitive.')
        } else {
          emitter.emit('success', data)
        }
      }).error(function(err) {
        emitter.emit('error', err)
      }).on('sql', function(sql) {
        emitter.emit('sql', sql)
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

  QueryInterface.prototype.getForeignKeysForTables = function(tableNames) {
    var self = this

    return new Utils.CustomEventEmitter(function(emitter) {
      if (tableNames.length === 0) {
        emitter.emit('success', {})
      } else {
        var chainer = new Utils.QueryChainer()

        tableNames.forEach(function(tableName) {
          var sql = self.QueryGenerator.getForeignKeysQuery(tableName, self.sequelize.config.database)
          chainer.add(self.sequelize, 'query', [sql])
        })

        chainer.runSerially().proxy(emitter, {
          skipEvents: ['success']
        }).success(function(results) {
          var result = {}

          tableNames.forEach(function(tableName, i) {
            result[tableName] = Utils._.compact(results[i]).map(function(r) { return r.constraint_name })
          })

          emitter.emit('success', result)
        })
      }
    }).run()
  }

  QueryInterface.prototype.removeIndex = function(tableName, indexNameOrAttributes) {
    var sql = this.QueryGenerator.removeIndexQuery(tableName, indexNameOrAttributes)
    return queryAndEmit.call(this, sql, "removeIndex")
  }

  QueryInterface.prototype.insert = function(dao, tableName, values, options) {
    var sql = this.QueryGenerator.insertQuery(tableName, values, dao.daoFactory.rawAttributes)
    return queryAndEmit.call(this, [sql, dao, options], 'insert', {
      success: function(obj) { obj.isNewRecord = false }
    })
  }

  QueryInterface.prototype.bulkInsert = function(tableName, records, options) {
    var sql = this.QueryGenerator.bulkInsertQuery(tableName, records, options)
    return queryAndEmit.call(this, [sql, null, options], 'bulkInsert')
  }

  QueryInterface.prototype.update = function(dao, tableName, values, identifier, options) {
    var self = this
      , restrict = false
      , sql = self.QueryGenerator.updateQuery(tableName, values, identifier, options, dao.daoFactory.rawAttributes)

    // Check for a restrict field
    if (!!dao.daoFactory && !!dao.daoFactory.associations) {
      var keys = Object.keys(dao.daoFactory.associations)
        , length = keys.length

      for (var i = 0; i < length; i++) {
        if (dao.daoFactory.associations[keys[i]].options && dao.daoFactory.associations[keys[i]].options.onUpdate && dao.daoFactory.associations[keys[i]].options.onUpdate === "restrict") {
          restrict = true
        }
      }
    }

    return new Utils.CustomEventEmitter(function(emitter) {
      var chainer = new Utils.QueryChainer()

      chainer.add(self, 'queryAndEmit', [[sql, dao, options], 'delete'])

      chainer.runSerially()
      .success(function(results){
        emitter.query = { sql: sql }
        emitter.emit('success', results[0])
        emitter.emit('sql', sql)
      })
      .error(function(err) {
        emitter.query = { sql: sql }
        emitter.emit('error', err)
        emitter.emit('sql', sql)
      })
      .on('sql', function(sql) {
        emitter.emit('sql', sql)
      })
    }).run()
  }

  QueryInterface.prototype.bulkUpdate = function(tableName, values, identifier, options) {
    var self = this
      , sql = self.QueryGenerator.updateQuery(tableName, values, identifier, options)

    return new Utils.CustomEventEmitter(function(emitter) {
      var chainer = new Utils.QueryChainer()

      chainer.add(self, 'queryAndEmit', [[sql, null, options], 'bulkUpdate'])

      return chainer.runSerially()
      .success(function(results){
        emitter.query = { sql: sql }
        emitter.emit('sql', sql)
        emitter.emit('success', results[0])
      })
      .error(function(err) {
        emitter.query = { sql: sql }
        emitter.emit('sql', sql)
        emitter.emit('error', err)
      })
    }).run()
  }

  QueryInterface.prototype.delete = function(dao, tableName, identifier, options) {
    var self      = this
      , restrict  = false
      , cascades  = []
      , sql       = self.QueryGenerator.deleteQuery(tableName, identifier, null, dao.daoFactory)

    // Check for a restrict field
    if (!!dao.daoFactory && !!dao.daoFactory.associations) {
      var keys = Object.keys(dao.daoFactory.associations)
        , length = keys.length

      for (var i = 0; i < length; i++) {
        if (dao.daoFactory.associations[keys[i]].options && dao.daoFactory.associations[keys[i]].options.onDelete) {
          if (dao.daoFactory.associations[keys[i]].options.onDelete === "restrict") {
            restrict = true
          }
          else if (dao.daoFactory.associations[keys[i]].options.onDelete === "cascade" && dao.daoFactory.associations[keys[i]].options.useHooks === true) {
            cascades[cascades.length] = dao.daoFactory.associations[keys[i]].accessors.get
          }
        }
      }
    }

    return new Utils.CustomEventEmitter(function(emitter) {
      var tick = 0
      var iterate = function(err, i) {
        if (!!err || i >= cascades.length) {
          return run(err)
        }

        dao[cascades[i]]().success(function(tasks) {
          if (tasks === null || tasks.length < 1) {
            return run()
          }

          tasks = Array.isArray(tasks) ? tasks : [tasks]

          var ii = 0
          var next = function(err, ii) {
            if (!!err || ii >= tasks.length) {
              return iterate(err)
            }

            tasks[ii].destroy().error(function(err) {
              return iterate(err)
            })
            .success(function() {
              ii++

              if (ii >= tasks.length) {
                tick++
                return iterate(null, tick)
              }

              next(null, ii)
            })
          }

          next(null, ii)
        })
      }

      var run = function(err) {
        if (!!err) {
          return emitter.emit('error', err)
        }

        var chainer = new Utils.QueryChainer()

        chainer.add(self, 'queryAndEmit', [[sql, dao, options], 'delete'])

        chainer.runSerially()
        .success(function(results){
          emitter.query = { sql: sql }
          emitter.emit('sql', sql)
          emitter.emit('success', results[1])
        })
        .error(function(err) {
          emitter.query = { sql: sql }
          emitter.emit('sql', sql)
          emitter.emit('error', err)
        })
      }

      if (cascades.length > 0) {
        iterate(null, tick)
      } else {
        run()
      }
    }).run()
  }

  QueryInterface.prototype.bulkDelete = function(tableName, identifier, options) {
    var self = this
    var sql = self.QueryGenerator.deleteQuery(tableName, identifier, Utils._.defaults(options || {}, {limit: null}))

    return new Utils.CustomEventEmitter(function(emitter) {
      var chainer = new Utils.QueryChainer()

      chainer.add(self, 'queryAndEmit', [[sql, null, options], 'bulkDelete', options])

      chainer.runSerially()
      .success(function(results){
        emitter.query = { sql: sql }
        emitter.emit('sql', sql)
        emitter.emit('success', results[0])
      })
      .error(function(err) {
        emitter.query = { sql: sql }
        emitter.emit('sql', sql)
        emitter.emit('error', err)
      })
    }).run()
  }

  QueryInterface.prototype.select = function(factory, tableName, options, queryOptions) {
    options = options || {}

    // See if we need to merge options and factory.scopeObj
    // we're doing this on the QueryInterface level because it's a bridge between
    // sequelize and the databases
    if (Object.keys(factory.scopeObj).length > 0) {
      if (!!options) {
        Utils.injectScope.call(factory, options, true)
      }

      var scopeObj = buildScope.call(factory)
      Object.keys(scopeObj).forEach(function(method) {
        if (typeof scopeObj[method] === "number" || !Utils._.isEmpty(scopeObj[method])) {
          options[method] = scopeObj[method]
        }
      })
    }

    var sql = this.QueryGenerator.selectQuery(tableName, options, factory)
    queryOptions = Utils._.extend({}, queryOptions, {
      include: options.include,
      includeNames: options.includeNames,
      includeMap: options.includeMap,
      hasSingleAssociation: options.hasSingleAssociation,
      hasMultiAssociation: options.hasMultiAssociation
    })

    return queryAndEmit.call(this, [sql, factory, queryOptions], 'select')
  }

  QueryInterface.prototype.increment = function(dao, tableName, values, identifier, options) {
    var sql = this.QueryGenerator.incrementQuery(tableName, values, identifier, options.attributes)
    return queryAndEmit.call(this, [sql, dao, options], 'increment')
  }

  QueryInterface.prototype.rawSelect = function(tableName, options, attributeSelector) {
    var self = this

    if (attributeSelector === undefined) {
      throw new Error('Please pass an attribute selector!')
    }

    return new Utils.CustomEventEmitter(function(emitter) {
      var sql          = self.QueryGenerator.selectQuery(tableName, options)
        , queryOptions = Utils._.extend({ transaction: options.transaction }, { plain: true, raw: true, type: QueryTypes.SELECT })
        , query        = self.sequelize.query(sql, null, queryOptions)

      query
        .success(function(data) {
          var result = data ? data[attributeSelector] : null

          if (options && options.dataType) {
            var dataType = options.dataType;

            if (dataType instanceof DataTypes.DECIMAL || dataType instanceof DataTypes.FLOAT) {
              result = parseFloat(result);
            } else if (dataType === DataTypes.INTEGER || dataType instanceof DataTypes.BIGINT) {
              result = parseInt(result, 10);
            } else if (dataType === DataTypes.DATE) {
              result = new Date(result + 'Z');
            } else if (dataType === DataTypes.STRING) {
              // Nothing to do, result is already a string.
            }
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

  QueryInterface.prototype.createTrigger = function(tableName, triggerName, timingType, fireOnArray,
      functionName, functionParams, optionsArray) {
    var  sql = this.QueryGenerator.createTrigger(tableName, triggerName, timingType, fireOnArray, functionName
        , functionParams, optionsArray)
    if (sql){
      return queryAndEmit.call(this, sql, 'createTrigger')
    } else {
      return new Utils.CustomEventEmitter(function(emitter) {
        this.emit('createTrigger', null)
        emitter.emit('success')
      }).run()
    }
  }

  QueryInterface.prototype.dropTrigger = function(tableName, triggerName) {
    var  sql = this.QueryGenerator.dropTrigger(tableName, triggerName)
    if (sql){
      return queryAndEmit.call(this, sql, 'dropTrigger')
    } else {
      return new Utils.CustomEventEmitter(function(emitter) {
        this.emit('dropTrigger', null)
        emitter.emit('success')
      }).run()
    }
  }

  QueryInterface.prototype.renameTrigger = function(tableName, oldTriggerName, newTriggerName) {
    var  sql = this.QueryGenerator.renameTrigger(tableName, oldTriggerName, newTriggerName)
    if (sql){
      return queryAndEmit.call(this, sql, 'renameTrigger')
    } else {
      return new Utils.CustomEventEmitter(function(emitter) {
        this.emit('renameTrigger', null)
        emitter.emit('success')
      }).run()
    }
  }

  QueryInterface.prototype.createFunction = function(functionName, params, returnType, language, body, options) {
    var  sql = this.QueryGenerator.createFunction(functionName, params, returnType, language, body, options)
    if (sql){
      return queryAndEmit.call(this, sql, 'createFunction')
    } else {
      return new Utils.CustomEventEmitter(function(emitter) {
        this.emit('createFunction', null)
        emitter.emit('success')
      }).run()
    }
  }

  QueryInterface.prototype.dropFunction = function(functionName, params) {
    var  sql = this.QueryGenerator.dropFunction(functionName, params)
    if (sql){
      return queryAndEmit.call(this, sql, 'dropFunction')
    } else {
      return new Utils.CustomEventEmitter(function(emitter) {
        this.emit('dropFunction', null)
        emitter.emit('success')
      }).run()
    }
  }

  QueryInterface.prototype.renameFunction = function(oldFunctionName, params, newFunctionName) {
    var  sql = this.QueryGenerator.renameFunction(oldFunctionName, params, newFunctionName)
    if (sql){
      return queryAndEmit.call(this, sql, 'renameFunction')
    } else {
      return new Utils.CustomEventEmitter(function(emitter) {
        this.emit('renameFunction', null)
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

  QueryInterface.prototype.setAutocommit = function(transaction, value) {
    if (!transaction || !(transaction instanceof Transaction)) {
      throw new Error('Unable to set autocommit for a transaction without transaction object!')
    }

    var sql = this.QueryGenerator.setAutocommitQuery(value)
    return this.queryAndEmit([sql, null, { transaction: transaction }], 'setAutocommit')
  }

  QueryInterface.prototype.setIsolationLevel = function(transaction, value) {
    if (!transaction || !(transaction instanceof Transaction)) {
      throw new Error('Unable to set isolation level for a transaction without transaction object!')
    }

    var sql = this.QueryGenerator.setIsolationLevelQuery(value)
    return this.queryAndEmit([sql, null, { transaction: transaction }], 'setIsolationLevel')
  }

  QueryInterface.prototype.startTransaction = function(transaction, options) {
    if (!transaction || !(transaction instanceof Transaction)) {
      throw new Error('Unable to start a transaction without transaction object!')
    }

    options = Utils._.extend({
      transaction: transaction
    }, options || {})

    var sql = this.QueryGenerator.startTransactionQuery(options)
    return this.queryAndEmit([sql, null, options], 'startTransaction')
  }

  QueryInterface.prototype.commitTransaction = function(transaction, options) {
    if (!transaction || !(transaction instanceof Transaction)) {
      throw new Error('Unable to commit a transaction without transaction object!')
    }

    options = Utils._.extend({
      transaction: transaction
    }, options || {})

    var sql = this.QueryGenerator.commitTransactionQuery(options)
    return this.queryAndEmit([sql, null, options], 'commitTransaction')
  }

  QueryInterface.prototype.rollbackTransaction = function(transaction, options) {
    if (!transaction || !(transaction instanceof Transaction)) {
      throw new Error('Unable to rollback a transaction without transaction object!')
    }

    options = Utils._.extend({
      transaction: transaction
    }, options || {})

    var sql = this.QueryGenerator.rollbackTransactionQuery(options)
    return this.queryAndEmit([sql, null, options], 'rollbackTransaction')
  }

  // private

  var buildScope = function() {
    var smart

    // Use smartWhere to convert several {where} objects into a single where object
    smart = Utils.smartWhere(this.scopeObj.where || [], this.daoFactoryManager.sequelize.options.dialect)
    smart = Utils.compileSmartWhere.call(this, smart, this.daoFactoryManager.sequelize.options.dialect)
    return {limit: this.scopeObj.limit || null, offset: this.scopeObj.offset || null, where: smart, order: (this.scopeObj.order || []).join(', ')}
  }

  var queryAndEmit = QueryInterface.prototype.queryAndEmit = function(sqlOrQueryParams, methodName, options, emitter) {
    options = Utils._.extend({
      success:     function(){},
      error:       function(){},
      transaction: null,
      logging:     this.sequelize.options.logging
    }, options || {})

    var execQuery = function(emitter) {

      if (Array.isArray(sqlOrQueryParams)) {
        if (sqlOrQueryParams.length === 1) {
          sqlOrQueryParams.push(null)
        }

        if (sqlOrQueryParams.length === 2) {
          sqlOrQueryParams.push(typeof options === "object" ? options : {})
        }

        emitter.query = this.sequelize.query.apply(this.sequelize, sqlOrQueryParams)
      } else {
        emitter.query = this.sequelize.query(sqlOrQueryParams, null, options)
      }

      emitter
        .query
        .success(function(obj) {
          if (options.success) {
            options.success(obj)
          }
          this.emit(methodName, null)
          emitter.emit('success', obj)
        }.bind(this))
        .error(function(err) {
          if (options.error) {
            options.error(err)
          }
          this.emit(methodName, err)
          emitter.emit('error', err)
        }.bind(this))
        .on('sql', function(sql) {
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
