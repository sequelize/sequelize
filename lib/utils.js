'use strict';

const DataTypes = require('./data-types');
const SqlString = require('./sql-string');
const _ = require('lodash');
const parameterValidator = require('./utils/parameter-validator');
const Logger = require('./utils/logger');
const uuid = require('uuid');
const Promise = require('./promise');
const operators  = require('./operators');
const operatorsArray = _.values(operators);
const primitives = ['string', 'number', 'boolean'];

let inflection = require('inflection');
const logger = new Logger();

exports.Promise = Promise;
exports.debug = logger.debug.bind(logger);
exports.deprecate = logger.deprecate.bind(logger);
exports.warn = logger.warn.bind(logger);
exports.getLogger = () =>  logger ;

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
  return _.mergeWith(a, b, objectValue => {
    // If it's an object, let _ handle it this time, we will be called again for each property
    if (!_.isPlainObject(objectValue) && objectValue !== undefined) {
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

  return options;
}
exports.mapOptionFieldNames = mapOptionFieldNames;

function mapWhereFieldNames(attributes, Model) {
  if (attributes) {
    getComplexKeys(attributes).forEach(attribute => {
      const rawAttribute = Model.rawAttributes[attribute];

      if (rawAttribute && rawAttribute.field !== rawAttribute.fieldName) {
        attributes[rawAttribute.field] = attributes[attribute];
        delete attributes[attribute];
      }

      if (_.isPlainObject(attributes[attribute])
        && !(rawAttribute && (
          rawAttribute.type instanceof DataTypes.HSTORE
          || rawAttribute.type instanceof DataTypes.JSON))) { // Prevent renaming of HSTORE & JSON fields
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

    });
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
  let result = args.length === Object.keys(primaryKeys).length;
  if (result) {
    _.each(args, arg => {
      if (result) {
        if (['number', 'string'].indexOf(typeof arg) !== -1) {
          result = true;
        } else {
          result = arg instanceof Date || Buffer.isBuffer(arg);
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
  return tableName1.toLowerCase() < tableName2.toLowerCase() ? tableName1 + tableName2 : tableName2 + tableName1;
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
  } else if (_.isPlainObject(value) || _.isArray(value)) {
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
 * @private
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
      if (options.allowNull.indexOf(key) > -1 || key.match(/Id$/) || val !== null && val !== undefined) {
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
  if (['mysql', 'postgres', 'sqlite'].indexOf(dialect) === -1) {
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
 * Receives a tree-like object and returns a plain object which depth is 1.
 *
 * - Input:
 *
 *  {
 *    name: 'John',
 *    address: {
 *      street: 'Fake St. 123',
 *      coordinates: {
 *        longitude: 55.6779627,
 *        latitude: 12.5964313
 *      }
 *    }
 *  }
 *
 * - Output:
 *
 *  {
 *    name: 'John',
 *    address.street: 'Fake St. 123',
 *    address.coordinates.latitude: 55.6779627,
 *    address.coordinates.longitude: 12.5964313
 *  }
 *
 * @param value, an Object
 * @return Object, an flattened object
 * @private
 */
function flattenObjectDeep(value) {
  if (!_.isPlainObject(value)) return value;
  const flattenedObj = {};

  function flattenObject(obj, subPath) {
    Object.keys(obj).forEach(key => {
      const pathToProperty = subPath ? `${subPath}.${key}` : `${key}`;
      if (typeof obj[key] === 'object') {
        flattenObject(obj[key], flattenedObj, pathToProperty);
      } else {
        flattenedObj[pathToProperty] = _.get(obj, key);
      }
    });
    return flattenedObj;
  }

  return flattenObject(value, undefined);
}
exports.flattenObjectDeep = flattenObjectDeep;

/**
 * Utility functions for representing SQL functions, and columns that should be escaped.
 * Please do not use these functions directly, use Sequelize.fn and Sequelize.col instead.
 * @private
 */
class SequelizeMethod {}
exports.SequelizeMethod = SequelizeMethod;

class Fn extends SequelizeMethod {
  constructor(fn, args) {
    super();
    this.fn = fn;
    this.args = args;
  }
  clone() {
    return new Fn(this.fn, this.args);
  }
}
exports.Fn = Fn;

class Col extends SequelizeMethod {
  constructor(col) {
    super();
    if (arguments.length > 1) {
      col = this.sliceArgs(arguments);
    }
    this.col = col;
  }
}
exports.Col = Col;

class Cast extends SequelizeMethod {
  constructor(val, type) {
    super();
    this.val = val;
    this.type = (type || '').trim();
  }
}
exports.Cast = Cast;

class Literal extends SequelizeMethod {
  constructor(val) {
    super();
    this.val = val;
  }
}
exports.Literal = Literal;

class Json extends SequelizeMethod {
  constructor(conditionsOrPath, value) {
    super();
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

class Where extends SequelizeMethod {
  constructor(attribute, comparator, logic) {
    super();
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

exports.validateParameter = parameterValidator;


exports.mapIsolationLevelStringToTedious = (isolationLevel, tedious) => {
  if (!tedious) {
    throw new Error('An instance of tedious lib should be passed to this function');
  }
  const tediousIsolationLevel = tedious.ISOLATION_LEVEL;
  switch (isolationLevel) {
    case 'READ_UNCOMMITTED':
      return tediousIsolationLevel.READ_UNCOMMITTED;
    case 'READ_COMMITTED':
      return tediousIsolationLevel.READ_COMMITTED;
    case 'REPEATABLE_READ':
      return tediousIsolationLevel.REPEATABLE_READ;
    case 'SERIALIZABLE':
      return tediousIsolationLevel.SERIALIZABLE;
    case 'SNAPSHOT':
      return tediousIsolationLevel.SNAPSHOT;
  }
};

//Collection of helper methods to make it easier to work with symbol operators

/**
 * getOperators
 * @param  {Object} obj
 * @return {Array<Symbol>} All operators properties of obj
 * @private
 */
function getOperators(obj) {
  return _.intersection(Object.getOwnPropertySymbols(obj), operatorsArray);
}
exports.getOperators = getOperators;

/**
 * getComplexKeys
 * @param  {Object} obj
 * @return {Array<String|Symbol>} All keys including operators
 * @private
 */
function getComplexKeys(obj) {
  return getOperators(obj).concat(_.keys(obj));
}
exports.getComplexKeys = getComplexKeys;

/**
 * getComplexSize
 * @param  {Object|Array} obj
 * @return {Integer}      Length of object properties including operators if obj is array returns its length
 * @private
 */
function getComplexSize(obj) {
  return Array.isArray(obj) ? obj.length : getComplexKeys(obj).length;
}
exports.getComplexSize = getComplexSize;
