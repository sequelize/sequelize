var Utils              = require('../../utils')
  , CustomEventEmitter = require("../../emitters/custom-event-emitter")
  , Dot                = require('dottie')
  , _                  = require('lodash')

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
    if (this.options.logging === true) {
      console.log('DEPRECATION WARNING: The logging-option should be either a function or false. Default: console.log')
      this.options.logging = console.log
    }

    if (this.options.logging === console.log) {
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
   *      id: 1,              // this is from the main table
   *      attr2: 'snafu',     // this is from the main table
   *      Tasks.id: 1,        // this is from the associated table
   *      Tasks.title: 'task' // this is from the associated table
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

      if (this.sql.toLowerCase().indexOf('describe') === 0) {
        result = {}

        data.forEach(function(_result) {
          result[_result.Field] = {
            type:         _result.Type.toUpperCase(),
            allowNull:    (_result.Null === 'YES'),
            defaultValue: _result.Default
          }
        })
      } else if (this.sql.toLowerCase().indexOf('show index from') === 0) {
        result = Utils._.uniq(result.map(function(result) {
          return {
            name:       result.Key_name,
            tableName:  result.Table,
            unique:     (result.Non_unique !== 1)
          }
        }), false, function(row) {
          return row.name
        })
      }
    } else if (isCallQuery.call(this)) {
      result = data[0]
    }

    return result
  }

  /**
   * This function is a wrapper for private methods.
   *
   * @param {String} fctName The name of the private method.
   *
   */
  AbstractQuery.prototype.send = function(fctName/*, arg1, arg2, arg3, ...*/) {
    var args = Array.prototype.slice.call(arguments).slice(1)
    return eval(fctName).apply(this, args)
  }

  /**
   * Get the attributes of an insert query, which contains the just inserted id.
   *
   * @return {String} The field name.
   */
  AbstractQuery.prototype.getInsertIdField = function() {
    return 'insertId'
  }

  /////////////
  // private //
  /////////////

  /**
   * Iterate over all known tables and search their names inside the sql query.
   * This method will also check association aliases ('as' option).
   *
   * @param  {String} attribute An attribute of a SQL query. (?)
   * @return {String}           The found tableName / alias.
   */
  var findTableNameInAttribute = function(attribute) {
    if (!this.options.include) {
      return null
    }
    if (!this.options.includeNames) {
      this.options.includeNames = this.options.include.map(function(include) {
        return include.as
      })
    }

    var tableNames = this.options.includeNames.filter(function(include) {
      return attribute.indexOf(include + '.') === 0
    })

    if (tableNames.length === 1) {
      return tableNames[0]
    } else {
      return null
    }
  }

  var isInsertQuery = function(results, metaData) {
    var result = true

    // is insert query if sql contains insert into
    result = result && (this.sql.toLowerCase().indexOf('insert into') === 0)

    // is insert query if no results are passed or if the result has the inserted id
    result = result && (!results || results.hasOwnProperty(this.getInsertIdField()))

    // is insert query if no metadata are passed or if the metadata has the inserted id
    result = result && (!metaData || metaData.hasOwnProperty(this.getInsertIdField()))

    return result
  }

  var handleInsertQuery = function(results, metaData) {
    if (this.callee) {
      // add the inserted row id to the instance
      var autoIncrementField = this.callee.__factory.autoIncrementField
        , id                 = null

      id = id || (results && results[this.getInsertIdField()])
      id = id || (metaData && metaData[this.getInsertIdField()])

      this.callee[autoIncrementField] = id
    }
  }

  var isShowTableQuery = function() {
    return (this.sql.toLowerCase().indexOf('show tables') === 0)
  }

  var handleShowTableQuery = function(results) {
    return Utils._.flatten(results.map(function(resultSet) {
      return Utils._.values(resultSet)
    }))
  }

  var isSelectQuery = function() {
    return this.options.type === 'SELECT';
  }

  var isUpdateQuery = function() {
    return (this.sql.toLowerCase().indexOf('update') === 0)
  }

  var handleSelectQuery = function(results) {
    var result = null

    // Raw queries
    if (this.options.raw) {
      result = results.map(function(result) {
        var o = {}

        for (var key in result) {
          if (result.hasOwnProperty(key)) {
            o[key] = result[key]
          }
        }

        return o
      })

      result = result.map(Dot.transform)

    // Queries with include
    } else if (this.options.hasJoin === true) {
      this.options.includeNames = this.options.include.map(function (include) {
          return include.as
      })
      results = groupJoinData.call(this, results)
      result = results.map(function(result) {
        return this.callee.build(result, {
          isNewRecord: false,
          isDirty: false,
          include:this.options.include,
          includeNames: this.options.includeNames,
          includeValidated: true
        })
      }.bind(this))
    } else if (this.options.hasJoinTableModel === true) {
      result = results.map(function(result) {
        result = Dot.transform(result)

        var joinTableData = result[this.options.joinTableModel.name]
          , joinTableDAO = this.options.joinTableModel.build(joinTableData, { isNewRecord: false, isDirty: false })
          , mainDao

        delete result[this.options.joinTableModel.name]

        mainDao = this.callee.build(result, { isNewRecord: false, isDirty: false })
        mainDao[this.options.joinTableModel.name] = joinTableDAO

        return mainDao
      }.bind(this))

    // Regular queries
    } else {
      result = results.map(function(result) {
        return this.callee.build(result, { isNewRecord: false, isDirty: false })
      }.bind(this))
    }

    // return the first real model instance if options.plain is set (e.g. Model.find)
    if (this.options.plain) {
      result = (result.length === 0) ? null : result[0]
    }

    return result
  }

  var isShowOrDescribeQuery = function() {
    var result = false

    result = result || (this.sql.toLowerCase().indexOf('show') === 0)
    result = result || (this.sql.toLowerCase().indexOf('describe') === 0)

    return  result
  }

  var isCallQuery = function() {
    var result = false

    result = result || (this.sql.toLowerCase().indexOf('call') === 0)

    return result
  }


  /**
    The function takes the result of the query execution and groups
    the associated data by the callee.

    Example:
      groupJoinData([
        {
          some: 'data',
          id: 1,
          association: { foo: 'bar', id: 1 }
        }, {
          some: 'data',
          id: 1,
          association: { foo: 'bar', id: 2 }
        }, {
          some: 'data',
          id: 1,
          association: { foo: 'bar', id: 3 }
        }
      ])

    Result:
      Something like this:

      [
        {
          some: 'data',
          id: 1,
          association: [
            { foo: 'bar', id: 1 },
            { foo: 'bar', id: 2 },
            { foo: 'bar', id: 3 }
          ]
        }
      ]
  */

  var groupJoinData = function(data) {
    var self = this
      , results = []
      , existingResult
      , calleeData

    data.forEach(function (row) {
      row = Dot.transform(row)
      calleeData = _.omit(row, self.options.includeNames)

      existingResult = _.find(results, function (result) {
        return Utils._.isEqual(_.omit(result, self.options.includeNames), calleeData)
      })

      if (!existingResult) {
        results.push(existingResult = calleeData)
      }

      for (var attrName in row) {
        if (row.hasOwnProperty(attrName) && Object(row[attrName]) === row[attrName] && self.options.includeNames.indexOf(attrName) !== -1) {
          existingResult[attrName] = existingResult[attrName] || []
          var attrRowExists = existingResult[attrName].some(function(attrRow) {
            return Utils._.isEqual(attrRow, row[attrName])
          })
          if (!attrRowExists) {
            existingResult[attrName].push(row[attrName])
          }
        }
      }      
    })
    return results
  }

  return AbstractQuery
})()
