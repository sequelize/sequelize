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

    for (i = 0; i < keyLen; i++) {
      const attribute = attributes[keys[i]];
      const type = attribute.type;
      const enumType = type.type || type;

      if (
        type instanceof DataTypes.ENUM ||
        type instanceof DataTypes.ARRAY && enumType instanceof DataTypes.ENUM //ARRAY sub type is ENUM
      ) {
        // If the enum type doesn't exist then create it
        if (!results[enumIdx]) {
          sql = qi.QueryGenerator.pgEnum(tableName, attribute.field || keys[i], enumType, options);
          promises.push(qi.sequelize.query(
            sql,
            Object.assign({}, options, { raw: true })
          ));
        } else if (!!results[enumIdx] && !!model) {
          const enumVals = qi.QueryGenerator.fromArray(results[enumIdx].enum_value);
          const vals = enumType.values;

          vals.forEach((value, idx) => {
            // reset out after/before options since it's for every enum value
            const valueOptions = _.clone(options);
            valueOptions.before = null;
            valueOptions.after = null;

            if (!enumVals.includes(value)) {
              if (vals[idx + 1]) {
                valueOptions.before = vals[idx + 1];
              }
              else if (vals[idx - 1]) {
                valueOptions.after = vals[idx - 1];
              }
              valueOptions.supportsSearchPath = false;
              promises.push(qi.sequelize.query(qi.QueryGenerator.pgEnumAdd(tableName, attribute.field || keys[i], value, valueOptions), valueOptions));
            }
          });
          enumIdx++;
        }
      }
    }

    return Promise.all(promises)
      .tap(() => {
        // If ENUM processed, then refresh OIDs
        if (promises.length) {
          return qi.sequelize.dialect.connectionManager._refreshDynamicOIDs();
        }
      });
  });
}


exports.ensureEnums = ensureEnums;
