'use strict';

import { Op, QueryTypes } from '@sequelize/core';
import { isWhereEmpty } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/query-builder-utils.js';
import { assertNoReservedBind } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/sql.js';
import intersection from 'lodash/intersection';
import { MsSqlQueryInterfaceTypescript } from './query-interface-typescript.internal.js';

/**
 * The interface that Sequelize uses to talk with MSSQL database
 */
export class MsSqlQueryInterface extends MsSqlQueryInterfaceTypescript {
  /**
   * A wrapper that fixes MSSQL's inability to cleanly remove columns from existing tables if they have a default constraint.
   *
   * @override
   */
  async removeColumn(tableName, columnName, options) {
    const allConstraints = await this.showConstraints(tableName, { ...options, columnName });
    const constraints = allConstraints.filter(constraint =>
      ['DEFAULT', 'FOREIGN KEY', 'PRIMARY KEY'].includes(constraint.constraintType),
    );
    await Promise.all(
      constraints.map(constraint =>
        this.removeConstraint(tableName, constraint.constraintName, options),
      ),
    );

    await super.removeColumn(tableName, columnName, options);
  }

  /**
   * @override
   */
  async bulkInsert(tableName, records, options, attributes) {
    // If more than 1,000 rows are inserted outside of a transaction, we can't guarantee safe rollbacks.
    // See https://github.com/sequelize/sequelize/issues/15426
    if (records.length > 1000 && !options.transaction) {
      throw new Error(
        `MSSQL doesn't allow for inserting more than 1,000 rows at a time, so Sequelize executes the insert as multiple queries. Please run this in a transaction to ensure safe rollbacks`,
      );
    }

    return super.bulkInsert(tableName, records, options, attributes);
  }

  /**
   * @override
   */
  async upsert(tableName, insertValues, updateValues, where, options) {
    if (options.bind) {
      assertNoReservedBind(options.bind);
    }

    const model = options.model;
    const wheres = [];

    options = { ...options };

    if (!isWhereEmpty(where)) {
      wheres.push(where);
    }

    // Lets combine unique keys and indexes into one
    const uniqueColumnNames = Object.values(model.getIndexes())
      .filter(c => c.unique && c.fields.length > 0)
      .map(c => c.fields);

    const attributes = Object.keys(insertValues);
    for (const index of uniqueColumnNames) {
      if (intersection(attributes, index).length === index.length) {
        where = {};
        for (const field of index) {
          where[field] = insertValues[field];
        }

        wheres.push(where);
      }
    }

    where = { [Op.or]: wheres };

    options.type = QueryTypes.UPSERT;
    options.raw = true;

    const sql = this.queryGenerator.upsertQuery(
      tableName,
      insertValues,
      updateValues,
      where,
      model,
      options,
    );

    // unlike bind, replacements are handled by QueryGenerator, not QueryRaw, and queryRaw will throw if we use the option
    delete options.replacements;

    return await this.sequelize.queryRaw(sql, options);
  }
}
