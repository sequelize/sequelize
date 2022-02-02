'use strict';

const _ = require('lodash');
const SqlString = require('../../sql-string');
const QueryTypes = require('../../query-types');
const Dot = require('dottie');
const deprecations = require('../../utils/deprecations');
const uuid = require('uuid').v4;

class AbstractQuery {

  constructor(connection, sequelize, options) {
    this.uuid = uuid();
    this.connection = connection;
    this.instance = options.instance;
    this.model = options.model;
    this.sequelize = sequelize;
    this.options = Object.assign({
      plain: false,
      raw: false,
      // eslint-disable-next-line no-console
      logging: console.log
    }, options || {});
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
   * @param {Object|Array} values
   * @param {string} dialect
   * @param {Function} [replacementFunc]
   * @param {Object} [options]
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

    sql = sql.replace(/\$(\$|\w+)/g, (match, key) => {
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
    throw new Error('The run method wasn\'t overwritten!');
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

      id = id || results && results[this.getInsertIdField()];
      id = id || metaData && metaData[this.getInsertIdField()];

      this.instance[autoIncrementAttribute] = id;
    }
  }

  isShowTablesQuery() {
    return this.options.type === QueryTypes.SHOWTABLES;
  }

  handleShowTablesQuery(results) {
    return _.flatten(results.map(resultSet => _.values(resultSet)));
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
      results = results.map(result => _.reduce(fieldMap, (result, name, field) => {
        if (result[field] !== undefined && name !== field) {
          result[name] = result[field];
          delete result[field];
        }
        return result;
      }, result));
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
      results = AbstractQuery._groupJoinData(results, {
        model: this.model,
        includeMap: this.options.includeMap,
        includeNames: this.options.includeNames
      }, {
        checkExisting: this.options.hasMultiAssociation
      });

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
   * @param {Array|Object} parameters
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
        paramStr = parameters.map(p=>JSON.stringify(p)).join(', ');
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
   * @param {Object} includeOptions
   * @param {Object} options
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

    /*
     * Author (MH) comment: This code is an unreadable mess, but it's performant.
     * groupJoinData is a performance critical function so we prioritize perf over readability.
     */
    if (!rows.length) {
      return [];
    }

    // Generic looping
    let i;
    let length;
    let $i;
    let $length;
    // Row specific looping
    let rowsI;
    let row;
    const rowsLength = rows.length;
    // Key specific looping
    let keys;
    let key;
    let keyI;
    let keyLength;
    let prevKey;
    let values;
    let topValues;
    let topExists;
    const checkExisting = options.checkExisting;
    // If we don't have to deduplicate we can pre-allocate the resulting array
    let itemHash;
    let parentHash;
    let topHash;
    const results = checkExisting ? [] : new Array(rowsLength);
    const resultMap = {};
    const includeMap = {};
    // Result variables for the respective functions
    let $keyPrefix;
    let $keyPrefixString;
    let $prevKeyPrefixString; // eslint-disable-line
    let $prevKeyPrefix;
    let $lastKeyPrefix;
    let $current;
    let $parent;
    // Map each key to an include option
    let previousPiece;
    const buildIncludeMap = piece => {
      if (Object.prototype.hasOwnProperty.call($current.includeMap, piece)) {
        includeMap[key] = $current = $current.includeMap[piece];
        if (previousPiece) {
          previousPiece = `${previousPiece}.${piece}`;
        } else {
          previousPiece = piece;
        }
        includeMap[previousPiece] = $current;
      }
    };
    // Calculate the string prefix of a key ('User.Results' for 'User.Results.id')
    const keyPrefixStringMemo = {};
    const keyPrefixString = (key, memo) => {
      if (!Object.prototype.hasOwnProperty.call(memo, key)) {
        memo[key] = key.substr(0, key.lastIndexOf('.'));
      }
      return memo[key];
    };
    // Removes the prefix from a key ('id' for 'User.Results.id')
    const removeKeyPrefixMemo = {};
    const removeKeyPrefix = key => {
      if (!Object.prototype.hasOwnProperty.call(removeKeyPrefixMemo, key)) {
        const index = key.lastIndexOf('.');
        removeKeyPrefixMemo[key] = key.substr(index === -1 ? 0 : index + 1);
      }
      return removeKeyPrefixMemo[key];
    };
    // Calculates the array prefix of a key (['User', 'Results'] for 'User.Results.id')
    const keyPrefixMemo = {};
    const keyPrefix = key => {
      // We use a double memo and keyPrefixString so that different keys with the same prefix will receive the same array instead of differnet arrays with equal values
      if (!Object.prototype.hasOwnProperty.call(keyPrefixMemo, key)) {
        const prefixString = keyPrefixString(key, keyPrefixStringMemo);
        if (!Object.prototype.hasOwnProperty.call(keyPrefixMemo, prefixString)) {
          keyPrefixMemo[prefixString] = prefixString ? prefixString.split('.') : [];
        }
        keyPrefixMemo[key] = keyPrefixMemo[prefixString];
      }
      return keyPrefixMemo[key];
    };
    // Calcuate the last item in the array prefix ('Results' for 'User.Results.id')
    const lastKeyPrefixMemo = {};
    const lastKeyPrefix = key => {
      if (!Object.prototype.hasOwnProperty.call(lastKeyPrefixMemo, key)) {
        const prefix = keyPrefix(key);
        const length = prefix.length;

        lastKeyPrefixMemo[key] = !length ? '' : prefix[length - 1];
      }
      return lastKeyPrefixMemo[key];
    };
    const getUniqueKeyAttributes = model => {
      let uniqueKeyAttributes = _.chain(model.uniqueKeys);
      uniqueKeyAttributes = uniqueKeyAttributes
        .result(`${uniqueKeyAttributes.findKey()}.fields`)
        .map(field => _.findKey(model.attributes, chr => chr.field === field))
        .value();

      return uniqueKeyAttributes;
    };
    const stringify = obj => obj instanceof Buffer ? obj.toString('hex') : obj;
    let primaryKeyAttributes;
    let uniqueKeyAttributes;
    let prefix;

    for (rowsI = 0; rowsI < rowsLength; rowsI++) {
      row = rows[rowsI];

      // Keys are the same for all rows, so only need to compute them on the first row
      if (rowsI === 0) {
        keys = Object.keys(row);
        keyLength = keys.length;
      }

      if (checkExisting) {
        topExists = false;

        // Compute top level hash key (this is usually just the primary key values)
        $length = includeOptions.model.primaryKeyAttributes.length;
        topHash = '';
        if ($length === 1) {
          topHash = stringify(row[includeOptions.model.primaryKeyAttributes[0]]);
        }
        else if ($length > 1) {
          for ($i = 0; $i < $length; $i++) {
            topHash += stringify(row[includeOptions.model.primaryKeyAttributes[$i]]);
          }
        }
        else if (!_.isEmpty(includeOptions.model.uniqueKeys)) {
          uniqueKeyAttributes = getUniqueKeyAttributes(includeOptions.model);
          for ($i = 0; $i < uniqueKeyAttributes.length; $i++) {
            topHash += row[uniqueKeyAttributes[$i]];
          }
        }
      }

      topValues = values = {};
      $prevKeyPrefix = undefined;
      for (keyI = 0; keyI < keyLength; keyI++) {
        key = keys[keyI];

        // The string prefix isn't actualy needed
        // We use it so keyPrefix for different keys will resolve to the same array if they have the same prefix
        // TODO: Find a better way?
        $keyPrefixString = keyPrefixString(key, keyPrefixStringMemo);
        $keyPrefix = keyPrefix(key);

        // On the first row we compute the includeMap
        if (rowsI === 0 && !Object.prototype.hasOwnProperty.call(includeMap, key)) {
          if (!$keyPrefix.length) {
            includeMap[key] = includeMap[''] = includeOptions;
          } else {
            $current = includeOptions;
            previousPiece = undefined;
            $keyPrefix.forEach(buildIncludeMap);
          }
        }
        // End of key set
        if ($prevKeyPrefix !== undefined && $prevKeyPrefix !== $keyPrefix) {
          if (checkExisting) {
            // Compute hash key for this set instance
            // TODO: Optimize
            length = $prevKeyPrefix.length;
            $parent = null;
            parentHash = null;

            if (length) {
              for (i = 0; i < length; i++) {
                prefix = $parent ? `${$parent}.${$prevKeyPrefix[i]}` : $prevKeyPrefix[i];
                primaryKeyAttributes = includeMap[prefix].model.primaryKeyAttributes;
                $length = primaryKeyAttributes.length;
                itemHash = prefix;
                if ($length === 1) {
                  itemHash += stringify(row[`${prefix}.${primaryKeyAttributes[0]}`]);
                }
                else if ($length > 1) {
                  for ($i = 0; $i < $length; $i++) {
                    itemHash += stringify(row[`${prefix}.${primaryKeyAttributes[$i]}`]);
                  }
                }
                else if (!_.isEmpty(includeMap[prefix].model.uniqueKeys)) {
                  uniqueKeyAttributes = getUniqueKeyAttributes(includeMap[prefix].model);
                  for ($i = 0; $i < uniqueKeyAttributes.length; $i++) {
                    itemHash += row[`${prefix}.${uniqueKeyAttributes[$i]}`];
                  }
                }
                if (!parentHash) {
                  parentHash = topHash;
                }

                itemHash = parentHash + itemHash;
                $parent = prefix;
                if (i < length - 1) {
                  parentHash = itemHash;
                }
              }
            } else {
              itemHash = topHash;
            }

            if (itemHash === topHash) {
              if (!resultMap[itemHash]) {
                resultMap[itemHash] = values;
              } else {
                topExists = true;
              }
            } else if (!resultMap[itemHash]) {
              $parent = resultMap[parentHash];
              $lastKeyPrefix = lastKeyPrefix(prevKey);

              if (includeMap[prevKey].association.isSingleAssociation) {
                if ($parent) {
                  $parent[$lastKeyPrefix] = resultMap[itemHash] = values;
                }
              } else {
                if (!$parent[$lastKeyPrefix]) {
                  $parent[$lastKeyPrefix] = [];
                }
                $parent[$lastKeyPrefix].push(resultMap[itemHash] = values);
              }
            }

            // Reset values
            values = {};
          } else {
            // If checkExisting is false it's because there's only 1:1 associations in this query
            // However we still need to map onto the appropriate parent
            // For 1:1 we map forward, initializing the value object on the parent to be filled in the next iterations of the loop
            $current = topValues;
            length = $keyPrefix.length;
            if (length) {
              for (i = 0; i < length; i++) {
                if (i === length - 1) {
                  values = $current[$keyPrefix[i]] = {};
                }
                $current = $current[$keyPrefix[i]] || {};
              }
            }
          }
        }

        // End of iteration, set value and set prev values (for next iteration)
        values[removeKeyPrefix(key)] = row[key];
        prevKey = key;
        $prevKeyPrefix = $keyPrefix;
        $prevKeyPrefixString = $keyPrefixString;
      }

      if (checkExisting) {
        length = $prevKeyPrefix.length;
        $parent = null;
        parentHash = null;

        if (length) {
          for (i = 0; i < length; i++) {
            prefix = $parent ? `${$parent}.${$prevKeyPrefix[i]}` : $prevKeyPrefix[i];
            primaryKeyAttributes = includeMap[prefix].model.primaryKeyAttributes;
            $length = primaryKeyAttributes.length;
            itemHash = prefix;
            if ($length === 1) {
              itemHash += stringify(row[`${prefix}.${primaryKeyAttributes[0]}`]);
            }
            else if ($length > 0) {
              for ($i = 0; $i < $length; $i++) {
                itemHash += stringify(row[`${prefix}.${primaryKeyAttributes[$i]}`]);
              }
            }
            else if (!_.isEmpty(includeMap[prefix].model.uniqueKeys)) {
              uniqueKeyAttributes = getUniqueKeyAttributes(includeMap[prefix].model);
              for ($i = 0; $i < uniqueKeyAttributes.length; $i++) {
                itemHash += row[`${prefix}.${uniqueKeyAttributes[$i]}`];
              }
            }
            if (!parentHash) {
              parentHash = topHash;
            }

            itemHash = parentHash + itemHash;
            $parent = prefix;
            if (i < length - 1) {
              parentHash = itemHash;
            }
          }
        } else {
          itemHash = topHash;
        }

        if (itemHash === topHash) {
          if (!resultMap[itemHash]) {
            resultMap[itemHash] = values;
          } else {
            topExists = true;
          }
        } else if (!resultMap[itemHash]) {
          $parent = resultMap[parentHash];
          $lastKeyPrefix = lastKeyPrefix(prevKey);

          if (includeMap[prevKey].association.isSingleAssociation) {
            if ($parent) {
              $parent[$lastKeyPrefix] = resultMap[itemHash] = values;
            }
          } else {
            if (!$parent[$lastKeyPrefix]) {
              $parent[$lastKeyPrefix] = [];
            }
            $parent[$lastKeyPrefix].push(resultMap[itemHash] = values);
          }
        }
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
