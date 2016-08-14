'use strict';

const DataTypes = require('./data-types');
const SqlString = require('./sql-string');
const _ = require('lodash').runInContext(); // Prevent anyone messing with template settings by creating a fresh copy
const parameterValidator = require('./utils/parameter-validator');
const Logger = require('./utils/logger');
const uuid = require('node-uuid');
const Promise = require('./promise');
const primitives = ['string', 'number', 'boolean'];

let inflection = require('inflection');
const logger = new Logger();

exports.Promise = Promise;
exports._ = _;
exports.debug = logger.debug.bind(logger);
exports.deprecate = logger.deprecate.bind(logger);
exports.warn = logger.warn.bind(logger);
exports.getLogger = () => ( logger );

function useInflection(_inflection) {
  inflection = _inflection;
}
exports.useInflection = useInflection;

function camelizeIf(str, condition) {
  let result = str;

  if (condition) {
    result = camelize(str);
  }

  return result;
}
exports.camelizeIf = camelizeIf;

function underscoredIf(str, condition) {
  let result = str;

  if (condition) {
    result = underscore(str);
  }

  return result;
}
exports.underscoredIf = underscoredIf;

function isPrimitive(val) {
  return primitives.indexOf(typeof val) !== -1;
}
exports.isPrimitive = isPrimitive;

// Same concept as _.merge, but don't overwrite properties that have already been assigned
function mergeDefaults(a, b) {
  return _.mergeWith(a, b, (objectValue, sourceValue) => {
    // If it's an object, let _ handle it this time, we will be called again for each property
    if (!this._.isPlainObject(objectValue) && objectValue !== undefined) {
      return objectValue;
    }
  });
}
exports.mergeDefaults = mergeDefaults;

// An alternative to _.merge, which doesn't clone its arguments
// Cloning is a bad idea because options arguments may contain references to sequelize
// models - which again reference database libs which don't like to be cloned (in particular pg-native)
function merge() {
  const result = {};

  for (const obj of arguments) {
    _.forOwn(obj, (value, key) => {
      if (typeof value !== 'undefined') {
        if (!result[key]) {
          result[key] = value;
        } else if (_.isPlainObject(value) && _.isPlainObject(result[key])) {
          result[key] = merge(result[key], value);
        } else if (Array.isArray(value) && Array.isArray(result[key])) {
          result[key] = value.concat(result[key]);
        } else {
          result[key] = value;
        }
      }
    });
  }

  return result;
}
exports.merge = merge;

function lowercaseFirst(s) {
  return s[0].toLowerCase() + s.slice(1);
}
exports.lowercaseFirst = lowercaseFirst;

function uppercaseFirst(s) {
  return s[0].toUpperCase() + s.slice(1);
}
exports.uppercaseFirst = uppercaseFirst;

function spliceStr(str, index, count, add) {
  return str.slice(0, index) + add + str.slice(index + count);
}
exports.spliceStr = spliceStr;

function camelize(str) {
  return str.trim().replace(/[-_\s]+(.)?/g, (match, c) => c.toUpperCase());
}
exports.camelize = camelize;

function underscore(str) {
  return inflection.underscore(str);
}
exports.underscore = underscore;

function format(arr, dialect) {
  const timeZone = null;
  // Make a clone of the array beacuse format modifies the passed args
  return SqlString.format(arr[0], arr.slice(1), timeZone, dialect);
}
exports.format = format;

function formatNamedParameters(sql, parameters, dialect) {
  const timeZone = null;
  return SqlString.formatNamedParameters(sql, parameters, timeZone, dialect);
}
exports.formatNamedParameters = formatNamedParameters;

function cloneDeep(obj) {
  obj = obj || {};
  return _.cloneDeepWith(obj, elem => {
    // Do not try to customize cloning of arrays or POJOs
    if (Array.isArray(elem) || _.isPlainObject(elem)) {
      return undefined;
    }

    // Don't clone stuff that's an object, but not a plain one - fx example sequelize models and instances
    if (typeof elem === 'object') {
      return elem;
    }

    // Preserve special data-types like `fn` across clones. _.get() is used for checking up the prototype chain
    if (elem && typeof elem.clone === 'function') {
      return elem.clone();
    }
  });
}
exports.cloneDeep = cloneDeep;

/* Expand and normalize finder options */
function mapFinderOptions(options, Model) {
  if (Model._hasVirtualAttributes && Array.isArray(options.attributes)) {
    for (const attribute of options.attributes) {
      if (Model._isVirtualAttribute(attribute) && Model.rawAttributes[attribute].type.fields) {
        options.attributes = options.attributes.concat(Model.rawAttributes[attribute].type.fields);
      }
    }
    options.attributes = _.without.apply(_, [options.attributes].concat(Model._virtualAttributes));
    options.attributes = _.uniq(options.attributes);
  }

  mapOptionFieldNames(options, Model);

  return options;
}
exports.mapFinderOptions = mapFinderOptions;

/* Used to map field names in attributes and where conditions */
function mapOptionFieldNames(options, Model) {
  if (Array.isArray(options.attributes)) {
    options.attributes = options.attributes.map(attr => {
      // Object lookups will force any variable to strings, we don't want that for special objects etc
      if (typeof attr !== 'string') return attr;
      // Map attributes to aliased syntax attributes
      if (Model.rawAttributes[attr] && attr !== Model.rawAttributes[attr].field) {
        return [Model.rawAttributes[attr].field, attr];
      }
      return attr;
    });
  }

  if (options.where && _.isPlainObject(options.where)) {
    options.where = mapWhereFieldNames(options.where, Model);
  }

  if (Array.isArray(options.order)) {
    for (const oGroup of options.order) {
      let OrderModel;
      let attr;
      let attrOffset;

      if (Array.isArray(oGroup)) {
        OrderModel = Model;

        // Check if we have ['attr', 'DESC'] or [Model, 'attr', 'DESC']
        if (typeof oGroup[oGroup.length - 2] === 'string') {
          attrOffset = 2;

        // Assume ['attr'], [Model, 'attr'] or [seq.fn('somefn', 1), 'DESC']
        } else {
          attrOffset = 1;
        }

        attr = oGroup[oGroup.length - attrOffset];
        if (oGroup.length > attrOffset) {
          OrderModel = oGroup[oGroup.length - (attrOffset + 1)];
          if (OrderModel.model) {
            OrderModel = OrderModel.model;
          }
        }

        if (OrderModel.rawAttributes && OrderModel.rawAttributes[attr] && attr !== OrderModel.rawAttributes[attr].field) {
          oGroup[oGroup.length - attrOffset] = OrderModel.rawAttributes[attr].field;
        }
      }
    }
  }

  return options;
}
exports.mapOptionFieldNames = mapOptionFieldNames;

function mapWhereFieldNames(attributes, Model) {
  let attribute;
  let rawAttribute;

  if (attributes) {
    for (attribute in attributes) {
      rawAttribute = Model.rawAttributes[attribute];

      if (rawAttribute && rawAttribute.field !== rawAttribute.fieldName) {
        attributes[rawAttribute.field] = attributes[attribute];
        delete attributes[attribute];
      }

      if (_.isPlainObject(attributes[attribute])) {
        attributes[attribute] = mapOptionFieldNames({
          where: attributes[attribute]
        }, Model).where;
      }

      if (Array.isArray(attributes[attribute])) {
        attributes[attribute] = attributes[attribute].map(where => {
          if (_.isPlainObject(where)) {
            return mapWhereFieldNames(where, Model);
          }

          return where;
        });
      }
    }
  }

  return attributes;
}
exports.mapWhereFieldNames = mapWhereFieldNames;

/* Used to map field names in values */
function mapValueFieldNames(dataValues, fields, Model) {
  const values = {};

  for (const attr of fields) {
    if (dataValues[attr] !== undefined && !Model._isVirtualAttribute(attr)) {
      // Field name mapping
      if (Model.rawAttributes[attr] && Model.rawAttributes[attr].field && Model.rawAttributes[attr].field !== attr) {
        values[Model.rawAttributes[attr].field] = dataValues[attr];
      } else {
        values[attr] = dataValues[attr];
      }
    }
  }

  return values;
}
exports.mapValueFieldNames = mapValueFieldNames;

function isColString(value) {
  return typeof value === 'string' && value.substr(0, 1) === '$' && value.substr(value.length - 1, 1) === '$';
}
exports.isColString = isColString;

function argsArePrimaryKeys(args, primaryKeys) {
  let result = (args.length === Object.keys(primaryKeys).length);
  if (result) {
    _.each(args, arg => {
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
}
exports.argsArePrimaryKeys = argsArePrimaryKeys;

function canTreatArrayAsAnd(arr) {
  return arr.reduce((treatAsAnd, arg) => {
    if (treatAsAnd) {
      return treatAsAnd;
    } else {
      return _.isPlainObject(arg);
    }
  }, false);
}
exports.canTreatArrayAsAnd = canTreatArrayAsAnd;

function combineTableNames(tableName1, tableName2) {
  return (tableName1.toLowerCase() < tableName2.toLowerCase()) ? (tableName1 + tableName2) : (tableName2 + tableName1);
}
exports.combineTableNames = combineTableNames;

function singularize(str) {
  return inflection.singularize(str);
}
exports.singularize = singularize;

function pluralize(str) {
  return inflection.pluralize(str);
}
exports.pluralize = pluralize;

function removeCommentsFromFunctionString(s) {
  s = s.replace(/\s*(\/\/.*)/g, '');
  s = s.replace(/(\/\*[\n\r\s\S]*?\*\/)/mg, '');

  return s;
}
exports.removeCommentsFromFunctionString = removeCommentsFromFunctionString;

function toDefaultValue(value) {
  if (typeof value === 'function') {
    const tmp = value();
    if (tmp instanceof DataTypes.ABSTRACT) {
      return tmp.toSql();
    } else {
      return tmp;
    }
  } else if (value instanceof DataTypes.UUIDV1) {
    return uuid.v1();
  } else if (value instanceof DataTypes.UUIDV4) {
    return uuid.v4();
  } else if (value instanceof DataTypes.NOW) {
    return now();
  } else if(_.isPlainObject(value) || _.isArray(value)) {
    return _.clone(value);
  } else {
    return value;
  }
}
exports.toDefaultValue = toDefaultValue;

/**
 * Determine if the default value provided exists and can be described
 * in a db schema using the DEFAULT directive.
 *
 * @param  {*} value Any default value.
 * @return {boolean} yes / no.
 */
function defaultValueSchemable(value) {
  if (typeof value === 'undefined') { return false; }

  // TODO this will be schemable when all supported db
  // have been normalized for this case
  if (value instanceof DataTypes.NOW) { return false; }

  if (value instanceof DataTypes.UUIDV1 || value instanceof DataTypes.UUIDV4) { return false; }

  if (_.isFunction(value)) {
    return false;
  }

  return true;
}
exports.defaultValueSchemable = defaultValueSchemable;

function removeNullValuesFromHash(hash, omitNull, options) {
  let result = hash;

  options = options || {};
  options.allowNull = options.allowNull || [];

  if (omitNull) {
    const _hash = {};

    _.forIn(hash, (val, key) => {
      if (options.allowNull.indexOf(key) > -1 || key.match(/Id$/) || ((val !== null) && (val !== undefined))) {
        _hash[key] = val;
      }
    });

    result = _hash;
  }

  return result;
}
exports.removeNullValuesFromHash = removeNullValuesFromHash;

function stack() {
  const orig = Error.prepareStackTrace;
  Error.prepareStackTrace = (_, stack) => stack;
  const err = new Error();
  Error.captureStackTrace(err, stack);
  const errStack = err.stack;
  Error.prepareStackTrace = orig;
  return errStack;
}
exports.stack = stack;

function sliceArgs(args, begin) {
  begin = begin || 0;
  const tmp = new Array(args.length - begin);
  for (let i = begin; i < args.length; ++i) {
    tmp[i - begin] = args[i];
  }
  return tmp;
}
exports.sliceArgs = sliceArgs;

function now(dialect) {
  const now = new Date();
  if (['postgres', 'sqlite'].indexOf(dialect) === -1) {
    now.setMilliseconds(0);
  }
  return now;
}
exports.now = now;

// Note: Use the `quoteIdentifier()` and `escape()` methods on the
// `QueryInterface` instead for more portable code.

const TICK_CHAR = '`';
exports.TICK_CHAR = TICK_CHAR;

function addTicks(s, tickChar) {
  tickChar = tickChar || TICK_CHAR;
  return tickChar + removeTicks(s, tickChar) + tickChar;
}
exports.addTicks = addTicks;

function removeTicks(s, tickChar) {
  tickChar = tickChar || TICK_CHAR;
  return s.replace(new RegExp(tickChar, 'g'), '');
}
exports.removeTicks = removeTicks;

/**
 * Utility functions for representing SQL functions, and columns that should be escaped.
 * Please do not use these functions directly, use Sequelize.fn and Sequelize.col instead.
 */
class Fn {
  constructor(fn, args) {
    this.fn = fn;
    this.args = args;
  }
  clone() {
    return new Fn(this.fn, this.args);
  }
}
exports.Fn = Fn;

class Col {
  constructor(col) {
    if (arguments.length > 1) {
      col = this.sliceArgs(arguments);
    }
    this.col = col;
  }
}
exports.Col = Col;

class Cast {
  constructor(val, type) {
    this.val = val;
    this.type = (type || '').trim();
  }
}
exports.Cast = Cast;

class Literal {
  constructor(val) {
    this.val = val;
  }
}
exports.Literal = Literal;

class Json {
  constructor(conditionsOrPath, value) {
    if (_.isObject(conditionsOrPath)) {
      this.conditions = conditionsOrPath;
    } else {
      this.path = conditionsOrPath;
      if (value) {
        this.value = value;
      }
    }
  }
}
exports.Json = Json;

class Where {
  constructor(attribute, comparator, logic) {
    if (logic === undefined) {
      logic = comparator;
      comparator = '=';
    }

    this.attribute = attribute;
    this.comparator = comparator;
    this.logic = logic;
  }
}
exports.Where = Where;

Where.prototype._isSequelizeMethod =
Literal.prototype._isSequelizeMethod =
Cast.prototype._isSequelizeMethod =
Fn.prototype._isSequelizeMethod =
Col.prototype._isSequelizeMethod =
Json.prototype._isSequelizeMethod = true;

exports.validateParameter = parameterValidator;
