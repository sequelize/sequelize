var util       = require("util")
  , DataTypes  = require("./data-types")
  , SqlString  = require("./sql-string")
  , lodash     = require("lodash")

var Utils = module.exports = {
  _: (function() {
    var _  = lodash
      , _s = require('underscore.string')

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
      }
    })

    return _
  })(),
  addEventEmitter: function(_class) {
    util.inherits(_class, require('events').EventEmitter)
  },
  format: function(arr, dialect) {
    var timeZone = null;
    return SqlString.format(arr.shift(), arr, timeZone, dialect)
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
        for (var i in scope.where) {
          self.scopeObj.where.push(scope.where)
        }
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
  smartWhere: function(whereArg) {
    var self = this
      , _where = {}
      , logic
      , type

    whereArg = Array.isArray(whereArg) ? whereArg : [whereArg]
    whereArg.forEach(function(where){
      // If it's an array we're already good... / it's in a format that can't be broken down further
      // e.g. Util.format['SELECT * FROM world WHERE status=?', 'hello']
      if (Array.isArray(where)) {
        _where._ = where._ || {queries: [], bindings: []}
        _where._.queries[_where._.queries.length] = where[0]
        if (where.length > 1) {
          _where._.bindings = _where._.bindings.concat(where.splice(1))
        }
      }
      else if (typeof where === "object") {
        // First iteration is trying to compress IN and NOT IN as much as possible...
        // .. reason being is that WHERE username IN (?) AND username IN (?) != WHERE username IN (?,?)
        for (var i in where) {
          if (Array.isArray(where[i])) {
            where[i] = {
              in: where[i]
            }
          }
        }

        // Build our smart object
        for (var i in where) {
          type = typeof where[i]
          _where[i] = _where[i] || {}

          if (Array.isArray(where[i])) {
            _where[i].in = _where[i].in || []
            _where[i].in.concat(where[i]);
          }
          else if (type === "object") {
            for (var ii in where[i]) {
              logic = self.getWhereLogic(ii)

              switch(logic) {
              case 'IN':
                _where[i].in = _where[i].in || []
                _where[i].in = _where[i].in.concat(where[i][ii]);
                break;
              case 'NOT':
                _where[i].not = _where[i].not || []
                _where[i].not = _where[i].not.concat(where[i][ii]);
                break;
              case 'BETWEEN':
                _where[i].between = _where[i].between || []
                _where[i].between[_where[i].between.length] = [where[i][ii][0], where[i][ii][1]]
                break;
              case 'NOT BETWEEN':
                _where[i].nbetween = _where[i].nbetween || []
                _where[i].nbetween[_where[i].nbetween.length] = [where[i][ii][0], where[i][ii][1]]
                break;
              default:
                _where[i].lazy = _where[i].lazy || {conditions: [], bindings: []}
                _where[i].lazy.conditions[_where[i].lazy.conditions.length] = logic + ' ?'
                _where[i].lazy.bindings = _where[i].lazy.bindings.concat(where[i][ii])
              }
            }
          }
          else if (type === "string" || type === "number") {
            _where[i].lazy = _where[i].lazy || {conditions: [], bindings: []}
            _where[i].lazy.conditions[_where[i].lazy.conditions.length] = '= ?'
            _where[i].lazy.bindings = _where[i].lazy.bindings.concat(where[i])
          }
        }
      }
    })

    return _where
  },
  // Converts {smart where} object(s) into an array that's friendly for Utils.format()
  // NOTE: Must be applied/called from the QueryInterface
  compileSmartWhere: function(obj) {
    var whereArgs = []
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
        for (var condition in obj[column]) {
          columnName = this.QueryInterface.quoteIdentifiers(column)
          switch(condition) {
          case 'in':
            text[text.length] = column + ' IN (' + obj[column][condition].map(function(){ return '?'; }) + ')'
            whereArgs = whereArgs.concat(obj[column][condition])
            break
          case 'not':
            text[text.length] = column + ' NOT IN (' + obj[column][condition].map(function(){ return '?'; }) + ')'
            whereArgs = whereArgs.concat(obj[column][condition])
            break
          case 'between':
            for (var row in obj[column][condition]) {
              text[text.length] = column + ' BETWEEN ? AND ?'
              whereArgs = whereArgs.concat(obj[column][condition][row][0], obj[column][condition][row][1])
            }
            break
          case 'nbetween':
            for (var row in obj[column][condition]) {
              text[text.length] = column + ' BETWEEN ? AND ?'
              whereArgs = whereArgs.concat(obj[column][condition][row][0], obj[column][condition][row][1])
            }
            break
          default: // lazy
            text = text.concat(obj[column].lazy.conditions.map(function(val){ return column + ' ' + val }))
            whereArgs = whereArgs.concat(obj[column].lazy.bindings)
          }
        }
      }
    }

    return lodash.compact([text.join(' AND ')].concat(whereArgs))
  },
  getWhereLogic: function(logic) {
    switch (logic) {
    case 'gte':
      return '>='
      break
    case 'gt':
      return '>'
      break
    case 'lte':
      return '<='
      break
    case 'lt':
      return '<'
      break
    case 'eq':
      return '='
      break
    case 'ne':
      return '!='
      break
    case 'between':
    case '..':
      return 'BETWEEN'
      break
    case 'nbetween':
    case 'notbetween':
    case '!..':
      return 'NOT BETWEEN'
      break
    case 'in':
      return 'IN'
      break
    case 'not':
      return 'NOT IN'
      break
    case 'like':
      return 'LIKE'
      break
    case 'nlike':
    case 'notlike':
      return 'NOT LIKE'
      break
    default:
      return ''
    }
  },
  isHash: function(obj) {
    return Utils._.isObject(obj) && !Array.isArray(obj);
  },
  pad: function (s) {
    return s < 10 ? '0' + s : s
  },
  toSqlDate: function(date) {
    return date.getUTCFullYear() + '-' +
      this.pad(date.getUTCMonth()+1) + '-' +
      this.pad(date.getUTCDate()) + ' ' +
      this.pad(date.getUTCHours()) + ':' +
      this.pad(date.getUTCMinutes()) + ':' +
      this.pad(date.getUTCSeconds())
  },
  argsArePrimaryKeys: function(args, primaryKeys) {
    var result = (args.length == Object.keys(primaryKeys).length)
    if (result) {
      Utils._.each(args, function(arg) {
        if (result) {
          if (['number', 'string'].indexOf(typeof arg) !== -1) {
            result = true
          } else {
            result = (arg instanceof Date)
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
    return (value === DataTypes.NOW) ? Utils.now() : value
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

  removeNullValuesFromHash: function(hash, omitNull) {
    var result = hash

    if (omitNull) {
      var _hash = {}

      Utils._.each(hash, function(val, key) {
        if (key.match(/Id$/) || ((val !== null) && (val !== undefined))) {
          _hash[key] = val;
        }
      })

      result = _hash
    }

    return result
  },

  prependTableNameToHash: function(tableName, hash) {
    if (tableName) {
      var _hash = {}

      for (var key in hash) {
        if (key.indexOf('.') === -1) {
          _hash[tableName + '.' + key] = hash[key]
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

  now: function(dialect) {
    var now = new Date()
    if(dialect != "postgres") now.setMilliseconds(0)
    return now
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
  escape: function(s) {
    return SqlString.escape(s, true, "local").replace(/\\"/g, '"')
  }
}

Utils.CustomEventEmitter = require("./emitters/custom-event-emitter")
Utils.QueryChainer = require("./query-chainer")
Utils.Lingo = require("lingo")