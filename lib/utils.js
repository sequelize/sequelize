'use strict';

var util = require('util')
  , DataTypes = require('./data-types')
  , SqlString = require('./sql-string')
  , lodash = require('lodash')
  , ParameterValidator = require('./utils/parameter-validator')
  , inflection = require('inflection')
  , uuid = require('node-uuid');

var Utils = module.exports = {
  inflection: inflection,
  _: (function() {
    var _ = lodash;

    _.mixin({
      includes: function(str, needle){
        if (needle === '') return true;
        if (str === null) return false;
        return String(str).indexOf(needle) !== -1;
      },
      camelizeIf: function(string, condition) {
        var result = string;

        if (condition) {
          result = Utils.camelize(string);
        }

        return result;
      },
      underscoredIf: function(string, condition) {
        var result = string;

        if (condition) {
          result = inflection.underscore(string);
        }

        return result;
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
          if (typeof value === 'boolean' || value === 0 || value) {
            result.push(value);
          }
        }
        return result;
      }
    });

    return _;
  })(),
  // Same concept as _.merge, but don't overwrite properties that have already been assigned
  mergeDefaults: function (a, b) {
    return this._.merge(a, b, function (objectValue, sourceValue) {
      // If it's an object, let _ handle it this time, we will be called again for each property
      if (!this._.isPlainObject(objectValue) && objectValue !== undefined) {
        return objectValue;
      }
    }, this);
  },
  lowercaseFirst: function (s) {
    return s[0].toLowerCase() + s.slice(1);
  },
  uppercaseFirst: function (s) {
    return s[0].toUpperCase() + s.slice(1);
  },
  spliceStr: function (str, index, count, add) {
    return str.slice(0, index) + add + str.slice(index + count);
  },
  camelize: function(str){
    return str.trim().replace(/[-_\s]+(.)?/g, function(match, c){ return c.toUpperCase(); });
  },
  format: function(arr, dialect) {
    var timeZone = null;
    // Make a clone of the array beacuse format modifies the passed args
    return SqlString.format(arr[0], arr.slice(1), timeZone, dialect);
  },
  formatNamedParameters: function(sql, parameters, dialect) {
    var timeZone = null;
    return SqlString.formatNamedParameters(sql, parameters, timeZone, dialect);
  },
  injectScope: function(scope, merge) {
    var self = this;

    scope = scope || {};

    if (!this.scoped && self.options.defaultScope) {
      self.scopeObj = Utils._.clone(self.options.defaultScope);
      if (!Array.isArray(self.scopeObj.where)) {
        self.scopeObj.where = [self.scopeObj.where];
      }
    } else {
      self.scopeObj = self.scopeObj || {};
    }

    if (Array.isArray(scope.where)) {
      self.scopeObj.where = self.scopeObj.where || [];
      self.scopeObj.where.push(scope.where);
      return true;
    }

    if (typeof scope.order === 'string') {
      self.scopeObj.order = self.scopeObj.order || [];
      self.scopeObj.order[self.scopeObj.order.length] = scope.order;
    }

    // Limit and offset are *always* merged.
    if (!!scope.limit) {
      self.scopeObj.limit = scope.limit;
    }

    if (!!scope.offset) {
      self.scopeObj.offset = scope.offset;
    }

    // Where objects are a mixed variable. Possible values are arrays, strings, and objects
    if (!!scope.where) {
      // Begin building our scopeObj
      self.scopeObj.where = self.scopeObj.where || [];

      // Reset if we're merging!
      if (merge === true && !!scope.where && !!self.scopeObj.where) {
        var scopeKeys = Object.keys(scope.where);
        self.scopeObj.where = self.scopeObj.where.map(function(scopeObj) {
          if (!Array.isArray(scopeObj) && typeof scopeObj === 'object') {
            return lodash.omit.apply(undefined, [scopeObj].concat(scopeKeys));
          } else {
            return scopeObj;
          }
        }).filter(function(scopeObj) {
          return !lodash.isEmpty(scopeObj);
        });
        self.scopeObj.where = self.scopeObj.where.concat(scope.where);
      }

      if (Array.isArray(scope.where)) {
        self.scopeObj.where.push(scope.where);
      }
      else if (typeof scope.where === 'object') {
        Object.keys(scope.where).forEach(function() {
          self.scopeObj.where.push(scope.where);
        });
      } else { // Assume the value is a string
        self.scopeObj.where.push([scope.where]);
      }
    }

    if (!!self.scopeObj.where) {
      self.scopeObj.where = lodash.uniq(self.scopeObj.where);
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
      , type;

    (Array.isArray(whereArg) ? whereArg : [whereArg]).forEach(function(where) {
      // If it's an array we're already good... / it's in a format that can't be broken down further
      // e.g. Util.format['SELECT * FROM world WHERE status=?', 'hello']
      if (Array.isArray(where)) {
        _where._ = where._ || {queries: [], bindings: []};
        _where._.queries[_where._.queries.length] = where[0];
        if (where.length > 1) {
          var values = where.splice(1);
          if (dialect === 'sqlite') {
            values.forEach(function(v, i) {
              if (typeof v === 'boolean') {
                values[i] = (v === true ? 1 : 0);
              }
            });
          }
          _where._.bindings = _where._.bindings.concat(values);
        }
      }
      else if (typeof where === 'object') {
        // First iteration is trying to compress IN and NOT IN as much as possible...
        // .. reason being is that WHERE username IN (?) AND username IN (?) != WHERE username IN (?,?)
        Object.keys(where).forEach(function(i) {
          if (Array.isArray(where[i])) {
            where[i] = {
              in : where[i]
            };
          }
        });

        // Build our smart object
        Object.keys(where).forEach(function(i) {
          type = typeof where[i];
          _where[i] = _where[i] || {};

          if (where[i] === null) {
            // skip nulls
          }
          else if (Array.isArray(where[i])) {
            _where[i].in = _where[i]. in || [];
            _where[i]. in .concat(where[i]);
          }
          else if (Utils._.isPlainObject(where[i])) {
            Object.keys(where[i]).forEach(function(ii) {
              logic = self.getWhereLogic(ii, where[i][ii]);

              switch (logic) {
              case 'IN':
                _where[i].in = _where[i]. in || [];
                _where[i].in = _where[i]. in .concat(where[i][ii]);
                break;
              case 'NOT':
                _where[i].not = _where[i].not || [];
                _where[i].not = _where[i].not.concat(where[i][ii]);
                break;
              case 'BETWEEN':
                _where[i].between = _where[i].between || [];
                _where[i].between[_where[i].between.length] = [where[i][ii][0], where[i][ii][1]];
                break;
              case 'NOT BETWEEN':
                _where[i].nbetween = _where[i].nbetween || [];
                _where[i].nbetween[_where[i].nbetween.length] = [where[i][ii][0], where[i][ii][1]];
                break;
              case 'JOIN':
                _where[i].joined = _where[i].joined || [];
                _where[i].joined[_where[i].joined.length] = where[i][ii];
                break;
              default:
                _where[i].lazy = _where[i].lazy || {conditions: [], bindings: []};
                _where[i].lazy.conditions[_where[i].lazy.conditions.length] = logic + ' ?';
                _where[i].lazy.bindings = _where[i].lazy.bindings.concat(where[i][ii]);
              }
            });
          }
          else if (type === 'string' || type === 'number' || type === 'boolean' || Buffer.isBuffer(where[i])) {
            _where[i].lazy = _where[i].lazy || {conditions: [], bindings: []};
            if (type === 'boolean') {
              _where[i].lazy.conditions[_where[i].lazy.conditions.length] = '= ' + SqlString.escape(where[i], false, null, dialect); // sqlite is special
            } else {
              _where[i].lazy.conditions[_where[i].lazy.conditions.length] = '= ?';
              _where[i].lazy.bindings = _where[i].lazy.bindings.concat(where[i]);
            }
          }
        });
      }
    });

    return _where;
  },
  // Converts {smart where} object(s) into an array that's friendly for Utils.format()
  // NOTE: Must be applied/called from the QueryInterface
  compileSmartWhere: function(obj, dialect) {
    var self = this
      , whereArgs = []
      , text = []
      , columnName;

    if (typeof obj !== 'object') {
      return obj;
    }

    for (var column in obj) {
      if (column === '_') {
        text[text.length] = obj[column].queries.join(' AND ');
        if (obj[column].bindings.length > 0) {
          whereArgs = whereArgs.concat(obj[column].bindings);
        }
      } else {
        Object.keys(obj[column]).forEach(function(condition) {
          columnName = self.QueryInterface.quoteIdentifiers(column);
          switch (condition) {
          case 'in':
            text[text.length] = columnName + ' IN (' + obj[column][condition].map(function() { return '?'; }) + ')';
            whereArgs = whereArgs.concat(obj[column][condition]);
            break;
          case 'not':
            text[text.length] = columnName + ' NOT IN (' + obj[column][condition].map(function() { return '?'; }) + ')';
            whereArgs = whereArgs.concat(obj[column][condition]);
            break;
          case 'between':
            Object.keys(obj[column][condition]).forEach(function(row) {
              text[text.length] = columnName + ' BETWEEN ? AND ?';
              whereArgs = whereArgs.concat(obj[column][condition][row][0], obj[column][condition][row][1]);
            });
            break;
          case 'nbetween':
            Object.keys(obj[column][condition]).forEach(function(row) {
              text[text.length] = columnName + ' BETWEEN ? AND ?';
              whereArgs = whereArgs.concat(obj[column][condition][row][0], obj[column][condition][row][1]);
            });
            break;
          case 'joined':
            Object.keys(obj[column][condition]).forEach(function(row) {
              text[text.length] = columnName + ' = ' + self.QueryInterface.quoteIdentifiers(obj[column][condition][row]);
            });
            break;
          default: // lazy
            text = text.concat(obj[column].lazy.conditions.map(function(val) { return columnName + ' ' + val; }));
            whereArgs = whereArgs.concat(obj[column].lazy.bindings);
          }
        });
      }
    }

    return Utils._.compactLite([text.join(' AND ')].concat(whereArgs));
  },
  getWhereLogic: function(logic, val) {
    switch (logic) {
    case 'join':
      return 'JOIN';
    case 'gte':
      return '>=';
    case 'gt':
      return '>';
    case 'lte':
      return '<=';
    case 'lt':
      return '<';
    case 'eq':
      return val === null ? 'IS' : '=';
    case 'ne':
      return val === null ? 'IS NOT' : '!=';
    case 'between':
    case '..':
      return 'BETWEEN';
    case 'nbetween':
    case 'notbetween':
    case '!..':
      return 'NOT BETWEEN';
    case 'in':
      return 'IN';
    case 'not':
      return 'NOT IN';
    case 'like':
      return 'LIKE';
    case 'nlike':
    case 'notlike':
      return 'NOT LIKE';
    case 'ilike':
      return 'ILIKE';
    case 'nilike':
    case 'notilike':
      return 'NOT ILIKE';
    case 'overlap':
      return '&&';
    default:
      return '';
    }
  },
  argsArePrimaryKeys: function(args, primaryKeys) {
    var result = (args.length === Object.keys(primaryKeys).length);
    if (result) {
      Utils._.each(args, function(arg) {
        if (result) {
          if (['number', 'string'].indexOf(typeof arg) !== -1) {
            result = true;
          } else {
            result = (arg instanceof Date) || Buffer.isBuffer(arg);
          }
        }
      });
    }
    return result;
  },
  canTreatArrayAsAnd: function(arr) {
    return arr.reduce(function(treatAsAnd, arg) {
      if (treatAsAnd) {
        return treatAsAnd;
      } else {
        return !(arg instanceof Date) && ((arg instanceof Utils.and) || (arg instanceof Utils.or) || Utils._.isPlainObject(arg));
      }
    }, false);
  },

  combineTableNames: function(tableName1, tableName2) {
    return (tableName1.toLowerCase() < tableName2.toLowerCase()) ? (tableName1 + tableName2) : (tableName2 + tableName1);
  },

  singularize: function(s, language) {
    return inflection.singularize(s);
  },

  pluralize: function(s, language) {
    return inflection.pluralize(s);
  },

  removeCommentsFromFunctionString: function(s) {
    s = s.replace(/\s*(\/\/.*)/g, '');
    s = s.replace(/(\/\*[\n\r\s\S]*?\*\/)/mg, '');

    return s;
  },

  toDefaultValue: function(value) {
    if (lodash.isFunction(value)) {
      return value();
    } else if (value === DataTypes.UUIDV1) {
      return uuid.v1();
    } else if (value === DataTypes.UUIDV4) {
      return uuid.v4();
    } else if (value === DataTypes.NOW) {
      return Utils.now();
    } else {
      return value;
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
    if (typeof value === 'undefined') { return false; }

    // TODO this will be schemable when all supported db
    // have been normalized for this case
    if (value === DataTypes.NOW) { return false; }

    if (value === DataTypes.UUIDV1 || value === DataTypes.UUIDV4) { return false; }

    if (lodash.isFunction(value)) {
      return false;
    }

    return true;
  },


  removeNullValuesFromHash: function(hash, omitNull, options) {
    var result = hash;

    options = options || {};
    options.allowNull = options.allowNull || [];

    if (omitNull) {
      var _hash = {};

      Utils._.forIn(hash, function(val, key) {
        if (options.allowNull.indexOf(key) > -1 || key.match(/Id$/) || ((val !== null) && (val !== undefined))) {
          _hash[key] = val;
        }
      });

      result = _hash;
    }

    return result;
  },

  inherit: function(SubClass, SuperClass) {
    if (SuperClass.constructor === Function) {
      // Normal Inheritance
      SubClass.prototype = new SuperClass();
      SubClass.prototype.constructor = SubClass;
      SubClass.prototype.parent = SuperClass.prototype;
    } else {
      // Pure Virtual Inheritance
      SubClass.prototype = SuperClass;
      SubClass.prototype.constructor = SubClass;
      SubClass.prototype.parent = SuperClass;
    }

    return SubClass;
  },


  stack: function() {
    var orig = Error.prepareStackTrace;
    Error.prepareStackTrace = function(_, stack) { return stack; };
    var err = new Error();
    Error.captureStackTrace(err, this);
    var errStack = err.stack;
    Error.prepareStackTrace = orig;
    return errStack;
  },

  now: function(dialect) {
    var now = new Date();
    if (dialect !== 'postgres') now.setMilliseconds(0);
    return now;
  },

  tick: function(func) {
    var tick = (global.hasOwnProperty('setImmediate') ? global.setImmediate : process.nextTick);
    tick(func);
  },

  // Note: Use the `quoteIdentifier()` and `escape()` methods on the
  // `QueryInterface` instead for more portable code.

  TICK_CHAR: '`',
  addTicks: function(s, tickChar) {
    tickChar = tickChar || Utils.TICK_CHAR;
    return tickChar + Utils.removeTicks(s, tickChar) + tickChar;
  },
  removeTicks: function(s, tickChar) {
    tickChar = tickChar || Utils.TICK_CHAR;
    return s.replace(new RegExp(tickChar, 'g'), '');
  },

  /*
   * Utility functions for representing SQL functions, and columns that should be escaped.
   * Please do not use these functions directly, use Sequelize.fn and Sequelize.col instead.
   */
  fn: function(fn, args) {
    this.fn = fn;
    this.args = args;
  },

  col: function(col) {
    if (arguments.length > 1) {
      col = Array.prototype.slice.call(arguments);
    }
    this.col = col;
  },

  cast: function(val, type) {
    this.val = val;
    this.type = (type || '').trim();
  },

  literal: function(val) {
    this.val = val;
  },

  and: function(args) {
    this.args = args;
  },

  or: function(args) {
    this.args = args;
  },

  json: function(conditionsOrPath, value) {
    if (Utils._.isObject(conditionsOrPath)) {
      this.conditions = conditionsOrPath;
    } else {
      this.path = conditionsOrPath;
      if (value) {
        this.value = value;
      }
    }
  },

  where: function(attribute, comparator, logic) {
    if (logic === undefined) {
      logic = comparator;
      comparator = '=';
    }

    this.attribute = attribute;
    this.comparator = comparator;
    this.logic = logic;
  },

  generateUUID: function() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },

  validateParameter: function(value, expectation, options) {
    return ParameterValidator.check(value, expectation, options);
  }
};

Utils.and.prototype._isSequelizeMethod =
Utils.or.prototype._isSequelizeMethod =
Utils.where.prototype._isSequelizeMethod =
Utils.literal.prototype._isSequelizeMethod =
Utils.cast.prototype._isSequelizeMethod =
Utils.fn.prototype._isSequelizeMethod =
Utils.col.prototype._isSequelizeMethod =
Utils.json.prototype._isSequelizeMethod = true;

Utils.CustomEventEmitter = require(__dirname + '/emitters/custom-event-emitter');
Utils.Promise = require(__dirname + '/promise');
Utils.QueryChainer = require(__dirname + '/query-chainer');
