'use strict';

const DataTypes = require('../../data-types');
const QueryTypes = require('../../query-types');
const { QueryInterface } = require('../abstract/query-interface');
const Utils = require('../../utils');
const Deferrable = require('../../deferrable');

/**
 * The interface that Sequelize uses to talk with Postgres database
 */
class PostgresQueryInterface extends QueryInterface {
  /**
   * Ensure enum and their values.
   *
   * @param {string} tableName  Name of table to create
   * @param {object} attributes Object representing a list of normalized table attributes
   * @param {object} [options]
   * @param {Model}  [model]
   *
   * @protected
   */
  async ensureEnums(tableName, attributes, options, model) {
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
        sql = this.queryGenerator.pgListEnums(tableName, attribute.field || keys[i], options);
        promises.push(this.sequelize.query(
          sql,
          { ...options, plain: true, raw: true, type: QueryTypes.SELECT }
        ));
      }
    }

    const results = await Promise.all(promises);
    promises = [];
    let enumIdx = 0;

    // This little function allows us to re-use the same code that prepends or appends new value to enum array
    const addEnumValue = (field, value, relativeValue, position = 'before', spliceStart = promises.length) => {
      const valueOptions = { ...options };
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
        return this.sequelize.query(this.queryGenerator.pgEnumAdd(
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
            return this.sequelize.query(this.queryGenerator.pgEnum(tableName, field, enumType, options), { ...options, raw: true });
          });
        } else if (!!results[enumIdx] && !!model) {
          const enumVals = this.queryGenerator.fromArray(results[enumIdx].enum_value);
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

    const result = await promises
      .reduce(async (promise, asyncFunction) => await asyncFunction(await promise), Promise.resolve());

    // If ENUM processed, then refresh OIDs
    if (promises.length) {
      await this.sequelize.dialect.connectionManager._refreshDynamicOIDs();
    }
    return result;
  }

  /**
   * @override
   */
  async getForeignKeyReferencesForTable(table, options) {
    const queryOptions = {
      ...options,
      type: QueryTypes.FOREIGNKEYS
    };

    // postgres needs some special treatment as those field names returned are all lowercase
    // in order to keep same result with other dialects.
    const query = this.queryGenerator.getForeignKeyReferencesQuery(table.tableName || table, this.sequelize.config.database);
    const result = await this.sequelize.query(query, queryOptions);

    return result.map(fkMeta => {
      const { initiallyDeferred, isDeferrable, ...remaining } = Utils.camelizeObjectKeys(fkMeta);

      return {
        ...remaining,
        deferrable: isDeferrable === 'NO' ? Deferrable.NOT
          : initiallyDeferred === 'NO' ? Deferrable.INITIALLY_IMMEDIATE
            : Deferrable.INITIALLY_DEFERRED
      };
    });
  }

  /**
   * Drop specified enum from database (Postgres only)
   *
   * @param {string} [enumName]  Enum name to drop
   * @param {object} options Query options
   *
   * @returns {Promise}
   */
  async dropEnum(enumName, options) {
    options = options || {};

    return this.sequelize.query(
      this.queryGenerator.pgEnumDrop(null, null, this.queryGenerator.pgEscapeAndQuote(enumName)),
      { ...options, raw: true }
    );
  }

  /**
   * Drop all enums from database (Postgres only)
   *
   * @param {object} options Query options
   *
   * @returns {Promise}
   */
  async dropAllEnums(options) {
    options = options || {};

    const enums = await this.pgListEnums(null, options);

    return await Promise.all(enums.map(result => this.sequelize.query(
      this.queryGenerator.pgEnumDrop(null, null, this.queryGenerator.pgEscapeAndQuote(result.enum_name)),
      { ...options, raw: true }
    )));
  }

  /**
   * List all enums (Postgres only)
   *
   * @param {string} [tableName]  Table whose enum to list
   * @param {object} [options]    Query options
   *
   * @returns {Promise}
   */
  async pgListEnums(tableName, options) {
    options = options || {};
    const sql = this.queryGenerator.pgListEnums(tableName);
    return this.sequelize.query(sql, { ...options, plain: false, raw: true, type: QueryTypes.SELECT });
  }

  /**
   * Since postgres has a special case for enums, we should drop the related
   * enum type within the table and attribute
   *
   * @override
   */
  async dropTable(tableName, options) {
    await super.dropTable(tableName, options);
    const promises = [];
    const instanceTable = this.sequelize.modelManager.getModel(tableName, { attribute: 'tableName' });

    if (!instanceTable) {
      // Do nothing when model is not available
      return;
    }

    const getTableName = (!options || !options.schema || options.schema === 'public' ? '' : `${options.schema}_`) + tableName;

    const keys = Object.keys(instanceTable.rawAttributes);
    const keyLen = keys.length;

    for (let i = 0; i < keyLen; i++) {
      if (instanceTable.rawAttributes[keys[i]].type instanceof DataTypes.ENUM) {
        const sql = this.queryGenerator.pgEnumDrop(getTableName, keys[i]);
        options.supportsSearchPath = false;
        promises.push(this.sequelize.query(sql, { ...options, raw: true }));
      }
    }

    await Promise.all(promises);
  }
}

exports.PostgresQueryInterface = PostgresQueryInterface;
