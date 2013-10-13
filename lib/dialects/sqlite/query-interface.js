var Utils = require("../../utils")

/**
 Returns an object that treats SQLite's inabilities to do certain queries.

 @class QueryInterface
 @static
 */
var QueryInterface = module.exports = {
  /**
    A wrapper that fixes SQLite's inability to remove columns from existing tables.
    It will create a backup of the table, drop the table afterwards and create a
    new table with the same name but without the obsolete column.

    @method removeColumn
    @for    QueryInterface

    @param  {String} tableName     The name of the table.
    @param  {String} attributeName The name of the attribute that we want to remove.
    @param  {CustomEventEmitter} emitter       The EventEmitter from outside.
    @param  {Function} queryAndEmit  The function from outside that triggers some events to get triggered.

    @since 1.6.0
   */
  removeColumn: function(tableName, attributeName, emitter, queryAndEmit) {
    this.describeTable(tableName).complete(function(err, fields) {
      if (err) {
        emitter.emit('error', err)
      } else {
        delete fields[attributeName]

        var sql        = this.QueryGenerator.removeColumnQuery(tableName, fields)
          , subQueries = sql.split(';').filter(function(q) { return q !== '' })

        QueryInterface.execMultiQuery.call(this, subQueries, 'removeColumn', emitter, queryAndEmit)
      }
    }.bind(this))
  },

  /**
    A wrapper that fixes SQLite's inability to change columns from existing tables.
    It will create a backup of the table, drop the table afterwards and create a
    new table with the same name but with a modified version of the respective column.

    @method changeColumn
    @for    QueryInterface

    @param  {String} tableName The name of the table.
    @param  {Object} attributes An object with the attribute's name as key and it's options as value object.
    @param  {CustomEventEmitter} emitter The EventEmitter from outside.
    @param  {Function} queryAndEmit The function from outside that triggers some events to get triggered.

    @since 1.6.0
   */
  changeColumn: function(tableName, attributes, emitter, queryAndEmit) {
    var attributeName = Utils._.keys(attributes)[0]

    this.describeTable(tableName).complete(function(err, fields) {
      if (err) {
        emitter.emit('error', err)
      } else {
        fields[attributeName] = attributes[attributeName]

        var sql        = this.QueryGenerator.removeColumnQuery(tableName, fields)
          , subQueries = sql.split(';').filter(function(q) { return q !== '' })

        QueryInterface.execMultiQuery.call(this, subQueries, 'changeColumn', emitter, queryAndEmit)
      }
    }.bind(this))
  },

  /**
    A wrapper that fixes SQLite's inability to rename columns from existing tables.
    It will create a backup of the table, drop the table afterwards and create a
    new table with the same name but with a renamed version of the respective column.

    @method renameColumn
    @for    QueryInterface

    @param  {String} tableName The name of the table.
    @param  {String} attrNameBefore The name of the attribute before it was renamed.
    @param  {String} attrNameAfter The name of the attribute after it was renamed.
    @param  {CustomEventEmitter} emitter The EventEmitter from outside.
    @param  {Function} queryAndEmit The function from outside that triggers some events to get triggered.

    @since 1.6.0
   */
  renameColumn: function(tableName, attrNameBefore, attrNameAfter, emitter, queryAndEmit) {
    this.describeTable(tableName).complete(function(err, fields) {
      if (err) {
        emitter.emit('error', err)
      } else {
        fields[attrNameAfter] = Utils._.clone(fields[attrNameBefore])
        delete fields[attrNameBefore]

        var sql        = this.QueryGenerator.renameColumnQuery(tableName, attrNameBefore, attrNameAfter, fields)
          , subQueries = sql.split(';').filter(function(q) { return q !== '' })

        QueryInterface.execMultiQuery.call(this, subQueries, 'renameColumn', emitter, queryAndEmit)
      }
    }.bind(this))
  },

  execMultiQuery: function(queries, methodName, emitter, queryAndEmit) {
    var chainer = new Utils.QueryChainer()

    queries.splice(0, queries.length - 1).forEach(function(query) {
      chainer.add(this.sequelize, 'query', [query + ";", null, { raw: true }])
    }.bind(this))

    chainer
      .runSerially()
      .complete(function(err) {
        if (err) {
          emitter.emit(methodName, err)
          emitter.emit('error', err)
        } else {
          queryAndEmit.call(this, queries.splice(queries.length - 1)[0], methodName, {}, emitter)
        }
      }.bind(this))
  },

  dropAllTables: function() {
    var self = this

   return new Utils.CustomEventEmitter(function(dropAllTablesEmitter) {
      var events  = []
        , chainer = new Utils.QueryChainer()
        , onError = function(err) {
            self.emit('dropAllTables', err)
            dropAllTablesEmitter.emit('error', err)
          }

      self
        .showAllTables()
        .error(onError)
        .success(function(tableNames) {
          self
            .sequelize
            .query('PRAGMA foreign_keys;')
            .proxy(dropAllTablesEmitter, { events: ['sql'] })
            .error(onError)
            .success(function(result) {
              var foreignKeysAreEnabled = result.foreign_keys === 1

              if (foreignKeysAreEnabled) {
                var queries = []

                queries.push('PRAGMA foreign_keys = OFF')

                tableNames.forEach(function(tableName) {
                  queries.push(self.QueryGenerator.dropTableQuery(tableName).replace(';', ''))
                })

                queries.push('PRAGMA foreign_keys = ON')

                QueryInterface.execMultiQuery.call(self, queries, 'dropAllTables', dropAllTablesEmitter, self.queryAndEmit)
              } else {
                // add the table removal query to the chainer
                tableNames.forEach(function(tableName) {
                  chainer.add(self, 'dropTable', [ tableName, { cascade: true } ])
                })

                chainer
                  .runSerially()
                  .proxy(dropAllTablesEmitter, { events: ['sql'] })
                  .error(onError)
                  .success(function() {
                    self.emit('dropAllTables', null)
                    dropAllTablesEmitter.emit('success', null)
                  })
              }
            })
        })
    }).run()
  }
}
