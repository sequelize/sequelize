'use strict';

import NodeUtil from 'node:util';
import { QueryTypes } from '../enums';
import { AbstractDataType } from './data-types';

import findKey from 'lodash/findKey';
import isEmpty from 'lodash/isEmpty';
import reduce from 'lodash/reduce';

const Dot = require('dottie');
const deprecations = require('../utils/deprecations');
const crypto = require('node:crypto');

const uniqueKeyAttributesCache = new WeakMap();

const getUniqueKeyAttributes = model => {
  const cached = uniqueKeyAttributesCache.get(model);
  if (cached) {
    return cached;
  }

  const uniqueKeys = model.uniqueKeys;
  let uniqueKeyAttributes = [];

  if (!isEmpty(uniqueKeys)) {
    const [firstUniqueKeyName] = Object.keys(uniqueKeys);
    const uniqueKey = firstUniqueKeyName ? uniqueKeys[firstUniqueKeyName] : undefined;
    const fields = uniqueKey?.fields ?? [];

    uniqueKeyAttributes = fields.map(field =>
      findKey(model.attributes, attribute => attribute.field === field),
    );
  }

  uniqueKeyAttributesCache.set(model, uniqueKeyAttributes);

  return uniqueKeyAttributes;
};

export class AbstractQuery {
  constructor(connection, sequelize, options) {
    this.uuid = crypto.randomUUID();
    this.connection = connection;
    this.instance = options.instance;
    this.model = options.model;
    this.sequelize = sequelize;
    this.options = {
      plain: false,
      raw: false,
      logging: console.debug,
      ...options,
    };
    this.checkLoggingOption();

    if (options.rawErrors) {
      // The default implementation in AbstractQuery just returns the same
      // error object. By overidding this.formatError, this saves every dialect
      // having to check for options.rawErrors in their own formatError
      // implementations.
      this.formatError = AbstractQuery.prototype.formatError;
    }
  }

  async logWarnings(results) {
    const warningResults = await this.run('SHOW WARNINGS');
    const warningMessage = `${this.sequelize.dialect.name} warnings (${this.connection.uuid || 'default'}): `;
    const messages = [];
    for (const _warningRow of warningResults) {
      if (_warningRow === undefined || typeof _warningRow[Symbol.iterator] !== 'function') {
        continue;
      }

      for (const _warningResult of _warningRow) {
        if (Object.hasOwn(_warningResult, 'Message')) {
          messages.push(_warningResult.Message);
        } else {
          for (const _objectKey of _warningResult.keys()) {
            messages.push([_objectKey, _warningResult[_objectKey]].join(': '));
          }
        }
      }
    }

    this.sequelize.log(warningMessage + messages.join('; '), this.options);

    return results;
  }

  /**
   * Formats a raw database error from the database library into a common Sequelize exception.
   *
   * @param {Error} error The exception object.
   * @param {object} errStack The stack trace that started the database query.
   * @returns {BaseError} the new formatted error object.
   */
  formatError(error, errStack) {
    // Default implementation, no formatting.
    // Each dialect overrides this method to parse errors from their respective the database engines.
    error.stack = errStack;

    return error;
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
      this.options.logging = console.debug;
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
    if (!field) {
      return 'Must be unique';
    }

    const message = `${field} must be unique`;

    if (!this.model) {
      return message;
    }

    for (const index of this.model.getIndexes()) {
      if (!index.unique) {
        continue;
      }

      if (index.fields.includes(field.replaceAll('"', '')) && index.msg) {
        return index.msg;
      }
    }

    return message;
  }

  isRawQuery() {
    return this.options.type === QueryTypes.RAW;
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
    result &&= this.sql.toLowerCase().startsWith('insert into');

    // is insert query if no results are passed or if the result has the inserted id
    result &&= !results || Object.hasOwn(results, this.getInsertIdField());

    // is insert query if no metadata are passed or if the metadata has the inserted id
    result &&= !metaData || Object.hasOwn(metaData, this.getInsertIdField());

    return result;
  }

  handleInsertQuery(results, metaData) {
    if (!this.instance) {
      return;
    }

    const autoIncrementAttribute = this.model.modelDefinition.autoIncrementAttributeName;
    const id = results?.[this.getInsertIdField()] ?? metaData?.[this.getInsertIdField()] ?? null;

    this.instance[autoIncrementAttribute] = id;
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

  isDeleteQuery() {
    return this.options.type === QueryTypes.DELETE;
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
        reduce(
          fieldMap,
          (result, name, field) => {
            if (result[field] !== undefined && name !== field) {
              result[name] = result[field];
              delete result[field];
            }

            return result;
          },
          result,
        ),
      );
    }

    // Raw queries
    if (this.options.raw) {
      result = results.map(result => {
        let o = {};

        for (const key in result) {
          if (Object.hasOwn(result, key)) {
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
          includeNames: this.options.includeNames,
        },
        {
          checkExisting: this.options.hasMultiAssociation,
        },
      );

      result = this.model.bulkBuild(
        this._parseDataArrayByType(results, this.model, this.options.includeMap),
        {
          isNewRecord: false,
          include: this.options.include,
          includeNames: this.options.includeNames,
          includeMap: this.options.includeMap,
          includeValidated: true,
          attributes: this.options.originalAttributes || this.options.attributes,
          raw: true,
          comesFromDatabase: true,
        },
      );
      // Regular queries
    } else {
      result = this.model.bulkBuild(
        this._parseDataArrayByType(results, this.model, this.options.includeMap),
        {
          isNewRecord: false,
          raw: true,
          comesFromDatabase: true,
          attributes: this.options.originalAttributes || this.options.attributes,
        },
      );
    }

    // return the first real model instance if options.plain is set (e.g. Model.find)
    if (this.options.plain) {
      result = result.length === 0 ? null : result[0];
    }

    return result;
  }

  /**
   * Calls {@link DataTypes.ABSTRACT#parseDatabaseValue} on all attributes returned by the database, if a model is specified.
   *
   * This method mutates valueArrays.
   *
   * @param {Array} valueArrays The values to parse
   * @param {Model} model The model these values belong to
   * @param {object} includeMap The list of included associations
   */
  _parseDataArrayByType(valueArrays, model, includeMap) {
    for (const values of valueArrays) {
      this._parseDataByType(values, model, includeMap);
    }

    return valueArrays;
  }

  _parseDataByType(values, model, includeMap) {
    for (const key of Object.keys(values)) {
      // parse association values
      // hasOwnProperty is very important here. An include could be called "toString"
      if (includeMap && Object.hasOwn(includeMap, key)) {
        if (Array.isArray(values[key])) {
          values[key] = this._parseDataArrayByType(
            values[key],
            includeMap[key].model,
            includeMap[key].includeMap,
          );
        } else {
          values[key] = this._parseDataByType(
            values[key],
            includeMap[key].model,
            includeMap[key].includeMap,
          );
        }

        continue;
      }

      const attribute = model?.modelDefinition.attributes.get(key);
      values[key] = this._parseDatabaseValue(values[key], attribute?.type);
    }

    return values;
  }

  _parseDatabaseValue(value, attributeType) {
    if (value == null) {
      return value;
    }

    if (!attributeType || !(attributeType instanceof AbstractDataType)) {
      return value;
    }

    return attributeType.parseDatabaseValue(value);
  }

  isShowOrDescribeQuery() {
    let result = false;

    result ||= this.sql.toLowerCase().startsWith('show');
    result ||= this.sql.toLowerCase().startsWith('describe');

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
    const logQueryParameters =
      this.sequelize.options.logQueryParameters || options.logQueryParameters;
    const startTime = Date.now();
    let logParameter = '';

    if (logQueryParameters && parameters) {
      const delimiter = sql.endsWith(';') ? '' : ';';

      logParameter = `${delimiter} with parameters ${NodeUtil.inspect(parameters)}`;
    }

    const fmt = `(${connection.uuid || 'default'}): ${sql}${logParameter}`;
    const queryLabel = options.queryLabel ? `${options.queryLabel}\n` : '';
    const msg = `${queryLabel}Executing ${fmt}`;
    debugContext(msg);
    if (!benchmark) {
      this.sequelize.log(`${queryLabel}Executing ${fmt}`, options);
    }

    return () => {
      const afterMsg = `${queryLabel}Executed ${fmt}`;
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

    /*
     * Author (MH) comment: This code is an unreadable mess, but it's performant.
     * groupJoinData is a performance critical function so we prioritize perf over readability.
     */
    if (rows.length === 0) {
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
    let keyMeta;
    let prefixMeta;
    let meta;
    let prevMeta;
    let values;
    let topValues;
    let topExists;
    const checkExisting = options.checkExisting;
    // If we don't have to deduplicate we can pre-allocate the resulting array
    let itemHash;
    let parentHash;
    let topHash;
    const results = checkExisting ? [] : Array.from({ length: rowsLength });
    const resultMap = {};
    const includeMap = {};
    // Result variables for the respective functions
    let $current;
    let $parent;
    let prefixHashCache;
    let getHashesForPrefix;
    // Map each key to an include option
    // sort the array by the level of their depth calculated by dot.
    const sortByDepth = keys => keys.sort((a, b) => a.split('.').length - b.split('.').length);

    const stringify = obj => (obj instanceof Buffer ? obj.toString('hex') : obj);
    let primaryKeyAttributes;
    let uniqueKeyAttributes;

    for (rowsI = 0; rowsI < rowsLength; rowsI++) {
      row = rows[rowsI];

      // Keys are the same for all rows, so only need to compute them on the first row
      if (rowsI === 0) {
        keys = sortByDepth(Object.keys(row));
        keyLength = keys.length;
        keyMeta = [];
        prefixMeta = new Map();
        const prefixPartsCache = new Map();

        for (const rawKey of keys) {
          const lastDotIndex = rawKey.lastIndexOf('.');
          const prefixId = lastDotIndex === -1 ? '' : rawKey.slice(0, lastDotIndex);
          let prefixParts = prefixPartsCache.get(prefixId);
          if (!prefixParts) {
            prefixParts = prefixId ? prefixId.split('.') : [];
            prefixPartsCache.set(prefixId, prefixParts);
          }

          const prefixLength = prefixParts.length;
          const attribute = lastDotIndex === -1 ? rawKey : rawKey.slice(lastDotIndex + 1);
          const lastKeySegment = prefixLength ? prefixParts[prefixLength - 1] : '';

          if (!Object.hasOwn(includeMap, rawKey)) {
            if (prefixLength === 0) {
              includeMap[rawKey] = includeOptions;
              includeMap[''] = includeOptions;
            } else {
              let currentInclude = includeOptions;
              let previousPiece;
              let resolvedInclude;

              for (const piece of prefixParts) {
                if (!Object.hasOwn(currentInclude.includeMap, piece)) {
                  resolvedInclude = undefined;
                  break;
                }

                currentInclude = currentInclude.includeMap[piece];
                resolvedInclude = currentInclude;
                previousPiece = previousPiece ? `${previousPiece}.${piece}` : piece;
                includeMap[previousPiece] = currentInclude;
              }

              if (resolvedInclude) {
                includeMap[rawKey] = resolvedInclude;
              }
            }
          }

          const includeForKey = includeMap[rawKey];
          const parentPrefixId =
            prefixLength === 0
              ? ''
              : prefixId.slice(0, Math.max(0, prefixId.lastIndexOf('.'))) || '';
          const primaryKeyAttributes = includeForKey?.model.primaryKeyAttributes ?? [];
          const hasUniqueKeys = includeForKey ? !isEmpty(includeForKey.model.uniqueKeys) : false;
          const uniqueKeyAttributes = hasUniqueKeys
            ? getUniqueKeyAttributes(includeForKey.model)
            : [];

          const metaEntry = {
            key: rawKey,
            attribute,
            prefixParts,
            prefixLength,
            prefixId,
            lastKeySegment,
            include: includeForKey,
            parentPrefixId,
            primaryKeyAttributes,
            uniqueKeyAttributes,
          };

          keyMeta.push(metaEntry);

          if (!prefixMeta.has(prefixId)) {
            prefixMeta.set(prefixId, metaEntry);
          }
        }
      }

      if (checkExisting) {
        topExists = false;

        // Compute top level hash key (this is usually just the primary key values)
        $length = includeOptions.model.primaryKeyAttributes.length;
        topHash = '';
        if ($length === 1) {
          topHash = stringify(row[includeOptions.model.primaryKeyAttributes[0]]);
        } else if ($length > 1) {
          for ($i = 0; $i < $length; $i++) {
            topHash += stringify(row[includeOptions.model.primaryKeyAttributes[$i]]);
          }
        } else if (!isEmpty(includeOptions.model.uniqueKeys)) {
          uniqueKeyAttributes = getUniqueKeyAttributes(includeOptions.model);
          for ($i = 0; $i < uniqueKeyAttributes.length; $i++) {
            topHash += row[uniqueKeyAttributes[$i]];
          }
        }

        // Memoize prefix hashes per row so nested lookups reuse the same computed string
        prefixHashCache = new Map();
        const topHashEntry = { itemHash: topHash, parentHash: null };
        prefixHashCache.set('', topHashEntry);
        getHashesForPrefix = prefix => {
          if (prefix === '') {
            return topHashEntry;
          }

          let cached = prefixHashCache.get(prefix);
          if (cached) {
            return cached;
          }

          const include = includeMap[prefix];
          const prefixInfo = prefixMeta.get(prefix);
          primaryKeyAttributes = prefixInfo
            ? prefixInfo.primaryKeyAttributes
            : include.model.primaryKeyAttributes;
          let hash = prefix;
          $length = primaryKeyAttributes.length;

          if ($length === 1) {
            hash += stringify(row[`${prefix}.${primaryKeyAttributes[0]}`]);
          } else if ($length > 1) {
            for ($i = 0; $i < $length; $i++) {
              hash += stringify(row[`${prefix}.${primaryKeyAttributes[$i]}`]);
            }
          } else {
            uniqueKeyAttributes = prefixInfo ? prefixInfo.uniqueKeyAttributes : [];
            if (!uniqueKeyAttributes.length && !prefixInfo && !isEmpty(include.model.uniqueKeys)) {
              uniqueKeyAttributes = getUniqueKeyAttributes(include.model);
            }

            for ($i = 0; $i < uniqueKeyAttributes.length; $i++) {
              hash += row[`${prefix}.${uniqueKeyAttributes[$i]}`];
            }
          }

          const parentPrefixIndex = prefix.lastIndexOf('.');
          const parentPrefix = parentPrefixIndex === -1 ? '' : prefix.slice(0, parentPrefixIndex);
          const parentHashes = getHashesForPrefix(parentPrefix);
          const parentHashValue = parentHashes.itemHash;

          cached = {
            itemHash: parentHashValue + hash,
            parentHash: parentHashValue,
          };
          prefixHashCache.set(prefix, cached);

          return cached;
        };
      }

      topValues = values = {};
      prevMeta = undefined;
      for (keyI = 0; keyI < keyLength; keyI++) {
        key = keys[keyI];
        meta = keyMeta[keyI];

        // End of key set
        if (prevMeta && prevMeta.prefixParts !== meta.prefixParts) {
          if (checkExisting) {
            // Compute hash key for this set instance
            length = prevMeta.prefixLength;
            parentHash = null;
            if (length) {
              const hashes = getHashesForPrefix(prevMeta.prefixId);

              itemHash = hashes.itemHash;
              parentHash = hashes.parentHash;
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
              const lastKeySegment = prevMeta.lastKeySegment;

              if (prevMeta.include.association.isSingleAssociation) {
                if ($parent) {
                  $parent[lastKeySegment] = resultMap[itemHash] = values;
                }
              } else {
                if (!$parent[lastKeySegment]) {
                  $parent[lastKeySegment] = [];
                }

                $parent[lastKeySegment].push((resultMap[itemHash] = values));
              }
            }

            // Reset values
            values = {};
          } else {
            // If checkExisting is false it's because there's only 1:1 associations in this query
            // However we still need to map onto the appropriate parent
            // For 1:1 we map forward, initializing the value object on the parent to be filled in the next iterations of the loop
            $current = topValues;
            length = meta.prefixLength;
            if (length) {
              const prefixParts = meta.prefixParts;
              for (const part of prefixParts) {
                if (i === length - 1) {
                  values = $current[part] = {};
                }

                $current = $current[part] || {};
              }
            }
          }
        }

        // End of iteration, set value and set prev values (for next iteration)
        values[meta.attribute] = row[key];
        prevMeta = meta;
      }

      if (checkExisting) {
        length = prevMeta.prefixLength;
        $parent = null;
        parentHash = null;

        if (length) {
          const hashes = getHashesForPrefix(prevMeta.prefixId);

          itemHash = hashes.itemHash;
          parentHash = hashes.parentHash;
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
          const $lastKeyPrefix = prevMeta.lastKeySegment;

          if (prevMeta.include.association.isSingleAssociation) {
            if ($parent) {
              $parent[$lastKeyPrefix] = resultMap[itemHash] = values;
            }
          } else {
            if (!$parent[$lastKeyPrefix]) {
              $parent[$lastKeyPrefix] = [];
            }

            $parent[$lastKeyPrefix].push((resultMap[itemHash] = values));
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
