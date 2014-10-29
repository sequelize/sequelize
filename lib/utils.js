var util               = require("util")
  , DataTypes          = require("./data-types")
  , SqlString          = require("./sql-string")
  , lodash             = require("lodash")
  , _string            = require('underscore.string')
  , ParameterValidator = require('./utils/parameter-validator')
  , uuid               = require('node-uuid')

var Utils = module.exports = {
  _: (function() {
    var _  = lodash.cloneDeep(lodash)
      , _s = _string

    _.mixin(_s.exports())
    _.mixin({
      includes: _s.include,
      camelizeIf: function(string, condition) {
        var result = string

        if (condition) {
          result = _.camelize(string)
        }

        return result
      },
      underscoredIf: function(string, condition) {
        var result = string

        if (condition) {
          result = _.underscored(string)
        }

        return result
      },
      /*
       * Returns an array with some falsy values removed. The values null, "", undefined and NaN are considered falsey.
       */
      compactLite: function(array) {
        var index = -1,
          length = array ? array.length : 0,
          result = [];

        while (++index < length) {
          var value = array[index];
          if (typeof value === "boolean" || value === 0 || value) {
            result.push(value);
          }
        }
        return result;
      }
    })

    return _
  })(),
  addEventEmitter: function(_class) {
    util.inherits(_class, require('events').EventEmitter)
  },
  format: function(arr, dialect) {
    var timeZone = null;
    // Make a clone of the array beacuse format modifies the passed args
    return SqlString.format(arr[0], arr.slice(1), timeZone, dialect)
  },
  formatNamedParameters: function(sql, parameters, dialect) {
    var timeZone = null;
    return SqlString.formatNamedParameters(sql, parameters, timeZone, dialect)
  },
  injectScope: function(scope, merge) {
    var self = this

    scope = scope || {}
    self.scopeObj = self.scopeObj || {}

    if (Array.isArray(scope.where)) {
      self.scopeObj.where = self.scopeObj.where || []
      self.scopeObj.where.push(scope.where)
      return true
    }

    if (typeof scope.order === "string") {
      self.scopeObj.order = self.scopeObj.order || []
      self.scopeObj.order[self.scopeObj.order.length] = scope.order
    }

    // Limit and offset are *always* merged.
    if (!!scope.limit) {
      self.scopeObj.limit = scope.limit
    }

    if (!!scope.offset) {
      self.scopeObj.offset = scope.offset
    }

    // Where objects are a mixed variable. Possible values are arrays, strings, and objects
    if (!!scope.where) {
      // Begin building our scopeObj
      self.scopeObj.where = self.scopeObj.where || []

      // Reset if we're merging!
      if (merge === true && !!scope.where && !!self.scopeObj.where) {
        var scopeKeys = Object.keys(scope.where)
        self.scopeObj.where = self.scopeObj.where.map(function(scopeObj) {
          if (!Array.isArray(scopeObj) && typeof scopeObj === "object") {
            return lodash.omit.apply(undefined, [scopeObj].concat(scopeKeys))
          } else {
            return scopeObj
          }
        }).filter(function(scopeObj) {
          return !lodash.isEmpty(scopeObj)
        })
        self.scopeObj.where = self.scopeObj.where.concat(scope.where)
      }

      if (Array.isArray(scope.where)) {
        self.scopeObj.where.push(scope.where)
      }
      else if (typeof scope.where === "object") {
        Object.keys(scope.where).forEach(function(){
          self.scopeObj.where.push(scope.where)
        })
      } else { // Assume the value is a string
        self.scopeObj.where.push([scope.where])
      }
    }

    if (!!self.scopeObj.where) {
      self.scopeObj.where = lodash.uniq(self.scopeObj.where)
    }
  },
  // smartWhere can accept an array of {where} objects, or a single {where} object.
  // The smartWhere function breaks down the collection of where objects into a more
  // centralized object for each column so we can avoid duplicates
  // e.g. WHERE username='dan' AND username='dan' becomes WHERE username='dan'
  // All of the INs, NOT INs, BETWEENS, etc. are compressed into one key for each column
  // This function will hopefully provide more functionality to sequelize in the future.
  // tl;dr It's a nice way to dissect a collection of where objects and compress them into one object
  smartWhere: function(whereArg, dialect) {
    var self = this
      , _where = {}
      , logic
      , type

    (Array.isArray(whereArg) ? whereArg : [whereArg]).forEach(function(where) {
      // If it's an array we're already good... / it's in a format that can't be broken down further
      // e.g. Util.format['SELECT * FROM world WHERE status=?', 'hello']
      if (Array.isArray(where)) {
        _where._ = where._ || {queries: [], bindings: []}
        _where._.queries[_where._.queries.length] = where[0]
        if (where.length > 1) {
          var values = where.splice(1)
          if (dialect === "sqlite") {
            values.forEach(function(v, i) {
              if (typeof v === "boolean") {
                values[i] = (v === true ? 1 : 0)
              }
            })
          }
          _where._.bindings = _where._.bindings.concat(values)
        }
      }
      else if (typeof where === "object") {
        // First iteration is trying to compress IN and NOT IN as much as possible...
        // .. reason being is that WHERE username IN (?) AND username IN (?) != WHERE username IN (?,?)
        Object.keys(where).forEach(function(i) {
          if (Array.isArray(where[i])) {
            where[i] = {
              in: where[i]
            }
          }
        })

        // Build our smart object
        Object.keys(where).forEach(function(i) {
          type = typeof where[i]
          _where[i] = _where[i] || {}

          if (where[i] === null) {
            // skip nulls
          }
          else if (Array.isArray(where[i])) {
            _where[i].in = _where[i].in || []
            _where[i].in.concat(where[i])
          }
          else if (Utils.isHash(where[i])) {
            Object.keys(where[i]).forEach(function(ii) {
              logic = self.getWhereLogic(ii, where[i][ii]);

              switch(logic) {
              case 'IN':
                _where[i].in = _where[i].in || []
                _where[i].in = _where[i].in.concat(where[i][ii]);
                break
              case 'NOT':
                _where[i].not = _where[i].not || []
                _where[i].not = _where[i].not.concat(where[i][ii]);
                break
              case 'BETWEEN':
                _where[i].between = _where[i].between || []
                _where[i].between[_where[i].between.length] = [where[i][ii][0], where[i][ii][1]]
                break
              case 'NOT BETWEEN':
                _where[i].nbetween = _where[i].nbetween || []
                _where[i].nbetween[_where[i].nbetween.length] = [where[i][ii][0], where[i][ii][1]]
                break
              case 'JOIN':
                _where[i].joined = _where[i].joined || []
                _where[i].joined[_where[i].joined.length] = where[i][ii]
                break
              default:
                _where[i].lazy = _where[i].lazy || {conditions: [], bindings: []}
                _where[i].lazy.conditions[_where[i].lazy.conditions.length] = logic + ' ?'
                _where[i].lazy.bindings = _where[i].lazy.bindings.concat(where[i][ii])
              }
            })
          }
          else if (type === "string" || type === "number" || type === "boolean" || Buffer.isBuffer(where[i])) {
            _where[i].lazy = _where[i].lazy || {conditions: [], bindings: []}
            if (type === "boolean") {
              _where[i].lazy.conditions[_where[i].lazy.conditions.length] = '= ' + SqlString.escape(where[i], false, null, dialect) // sqlite is special
            } else {
              _where[i].lazy.conditions[_where[i].lazy.conditions.length] = '= ?'
              _where[i].lazy.bindings = _where[i].lazy.bindings.concat(where[i])
            }
          }
        })
      }
    })

    return _where
  },
  // Converts {smart where} object(s) into an array that's friendly for Utils.format()
  // NOTE: Must be applied/called from the QueryInterface
  compileSmartWhere: function(obj, dialect) {
    var self = this
      , whereArgs = []
      , text = []
      , columnName

    if (typeof obj !== "object") {
      return obj
    }

    for (var column in obj) {
      if (column === "_") {
        text[text.length] = obj[column].queries.join(' AND ')
        if (obj[column].bindings.length > 0) {
          whereArgs = whereArgs.concat(obj[column].bindings)
        }
      } else {
        Object.keys(obj[column]).forEach(function(condition) {
          columnName = self.QueryInterface.quoteIdentifiers(column)
          switch(condition) {
          case 'in':
            text[text.length] = columnName + ' IN (' + obj[column][condition].map(function(){ return '?' }) + ')'
            whereArgs = whereArgs.concat(obj[column][condition])
            break
          case 'not':
            text[text.length] = columnName + ' NOT IN (' + obj[column][condition].map(function(){ return '?' }) + ')'
            whereArgs = whereArgs.concat(obj[column][condition])
            break
          case 'between':
            Object.keys(obj[column][condition]).forEach(function(row) {
              text[text.length] = columnName + ' BETWEEN ? AND ?'
              whereArgs = whereArgs.concat(obj[column][condition][row][0], obj[column][condition][row][1])
            })
            break
          case 'nbetween':
            Object.keys(obj[column][condition]).forEach(function(row) {
              text[text.length] = columnName + ' BETWEEN ? AND ?'
              whereArgs = whereArgs.concat(obj[column][condition][row][0], obj[column][condition][row][1])
            })
            break
          case 'joined':
            Object.keys(obj[column][condition]).forEach(function(row) {
              text[text.length] = columnName + ' = ' + self.QueryInterface.quoteIdentifiers(obj[column][condition][row])
            })
            break
          default: // lazy
            text = text.concat(obj[column].lazy.conditions.map(function(val){ return columnName + ' ' + val }))
            whereArgs = whereArgs.concat(obj[column].lazy.bindings)
          }
        })
      }
    }

    return Utils._.compactLite([text.join(' AND ')].concat(whereArgs))
  },
  getWhereLogic: function(logic, val) {
    switch (logic) {
    case 'join':
      return 'JOIN'
    case 'gte':
      return '>='
    case 'gt':
      return '>'
    case 'lte':
      return '<='
    case 'lt':
      return '<'
    case 'eq':
      return '='
    case 'ne':
      return val === null ? 'IS NOT' : '!='
    case 'between':
    case '..':
      return 'BETWEEN'
    case 'nbetween':
    case 'notbetween':
    case '!..':
      return 'NOT BETWEEN'
    case 'in':
      return 'IN'
    case 'not':
      return 'NOT IN'
    case 'like':
      return 'LIKE'
    case 'rlike':
      return 'RLIKE'
    case 'ilike':
      return 'ILIKE'
    case 'nlike':
    case 'notlike':
      return 'NOT LIKE'
    default:
      return ''
    }
  },
  isHash: function(obj) {
    return Utils._.isObject(obj) && !Array.isArray(obj) && !Buffer.isBuffer(obj);
  },
  hasChanged: function(attrValue, value) {
    //If attribute value is Date, check value as a date
    if (Utils._.isDate(attrValue) && !Utils._.isDate(value)) {
      value = new Date(value)
    }

    if (Utils._.isDate(attrValue)) {
      return attrValue.valueOf() !== value.valueOf()
    }

    //If both of them are empty, don't set as changed
    if ((attrValue === undefined || attrValue === null || attrValue === '') && (value === undefined || value === null || value === '')) {
      return false
    }

    return attrValue !== value
  },
  argsArePrimaryKeys: function(args, primaryKeys) {
    var result = (args.length == Object.keys(primaryKeys).length)
    if (result) {
      Utils._.each(args, function(arg) {
        if (result) {
          if (['number', 'string'].indexOf(typeof arg) !== -1) {
            result = true
          } else {
            result = (arg instanceof Date) || Buffer.isBuffer(arg);
          }
        }
      })
    }
    return result
  },
  combineTableNames: function(tableName1, tableName2) {
    return (tableName1.toLowerCase() < tableName2.toLowerCase()) ? (tableName1 + tableName2) : (tableName2 + tableName1)
  },

  singularize: function(s, language) {
    return Utils.Lingo[language || 'en'].isSingular(s) ? s : Utils.Lingo[language || 'en'].singularize(s)
  },

  pluralize: function(s, language) {
    return Utils.Lingo[language || 'en'].isPlural(s) ? s : Utils.Lingo[language || 'en'].pluralize(s)
  },

  removeCommentsFromFunctionString: function(s) {
    s = s.replace(/\s*(\/\/.*)/g, '')
    s = s.replace(/(\/\*[\n\r\s\S]*?\*\/)/mg, '')

    return s
  },

  toDefaultValue: function(value) {
    if (lodash.isFunction(value)) {
      return value()
    } else if (value === DataTypes.UUIDV1) {
      return uuid.v1()
    } else if (value === DataTypes.UUIDV4) {
      return uuid.v4()
    } else if (value === DataTypes.NOW) {
      return Utils.now()
    } else {
      return value
    }
  },

  /**
   * Determine if the default value provided exists and can be described
   * in a db schema using the DEFAULT directive.
   *
   * @param  {*} value Any default value.
   * @return {boolean} yes / no.
   */
  defaultValueSchemable: function(value) {
    if (typeof value === 'undefined') {return false}

    // TODO this will be schemable when all supported db
    // have been normalized for this case
    if (value === DataTypes.NOW) {return false}

    if (value === DataTypes.UUIDV1 || value === DataTypes.UUIDV4) {return false}

    if (lodash.isFunction(value)) {
      return false
    }

    return true
  },

  setAttributes: function(hash, identifier, instance, prefix) {
    prefix = prefix || ''
    if (this.isHash(identifier)) {
      this._.each(identifier, function(elem, key) {
        hash[prefix + key] = Utils._.isString(instance) ? instance : Utils._.isObject(instance) ? instance[elem.key || elem] : null
      })
    } else {
      hash[prefix + identifier] = Utils._.isString(instance) ? instance : Utils._.isObject(instance) ? instance.id : null
    }

    return hash
  },

  removeNullValuesFromHash: function(hash, omitNull, options) {
    var result = hash

    options = options || {}
    options.allowNull = options.allowNull || []

    if (omitNull) {
      var _hash = {}

      Utils._.each(hash, function(val, key) {
        if (options.allowNull.indexOf(key) > -1 || key.match(/Id$/) || ((val !== null) && (val !== undefined))) {
          _hash[key] = val
        }
      })

      result = _hash
    }

    return result
  },

  prependTableNameToHash: function(tableName, hash, quote) {
    if (tableName) {
      var _hash = {}

      for (var key in hash) {
        if (key instanceof Utils.literal) {
          _hash[key] = hash[key]
        } else if (key.indexOf('.') === -1) {
          if (tableName instanceof Utils.literal) {
            _hash[tableName + '.' + quote(key)] = hash[key]
          } else {
            _hash[tableName + '.' + key] = hash[key]
          }
        } else {
          _hash[key] = hash[key]
        }
      }

      return _hash
    } else {
      return hash
    }
  },

  firstValueOfHash: function(obj) {
    for (var key in obj) {
      if (obj.hasOwnProperty(key))
        return obj[key]
    }
    return null
  },

  inherit: function(subClass, superClass) {
    if (superClass.constructor == Function) {
      // Normal Inheritance
      subClass.prototype = new superClass();
      subClass.prototype.constructor = subClass;
      subClass.prototype.parent = superClass.prototype;
    } else {
      // Pure Virtual Inheritance
      subClass.prototype = superClass;
      subClass.prototype.constructor = subClass;
      subClass.prototype.parent = superClass;
    }

    return subClass;
  },


  stack: function() {
    var orig = Error.prepareStackTrace;
    Error.prepareStackTrace = function(_, stack){ return stack; };
    var err = new Error();
    Error.captureStackTrace(err, arguments.callee);
    var stack = err.stack;
    Error.prepareStackTrace = orig;
    return stack;
  },

  now: function(dialect) {
    var now = new Date()
    if(dialect != "postgres") now.setMilliseconds(0)
    return now
  },

  tick: function(func) {
    var tick = (global.hasOwnProperty('setImmediate') ? global.setImmediate : process.nextTick)
    tick(func)
  },

  // Note: Use the `quoteIdentifier()` and `escape()` methods on the
  // `QueryInterface` instead for more portable code.

  TICK_CHAR: '`',
  addTicks: function(s, tickChar) {
    tickChar = tickChar || Utils.TICK_CHAR
    return tickChar + Utils.removeTicks(s, tickChar) + tickChar
  },
  removeTicks: function(s, tickChar) {
    tickChar = tickChar || Utils.TICK_CHAR
    return s.replace(new RegExp(tickChar, 'g'), "")
  },

  /*
   * Utility functions for representing SQL functions, and columns that should be escaped.
   * Please do not use these functions directly, use Sequelize.fn and Sequelize.col instead.
   */
  fn: function (fn, args) {
    this.fn = fn
    this.args = args
  },

  col: function (col) {
    if (arguments.length > 1) {
      col = Array.prototype.slice.call(arguments);
    }
    this.col = col
  },

  cast: function (val, type) {
    this.val  = val
    this.type = (type || '').trim()
  },

  literal: function (val) {
    this.val = val
  },

  asIs: function(val) {
    this.val = val
  },

  and: function(args) {
    this.args = args
  },

  or: function(args) {
    this.args = args
  },

  generateUUID: function() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8)
      return v.toString(16)
    })
  },

  validateParameter: function(value, expectation, options) {
    return ParameterValidator.check(value, expectation, options)
  }
}

// I know this may seem silly, but this gives us the ability to recognize whether
// or not we should be escaping or if we should trust the user. Basically, it
// keeps things in perspective and organized.
Utils.literal.prototype.toString = function() {
  return this.val
}
Utils.asIs.prototype = Utils.literal.prototype

Utils.cast.prototype.toString = function(queryGenerator) {
  if (!this.val instanceof Utils.fn && !this.val instanceof Utils.col && !this.val instanceof Utils.literal) {
    this.val = queryGenerator.escape(this.val)
  } else {
    this.val = this.val.toString(queryGenerator)
  }

  return 'CAST(' + this.val + ' AS ' + this.type.toUpperCase() + ')'
}

Utils.fn.prototype.toString = function(queryGenerator, parentModel) {
  return this.fn + '(' + this.args.map(function (arg) {
    if (arg instanceof Utils.fn || arg instanceof Utils.col) {
      return arg.toString(queryGenerator, parentModel)
    } else {
      return queryGenerator.escape(arg)
    }
  }).join(', ') + ')'
}

Utils.col.prototype.toString = function (queryGenerator, parentModel) {
  if (Array.isArray(this.col)) {
    if (!parent) {
      throw new Error('Cannot call Sequelize.col() with array outside of order / group clause')
    }
  } else if (this.col.indexOf('*') === 0) {
    return '*'
  }
  return queryGenerator.quote(this.col, parentModel)
}

Utils.CustomEventEmitter = require(__dirname + "/emitters/custom-event-emitter")
Utils.QueryChainer = require(__dirname + "/query-chainer")
Utils.Lingo = require("lingo")
