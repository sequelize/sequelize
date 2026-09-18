// Copyright (c) 2025, Oracle and/or its affiliates. All rights reserved

import { AbstractQueryInterface, QueryTypes } from '@sequelize/core';
import { isWhereEmpty } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/query-builder-utils.js';
import { assertNoReservedBind } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/sql.js';
import intersection from 'lodash/intersection.js';
import pick from 'lodash/pick.js';
import uniq from 'lodash/uniq.js';

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

    if (isWhereEmpty(where)) {
      const canIdentifyRow =
        options.upsertKeys.length > 0 &&
        options.upsertKeys.every(attribute => insertValues[attribute] != null);

      where = canIdentifyRow ? pick(insertValues, options.upsertKeys) : null;
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
