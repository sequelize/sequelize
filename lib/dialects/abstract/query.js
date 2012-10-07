var Utils              = require('../../utils')
  , CustomEventEmitter = require("../../emitters/custom-event-emitter")

module.exports = (function() {
  var AbstractQuery = function(database, sequelize, callee, options) {}

  /**
    Inherit from CustomEventEmitter
  */
  Utils.inherit(AbstractQuery, CustomEventEmitter)

  /**
   * Execute the passed sql query.
   *
   * Examples:
   *
   *     query.run('SELECT 1')
   *
   * @param {String} sql - The SQL query which should be executed.
   * @api public
   */
  AbstractQuery.prototype.run = function(sql) {
    throw new Error("The run method wasn't overwritten!")
  }

  /**
   * Check the logging option of the instance and print deprecation warnings.
   *
   * @return {void}
   */
  AbstractQuery.prototype.checkLoggingOption = function() {
    if(this.options.logging === true) {
      console.log('DEPRECATION WARNING: The logging-option should be either a function or false. Default: console.log')
      this.options.logging = console.log
    }

    if(this.options.logging == console.log) {
      // using just console.log will break in node < 0.6
      this.options.logging = function(s) { console.log(s) }
    }
  }

  /**
   * High level function that handles the results of a query execution.
   *
   *
   * Example:
   *  query.formatResults([
   *    {
   *      UserWithNames: {
   *        name: 'barfooz',
   *        id: 1,
   *        createdAt: Sat Oct 06 2012 14:46:36 GMT+0200 (CEST),
   *        updatedAt: Sat Oct 06 2012 14:46:36 GMT+0200 (CEST)
   *      },
   *      Tasks: {
   *        title: 'task',
   *        id: 1,
   *        createdAt: Sat Oct 06 2012 14:46:36 GMT+0200 (CEST),
   *        updatedAt: Sat Oct 06 2012 14:46:36 GMT+0200 (CEST),
   *        UserWithNameId: 1
   *      }
   *    }
   *  ])
   *
   * @param {Array} data - The result of the query execution.
   */
  AbstractQuery.prototype.formatResults = function(data) {
    var result  = this.callee

    if (isInsertQuery.call(this, data)) {
      handleInsertQuery.call(this, data)
    }

    if (isSelectQuery.call(this)) {
      result = handleSelectQuery.call(this, data)
    } else if (isShowTableQuery.call(this)) {
      result = handleShowTableQuery.call(this, data)
    } else if (isShowOrDescribeQuery.call(this)) {
      result = data
    }

    return result
  }

  /**
    Shortcut methods (success, ok) for listening for success events.

    Params:
      - fct: A function that gets executed once the *success* event was triggered.

    Result:
      The function returns the instance of the query.
  */
  AbstractQuery.prototype.success =
  AbstractQuery.prototype.ok =
  function(fct) {
    this.on('success', fct)
    return this
  }

  /**
    Shortcut methods (failure, fail, error) for listening for error events.

    Params:
      - fct: A function that gets executed once the *error* event was triggered.

    Result:
      The function returns the instance of the query.
  */
  AbstractQuery.prototype.failure =
  AbstractQuery.prototype.fail =
  AbstractQuery.prototype.error =
  function(fct) {
    this.on('error', fct)
    return this
  }

  /////////////
  // private //
  /////////////

  var queryResultHasJoin = function(results) {
    var hasJoin = !!results[0]

    hasJoin = hasJoin && (Utils._.keys(results[0]).length > 1)
    hasJoin = hasJoin && (Utils.isHash(results[0][Utils._.keys(results[0])[0]]))

    return hasJoin
  }

  var isInsertQuery = function(results) {
    var result = !!this.callee

    result = result && (this.sql.indexOf('INSERT INTO') === 0)
    result = result && results.hasOwnProperty('insertId')

    return result
  }

  var handleInsertQuery = function(results) {
    // add the inserted row id to the instance
    var autoIncrementField = this.callee.__factory.autoIncrementField
    this.callee[autoIncrementField] = results.insertId
  }

  var isShowTableQuery = function() {
    return (this.sql.indexOf('SHOW TABLES') === 0)
  }

  var handleShowTableQuery = function(results) {
    return Utils._.flatten(results.map(function(resultSet) {
      return Utils._.values(resultSet)
    }))
  }

  var isSelectQuery = function() {
    return (this.sql.indexOf('SELECT') === 0)
  }

  var handleSelectQuery = function(results) {
    var result = null

    if (this.options.raw) {
      result = results
    } else if (queryResultHasJoin(results)) {
      result = groupDataByCalleeFactory.call(this, results).map(function(result) {
        // let's build the actual dao instance first...
        var dao = this.callee.build(result[this.callee.tableName], { isNewRecord: false })

        // ... and afterwards the prefetched associations
        for (var tableName in result) {
          if (result.hasOwnProperty(tableName) && (tableName !== this.callee.tableName)) {
            buildAssociatedDaoInstances.call(this, tableName, result[tableName], dao)
          }
        }

        return dao
      }.bind(this))
    } else {
      result = results.map(function(result) {
        return this.callee.build(result, { isNewRecord: false })
      }.bind(this))
    }

    // return the first real model instance if options.plain is set (e.g. Model.find)
    if(this.options.plain) {
      result = (result.length === 0) ? null : result[0]
    }

    return result
  }

  var buildAssociatedDaoInstances = function(tableName, associationData, dao) {
    var associatedDao = this.sequelize.daoFactoryManager.getDAO(tableName, { attribute: 'tableName' })
      , association   = this.callee.getAssociation(associatedDao)
      , accessor      = Utils._.camelize(associatedDao.tableName)

    // downcase the first char
    accessor = accessor.slice(0,1).toLowerCase() + accessor.slice(1)

    associationData.forEach(function(data) {
      var daoInstance = associatedDao.build(data, { isNewRecord: false })

      if (['BelongsTo', 'HasOne'].indexOf(association.associationType) > -1) {
        accessor = Utils.singularize(accessor)
        dao[accessor] = daoInstance
      } else {
        dao[accessor] = dao[accessor] || []
        dao[accessor].push(daoInstance)
      }
    })
  }

  var isShowOrDescribeQuery = function() {
    return (this.sql.indexOf('SHOW') === 0) || (this.sql.indexOf('DESCRIBE') === 0)
  }


  /**
    The function takes the result of the query execution and groups
    the associated data by the callee.

    Example:
      groupDataByCalleeFactory([
        {
          callee: { some: 'data', id: 1 },
          association: { foo: 'bar', id: 1 }
        }, {
          callee: { some: 'data', id: 1 },
          association: { foo: 'bar', id: 2 }
        }, {
          callee: { some: 'data', id: 1 },
          association: { foo: 'bar', id: 3 }
        }
      ])

    Result:
      Something like this:

      [
        {
          callee:  { some: 'data', id: 1 },
          association: [
            { foo: 'bar', id: 1 },
            { foo: 'bar', id: 2 },
            { foo: 'bar', id: 3 }
          ]
        }
      ]
  */
  var groupDataByCalleeFactory = function(data) {
    var result          = []
      , calleeTableName = this.callee.tableName

    data.forEach(function(row) {
      var calleeData    = row[calleeTableName]
        , existingEntry = result.filter(function(groupedRow) {
            return Utils._.isEqual(groupedRow[calleeTableName], calleeData)
          })[0]

      if (!existingEntry) {
        existingEntry = {}
        result.push(existingEntry)
        existingEntry[calleeTableName] = calleeData
      }

      for (var attrName in row) {
        if (row.hasOwnProperty(attrName) && (attrName !== calleeTableName)) {
          existingEntry[attrName] = existingEntry[attrName] || []
          existingEntry[attrName].push(row[attrName])
        }
      }
    })

    return result
  }

  return AbstractQuery
})()
