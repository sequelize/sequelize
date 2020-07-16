const _ = require('lodash');
const SqlString = require('../../sql-string');
const QueryTypes = require('../../query-types');
const Dot = require('dottie');
const deprecations = require('../../utils/deprecations');
const uuid = require('uuid').v4;

const stringify = obj => (obj instanceof Buffer ? obj.toString('hex') : obj);

// Calculates the array prefix of a key (['User', 'Results'] for 'User.Results.id')
const makeDoublePrefixMemoizer = () => {
  const keyPrefixMemo = {};
  return str => {
    // We use a double memo and keyPrefixString so that different keys with the same prefix will receive the same array instead of differnet arrays with equal values
    if (!Object.prototype.hasOwnProperty.call(keyPrefixMemo, str)) {
      const prefixString = str.substr(0, str.lastIndexOf('.'));
      if (!Object.prototype.hasOwnProperty.call(keyPrefixMemo, prefixString)) {
        keyPrefixMemo[prefixString] = prefixString ? prefixString.split('.') : [];
      }
      keyPrefixMemo[str] = keyPrefixMemo[prefixString];
    }
    return keyPrefixMemo[str];
  };
};

/**
 * Calculate the last item in the array prefix ('Results' for 'User.Results.id')
 *
 * @param {string} str
 */
const secondSuffix = str => {
  const lastDelim = str.lastIndexOf('.');
  if (lastDelim === -1) {
    return '';
  }
  const secondLastDelim = str.lastIndexOf('.', lastDelim - 1);
  if (secondLastDelim === -1) {
    return str.substr(0, lastDelim);
  }
  return str.substring(secondLastDelim + 1, lastDelim);
};

const getSuffix = str => {
  const index = str.lastIndexOf('.');
  return str.substr(index === -1 ? 0 : index + 1);
};

class AbstractQuery {
  constructor(connection, sequelize, options) {
    this.uuid = uuid();
    this.connection = connection;
    this.instance = options.instance;
    this.model = options.model;
    this.sequelize = sequelize;
    this.options = {
      plain: false,
      raw: false,
      // eslint-disable-next-line no-console
      logging: console.log,
      ...options
    };
    this.checkLoggingOption();
  }

  /**
   * rewrite query with parameters
   *
   * Examples:
   *
   *   query.formatBindParameters('select $1 as foo', ['fooval']);
   *
   *   query.formatBindParameters('select $foo as foo', { foo: 'fooval' });
   *
   * Options
   *   skipUnescape: bool, skip unescaping $$
   *   skipValueReplace: bool, do not replace (but do unescape $$). Check correct syntax and if all values are available
   *
   * @param {string} sql
   * @param {object|Array} values
   * @param {string} dialect
   * @param {Function} [replacementFunc]
   * @param {object} [options]
   * @private
   */
  static formatBindParameters(sql, values, dialect, replacementFunc, options) {
    if (!values) {
      return [sql, []];
    }

    options = options || {};
    if (typeof replacementFunc !== 'function') {
      options = replacementFunc || {};
      replacementFunc = undefined;
    }

    if (!replacementFunc) {
      if (options.skipValueReplace) {
        replacementFunc = (match, key, values) => {
          if (values[key] !== undefined) {
            return match;
          }
          return undefined;
        };
      } else {
        replacementFunc = (match, key, values, timeZone, dialect) => {
          if (values[key] !== undefined) {
            return SqlString.escape(values[key], timeZone, dialect);
          }
          return undefined;
        };
      }
    } else if (options.skipValueReplace) {
      const origReplacementFunc = replacementFunc;
      replacementFunc = (match, key, values, timeZone, dialect, options) => {
        if (origReplacementFunc(match, key, values, timeZone, dialect, options) !== undefined) {
          return match;
        }
        return undefined;
      };
    }

    const timeZone = null;
    const list = Array.isArray(values);
    sql = sql.replace(/\B\$(\$|\w+)/g, (match, key) => {
      if ('$' === key) {
        return options.skipUnescape ? match : key;
      }

      let replVal;
      if (list) {
        if (key.match(/^[1-9]\d*$/)) {
          key = key - 1;
          replVal = replacementFunc(match, key, values, timeZone, dialect, options);
        }
      } else if (!key.match(/^\d*$/)) {
        replVal = replacementFunc(match, key, values, timeZone, dialect, options);
      }
      if (replVal === undefined) {
        throw new Error(`Named bind parameter "${match}" has no value in the given object.`);
      }
      return replVal;
    });
    return [sql, []];
  }

  /**
   * Execute the passed sql query.
   *
   * Examples:
   *
   *     query.run('SELECT 1')
   *
   * @private
   */
  run() {
    throw new Error("The run method wasn't overwritten!");
  }

  /**
   * Check the logging option of the instance and print deprecation warnings.
   *
   * @private
   */
  checkLoggingOption() {
    if (this.options.logging === true) {
      deprecations.noTrueLogging();
      // eslint-disable-next-line no-console
      this.options.logging = console.log;
    }
  }

  /**
   * Get the attributes of an insert query, which contains the just inserted id.
   *
   * @returns {string} The field name.
   * @private
   */
  getInsertIdField() {
    return 'insertId';
  }

  getUniqueConstraintErrorMessage(field) {
    let message = field ? `${field} must be unique` : 'Must be unique';

    if (field && this.model) {
      for (const key of Object.keys(this.model.uniqueKeys)) {
        if (this.model.uniqueKeys[key].fields.includes(field.replace(/"/g, ''))) {
          if (this.model.uniqueKeys[key].msg) {
            message = this.model.uniqueKeys[key].msg;
          }
        }
      }
    }
    return message;
  }

  isRawQuery() {
    return this.options.type === QueryTypes.RAW;
  }

  isVersionQuery() {
    return this.options.type === QueryTypes.VERSION;
  }

  isUpsertQuery() {
    return this.options.type === QueryTypes.UPSERT;
  }

  isInsertQuery(results, metaData) {
    let result = true;

    if (this.options.type === QueryTypes.INSERT) {
      return true;
    }

    // is insert query if sql contains insert into
    result = result && this.sql.toLowerCase().startsWith('insert into');

    // is insert query if no results are passed or if the result has the inserted id
    result = result && (!results || Object.prototype.hasOwnProperty.call(results, this.getInsertIdField()));

    // is insert query if no metadata are passed or if the metadata has the inserted id
    result = result && (!metaData || Object.prototype.hasOwnProperty.call(metaData, this.getInsertIdField()));

    return result;
  }

  handleInsertQuery(results, metaData) {
    if (this.instance) {
      // add the inserted row id to the instance
      const autoIncrementAttribute = this.model.autoIncrementAttribute;
      let id = null;

      id = id || (results && results[this.getInsertIdField()]);
      id = id || (metaData && metaData[this.getInsertIdField()]);

      this.instance[autoIncrementAttribute] = id;
    }
  }

  isShowTablesQuery() {
    return this.options.type === QueryTypes.SHOWTABLES;
  }

  handleShowTablesQuery(results) {
    return _.flatten(results.map(resultSet => Object.values(resultSet)));
  }

  isShowIndexesQuery() {
    return this.options.type === QueryTypes.SHOWINDEXES;
  }

  isShowConstraintsQuery() {
    return this.options.type === QueryTypes.SHOWCONSTRAINTS;
  }

  isDescribeQuery() {
    return this.options.type === QueryTypes.DESCRIBE;
  }

  isSelectQuery() {
    return this.options.type === QueryTypes.SELECT;
  }

  isBulkUpdateQuery() {
    return this.options.type === QueryTypes.BULKUPDATE;
  }

  isBulkDeleteQuery() {
    return this.options.type === QueryTypes.BULKDELETE;
  }

  isForeignKeysQuery() {
    return this.options.type === QueryTypes.FOREIGNKEYS;
  }

  isUpdateQuery() {
    return this.options.type === QueryTypes.UPDATE;
  }

  handleSelectQuery(results) {
    let result = null;

    // Map raw fields to names if a mapping is provided
    if (this.options.fieldMap) {
      const fieldMap = this.options.fieldMap;
      results = results.map(result =>
        _.reduce(
          fieldMap,
          (result, name, field) => {
            if (result[field] !== undefined && name !== field) {
              result[name] = result[field];
              delete result[field];
            }
            return result;
          },
          result
        )
      );
    }

    // Raw queries
    if (this.options.raw) {
      result = results.map(result => {
        let o = {};

        for (const key in result) {
          if (Object.prototype.hasOwnProperty.call(result, key)) {
            o[key] = result[key];
          }
        }

        if (this.options.nest) {
          o = Dot.transform(o);
        }

        return o;
      });
      // Queries with include
    } else if (this.options.hasJoin === true) {
      results = AbstractQuery._groupJoinData(
        results,
        {
          model: this.model,
          includeMap: this.options.includeMap,
          includeNames: this.options.includeNames
        },
        {
          checkExisting: this.options.hasMultiAssociation
        }
      );

      result = this.model.bulkBuild(results, {
        isNewRecord: false,
        include: this.options.include,
        includeNames: this.options.includeNames,
        includeMap: this.options.includeMap,
        includeValidated: true,
        attributes: this.options.originalAttributes || this.options.attributes,
        raw: true
      });
      // Regular queries
    } else {
      result = this.model.bulkBuild(results, {
        isNewRecord: false,
        raw: true,
        attributes: this.options.originalAttributes || this.options.attributes
      });
    }

    // return the first real model instance if options.plain is set (e.g. Model.find)
    if (this.options.plain) {
      result = result.length === 0 ? null : result[0];
    }
    return result;
  }

  isShowOrDescribeQuery() {
    let result = false;

    result = result || this.sql.toLowerCase().startsWith('show');
    result = result || this.sql.toLowerCase().startsWith('describe');

    return result;
  }

  isCallQuery() {
    return this.sql.toLowerCase().startsWith('call');
  }

  /**
   * @param {string} sql
   * @param {Function} debugContext
   * @param {Array|object} parameters
   * @protected
   * @returns {Function} A function to call after the query was completed.
   */
  _logQuery(sql, debugContext, parameters) {
    const { connection, options } = this;
    const benchmark = this.sequelize.options.benchmark || options.benchmark;
    const logQueryParameters = this.sequelize.options.logQueryParameters || options.logQueryParameters;
    const startTime = Date.now();
    let logParameter = '';

    if (logQueryParameters && parameters) {
      const delimiter = sql.endsWith(';') ? '' : ';';
      let paramStr;
      if (Array.isArray(parameters)) {
        paramStr = parameters.map(p => JSON.stringify(p)).join(', ');
      } else {
        paramStr = JSON.stringify(parameters);
      }
      logParameter = `${delimiter} ${paramStr}`;
    }
    const fmt = `(${connection.uuid || 'default'}): ${sql}${logParameter}`;
    const msg = `Executing ${fmt}`;
    debugContext(msg);
    if (!benchmark) {
      this.sequelize.log(`Executing ${fmt}`, options);
    }
    return () => {
      const afterMsg = `Executed ${fmt}`;
      debugContext(afterMsg);
      if (benchmark) {
        this.sequelize.log(afterMsg, Date.now() - startTime, options);
      }
    };
  }

  /**
   * The function takes the result of the query execution and groups
   * the associated data by the callee.
   *
   * Example:
   *   groupJoinData([
   *     {
   *       some: 'data',
   *       id: 1,
   *       association: { foo: 'bar', id: 1 }
   *     }, {
   *       some: 'data',
   *       id: 1,
   *       association: { foo: 'bar', id: 2 }
   *     }, {
   *       some: 'data',
   *       id: 1,
   *       association: { foo: 'bar', id: 3 }
   *     }
   *   ])
   *
   * Result:
   *   Something like this:
   *
   *   [
   *     {
   *       some: 'data',
   *       id: 1,
   *       association: [
   *         { foo: 'bar', id: 1 },
   *         { foo: 'bar', id: 2 },
   *         { foo: 'bar', id: 3 }
   *       ]
   *     }
   *   ]
   *
   * @param {Array} rows
   * @param {object} includeOptions
   * @param {object} options
   * @private
   */
  static _groupJoinData(rows, includeOptions, options) {
    /*
     * Assumptions
     * ID is not necessarily the first field
     * All fields for a level is grouped in the same set (i.e. Panel.id, Task.id, Panel.title is not possible)
     * Parent keys will be seen before any include/child keys
     * Previous set won't necessarily be parent set (one parent could have two children, one child would then be previous set for the other)
     */

    if (!rows.length) {
      return [];
    }

    const includeMap = {};

    const memoKeyPrefix = makeDoublePrefixMemoizer();

    const uniqueKeyMap = {};

    const getUniqueKeyAttributes = model => {
      if (model.uniqueKeys.length === 0) {
        return [];
      }
      if (Object.prototype.hasOwnProperty.call(uniqueKeyMap, model)) {
        return uniqueKeyMap[model];
      }
      const uniqueKeys = [];
      for (const { fields: uniqueFields } of Object.values(model.uniqueKeys)) {
        for (const attribute of Object.values(model.rawAttributes)) {
          if (uniqueFields.includes(attribute.field)) {
            uniqueKeys.push(attribute.fieldName);
          }
        }
      }
      uniqueKeyMap[model] = uniqueKeys;

      return uniqueKeys;
    };

    /**
     * @type {string}
     */
    let prevKey;
    /**
     * @type {boolean}
     */
    let topExists = false;

    /**
     * @type {boolean}
     */
    const checkExisting = options.checkExisting;

    const resultMap = {};

    const computeHashKeyForInstance = (row, prevKeyPrefix, topHash, values) => {
      const length = prevKeyPrefix.length;
      /**
       * @type {string}
       */
      let parent = null;
      /**
       * @type {string}
       */
      let parentHash = null;
      /**
       * @type {string}
       */
      let itemHash = topHash;

      let isEmpty = false;
      for (let i = 0; i < length; i++) {
        /**
         * @type {string}
         */
        const prefix = parent ? `${parent}.${prevKeyPrefix[i]}` : prevKeyPrefix[i];
        itemHash = prefix;
        for (const primKeyAttr of includeMap[prefix].model.primaryKeyAttributes) {
          itemHash += stringify(row[`${prefix}.${primKeyAttr}`]);
        }
        if (includeMap[prefix].model.primaryKeyAttributes.length === 0) {
          const uniqueKeyAttributes = getUniqueKeyAttributes(includeOptions.model);
          for (const uniqAttr of uniqueKeyAttributes) {
            if (row[`${prefix}.${uniqAttr}`] !== null) {
              itemHash += stringify(row[`${prefix}.${uniqAttr}`]);
            }
          }
        }
        isEmpty = itemHash === prefix;
        if (!parentHash) {
          parentHash = topHash;
        }

        itemHash = parentHash + itemHash;
        parent = prefix;
        if (i < length - 1) {
          parentHash = itemHash;
        }
      }

      if (itemHash === topHash) {
        if (!resultMap[itemHash]) {
          resultMap[itemHash] = values;
          return;
        }
        topExists = true;
        return;
      }

      if (resultMap[itemHash]) {
        return;
      }

      parent = resultMap[parentHash];
      const lastKeyPrefix = secondSuffix(prevKey);

      if (includeMap[prevKey].association.isSingleAssociation) {
        if (parent) {
          parent[lastKeyPrefix] = resultMap[itemHash] = values;
        }
        return;
      }
      if (!parent[lastKeyPrefix]) {
        parent[lastKeyPrefix] = [];
      }
      if (!isEmpty) {
        resultMap[itemHash] = values;
        parent[lastKeyPrefix].push(resultMap[itemHash]);
      }
    };

    const rowsLength = rows.length;
    const results = checkExisting ? [] : new Array(rowsLength);

    // Keys are the same for all rows, so only need to compute them on the first row
    const keys = rowsLength > 0 ? Object.keys(rows[0]) : undefined;
    const keyPrefixes = keys ? new Array(keys.length) : undefined;
    // precompute prefixes and include maps
    if (keys) {
      for (let i = 0; i < keys.length; ++i) {
        const key = keys[i];
        const keyPrefix = memoKeyPrefix(key);
        keyPrefixes[i] = keyPrefix;
        if (Object.prototype.hasOwnProperty.call(includeMap, key)) {
          continue;
        }
        if (keyPrefix.length === 0) {
          includeMap[key] = includeOptions;
          continue;
        }
        /**
         * @type {object}
         */
        let current = includeOptions;
        /**
         * @type {string}
         */
        let previousPiece = undefined;
        for (const prefix of keyPrefix) {
          if (!Object.prototype.hasOwnProperty.call(current.includeMap, prefix)) {
            continue;
          }
          includeMap[key] = current = current.includeMap[prefix];
          if (previousPiece) {
            previousPiece = `${previousPiece}.${prefix}`;
          } else {
            previousPiece = prefix;
          }
          includeMap[previousPiece] = current;
        }
      }
    }
    /**
     * @type {string}
     */
    let topHash;
    for (let rowsI = 0; rowsI < rowsLength; rowsI++) {
      const row = rows[rowsI];

      if (checkExisting) {
        topExists = false;

        // Compute top level hash key (this is usually just the primary key values)
        topHash = '';

        for (const primKeyAttr of includeOptions.model.primaryKeyAttributes) {
          topHash += stringify(row[primKeyAttr]);
        }

        if (topHash === '') {
          const uniqueKeyAttributes = getUniqueKeyAttributes(includeOptions.model);
          for (const uniqAttr of uniqueKeyAttributes) {
            topHash += stringify(row[uniqAttr]);
          }
        }
      }

      /**
       * @type {object}
       */
      let values;
      const topValues = (values = {});
      let prevKeyPrefix = undefined;
      for (let j = 0; j < keys.length; ++j) {
        const key = keys[j];
        const keyPrefix = keyPrefixes[j];

        // End of key set
        if (prevKeyPrefix !== undefined && prevKeyPrefix !== keyPrefix) {
          if (checkExisting) {
            computeHashKeyForInstance(row, prevKeyPrefix, topHash, values);

            // Reset values
            values = {};
          } else {
            // If checkExisting is false it's because there's only 1:1 associations in this query
            // However we still need to map onto the appropriate parent
            // For 1:1 we map forward, initializing the value object on the parent to be filled in the next iterations of the loop
            let current = topValues;
            const length = keyPrefix.length;
            for (let i = 0; i < length; i++) {
              if (i === length - 1) {
                values = current[keyPrefix[i]] = {};
              }
              current = current[keyPrefix[i]] || {};
            }
          }
        }

        // End of iteration, set value and set prev values (for next iteration)
        values[getSuffix(key)] = row[key];
        prevKey = key;
        prevKeyPrefix = keyPrefix;
      }

      if (checkExisting) {
        computeHashKeyForInstance(row, prevKeyPrefix, topHash, values);
        if (!topExists) {
          results.push(topValues);
        }
      } else {
        results[rowsI] = topValues;
      }
    }

    return results;
  }
}

module.exports = AbstractQuery;
module.exports.AbstractQuery = AbstractQuery;
module.exports.default = AbstractQuery;
