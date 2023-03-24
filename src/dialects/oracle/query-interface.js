// Copyright (c) 2022, Oracle and/or its affiliates. All rights reserved

'use strict';
const { QueryInterface } = require('../abstract/query-interface');
const QueryTypes = require('../../query-types');

const _ = require('lodash');
/**
 * The interface that Sequelize uses to talk with Oracle database
 */
export class OracleQueryInterface extends QueryInterface {

  /**
   * Upsert
   *
   * @param {string} tableName    table to upsert on
   * @param {object} insertValues values to be inserted, mapped to field name
   * @param {object} updateValues values to be updated, mapped to field name
   * @param {object} where        where conditions, which can be used for UPDATE part when INSERT fails
   * @param {object} options      query options
   *
   * @returns {Promise<boolean,?number>} Resolves an array with <created, primaryKey>
   */
  async upsert(tableName, insertValues, updateValues, where, options) {
    options = { ...options };

    const model = options.model;
    const primaryKeys = Object.values(model.primaryKeys).map(item => item.field);
    const uniqueKeys = Object.values(model.uniqueKeys).filter(c => c.fields.length > 0).map(c => c.fields);
    const indexKeys = Object.values(model._indexes).filter(c => c.unique && c.fields.length > 0).map(c => c.fields);

    options.type = QueryTypes.UPSERT;
    options.updateOnDuplicate = Object.keys(updateValues);
    options.upsertKeys = [];

    // For fields in updateValues, try to find a constraint or unique index
    // that includes given field. Only first matching upsert key is used.
    for (const field of options.updateOnDuplicate) {
      const uniqueKey = uniqueKeys.find(fields => fields.includes(field));
      if (uniqueKey) {
        options.upsertKeys = uniqueKey;
        break;
      }

      const indexKey = indexKeys.find(fields => fields.includes(field));
      if (indexKey) {
        options.upsertKeys = indexKey;
        break;
      }
    }

    // Always use PK, if no constraint available OR update data contains PK
    if (
      options.upsertKeys.length === 0
      || _.intersection(options.updateOnDuplicate, primaryKeys).length
    ) {
      options.upsertKeys = primaryKeys;
    }

    options.upsertKeys = _.uniq(options.upsertKeys);

    let whereHasNull = false;

    primaryKeys.forEach(element => {
      if (where[element] === null) {
        whereHasNull = true;
      }
    });

    if (whereHasNull === true) {
      where = options.upsertKeys.reduce((result, attribute) => {
        result[attribute] = insertValues[attribute];
        return result;
      }, {}); 
    }

    const sql = this.queryGenerator.upsertQuery(tableName, insertValues, updateValues, where, model, options);
    // we need set this to undefined otherwise sequelize would raise an error
    // Error: Both `sql.bind` and `options.bind` cannot be set at the same time
    if (sql.bind) {
      options.bind = undefined;
    }
    return await this.sequelize.query(sql, options);
  }
}
