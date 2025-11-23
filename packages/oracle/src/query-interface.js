// Copyright (c) 2025, Oracle and/or its affiliates. All rights reserved

import { AbstractQueryInterface, QueryTypes } from '@sequelize/core';
import { assertNoReservedBind } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/sql.js';

const intersection = require('lodash/intersection');
const uniq = require('lodash/uniq');

export class OracleQueryInterface extends AbstractQueryInterface {
  async upsert(tableName, insertValues, updateValues, where, options) {
    if (options.bind) {
      assertNoReservedBind(options.bind);
    }

    options = { ...options };

    const model = options.model;
    const primaryKeys = Object.values(model.primaryKeys).map(item => item.field);
    const uniqueKeys = Object.values(model.uniqueKeys)
      .filter(c => c.fields.length > 0)
      .map(c => c.fields);
    const indexKeys = Object.values(model.getIndexes())
      .filter(c => c.unique && c.fields.length > 0)
      .map(c => c.fields);

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
      options.upsertKeys.length === 0 ||
      intersection(options.updateOnDuplicate, primaryKeys).length
    ) {
      options.upsertKeys = primaryKeys;
    }

    options.upsertKeys = uniq(options.upsertKeys);

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

    if (typeof tableName === 'object') {
      tableName = tableName.tableName;
    }

    const sql = this.queryGenerator.upsertQuery(
      tableName,
      insertValues,
      updateValues,
      where,
      model,
      options,
    );
    // we need set this to undefined otherwise sequelize would raise an error
    // Error: Both `sql.bind` and `options.bind` cannot be set at the same time
    if (sql.bind) {
      options.bind = undefined;
    }

    return await this.sequelize.query(sql, options);
  }
}
