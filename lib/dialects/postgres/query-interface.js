'use strict';

const DataTypes = require('../../data-types');
const Promise = require('../../promise');
const QueryTypes = require('../../query-types');
const _ = require('lodash');


/**
 Returns an object that handles Postgres special needs to do certain queries.

 @class QueryInterface
 @static
 @private
 */

/**
   * Ensure enum and their values.
   *
   * @param {QueryInterface} qi
   * @param {string} tableName  Name of table to create
   * @param {Object} attributes Object representing a list of normalized table attributes
   * @param {Object} [options]
   * @param {Model}  [model]
   *
   * @returns {Promise}
   * @private
   */
function ensureEnums(qi, tableName, attributes, options, model) {
  const keys = Object.keys(attributes);
  const keyLen = keys.length;

  let sql = '';
  let promises = [];
  let i = 0;

  for (i = 0; i < keyLen; i++) {
    const attribute = attributes[keys[i]];
    const type = attribute.type;

    if (
      type instanceof DataTypes.ENUM ||
      type instanceof DataTypes.ARRAY && type.type instanceof DataTypes.ENUM //ARRAY sub type is ENUM
    ) {
      sql = qi.QueryGenerator.pgListEnums(tableName, attribute.field || keys[i], options);
      promises.push(qi.sequelize.query(
        sql,
        Object.assign({}, options, { plain: true, raw: true, type: QueryTypes.SELECT })
      ));
    }
  }

  return Promise.all(promises).then(results => {
    promises = [];
    let enumIdx = 0;

    // This little function allows us to re-use the same code that prepends or appends new value to enum array
    const addEnumValue = (field, value, relativeValue, position = 'before', spliceStart = promises.length) => {
      const valueOptions = _.clone(options);
      valueOptions.before = null;
      valueOptions.after = null;

      switch (position) {
        case 'after':
          valueOptions.after = relativeValue;
          break;
        case 'before':
        default:
          valueOptions.before = relativeValue;
          break;
      }

      promises.splice(spliceStart, 0, () => {
        return qi.sequelize.query(qi.QueryGenerator.pgEnumAdd(
          tableName, field, value, valueOptions
        ), valueOptions);
      });
    };

    for (i = 0; i < keyLen; i++) {
      const attribute = attributes[keys[i]];
      const type = attribute.type;
      const enumType = type.type || type;
      const field = attribute.field || keys[i];

      if (
        type instanceof DataTypes.ENUM ||
        type instanceof DataTypes.ARRAY && enumType instanceof DataTypes.ENUM //ARRAY sub type is ENUM
      ) {
        // If the enum type doesn't exist then create it
        if (!results[enumIdx]) {
          promises.push(() => {
            return qi.sequelize.query(qi.QueryGenerator.pgEnum(tableName, field, enumType, options), Object.assign({}, options, { raw: true }));
          });
        } else if (!!results[enumIdx] && !!model) {
          const enumVals = qi.QueryGenerator.fromArray(results[enumIdx].enum_value);
          const vals = enumType.values;

          // Going through already existing values allows us to make queries that depend on those values
          // We will prepend all new values between the old ones, but keep in mind - we can't change order of already existing values
          // Then we append the rest of new values AFTER the latest already existing value
          // E.g.: [1,2] -> [0,2,1] ==> [1,0,2]
          // E.g.: [1,2,3] -> [2,1,3,4] ==> [1,2,3,4]
          // E.g.: [1] -> [0,2,3] ==> [1,0,2,3]
          let lastOldEnumValue;
          let rightestPosition = -1;
          for (let oldIndex = 0; oldIndex < enumVals.length; oldIndex++) {
            const enumVal = enumVals[oldIndex];
            const newIdx = vals.indexOf(enumVal);
            lastOldEnumValue = enumVal;

            if (newIdx === -1) {
              continue;
            }

            const newValuesBefore = vals.slice(0, newIdx);
            const promisesLength = promises.length;
            // we go in reverse order so we could stop when we meet old value
            for (let reverseIdx = newValuesBefore.length - 1; reverseIdx >= 0; reverseIdx--) {
              if (~enumVals.indexOf(newValuesBefore[reverseIdx])) {
                break;
              }

              addEnumValue(field, newValuesBefore[reverseIdx], lastOldEnumValue, 'before', promisesLength);
            }

            // we detect the most 'right' position of old value in new enum array so we can append new values to it
            if (newIdx > rightestPosition) {
              rightestPosition = newIdx;
            }
          }

          if (lastOldEnumValue && rightestPosition < vals.length - 1) {
            const remainingEnumValues = vals.slice(rightestPosition + 1);
            for (let reverseIdx = remainingEnumValues.length - 1; reverseIdx >= 0; reverseIdx--) {
              addEnumValue(field, remainingEnumValues[reverseIdx], lastOldEnumValue, 'after');
            }
          }

          enumIdx++;
        }
      }
    }

    return promises
      .reduce((promise, asyncFunction) => promise.then(asyncFunction), Promise.resolve())
      .tap(() => {
        // If ENUM processed, then refresh OIDs
        if (promises.length) {
          return qi.sequelize.dialect.connectionManager._refreshDynamicOIDs();
        }
      });
  });
}


exports.ensureEnums = ensureEnums;
