'use strict';

import { isWhereEmpty } from '../../utils/query-builder-utils';
import { assertNoReservedBind } from '../../utils/sql';

const _ = require('lodash');

const { QueryTypes } = require('../../query-types');
const { Op } = require('../../operators');
const { AbstractQueryInterface } = require('../abstract/query-interface');

/**
 * The interface that Sequelize uses to talk with MSSQL database
 */
export class MsSqlQueryInterface extends AbstractQueryInterface {
  /**
  * A wrapper that fixes MSSQL's inability to cleanly remove columns from existing tables if they have a default constraint.
  *
  * @override
  */
  async removeColumn(tableName, attributeName, options) {
    options = { raw: true, ...options };

    const findConstraintSql = this.queryGenerator.getDefaultConstraintQuery(tableName, attributeName);
    const [results0] = await this.sequelize.queryRaw(findConstraintSql, options);
    if (results0.length > 0) {
      // No default constraint found -- we can cleanly remove the column
      const dropConstraintSql = this.queryGenerator.dropConstraintQuery(tableName, results0[0].name);
      await this.sequelize.queryRaw(dropConstraintSql, options);
    }

    const findForeignKeySql = this.queryGenerator.getForeignKeyQuery(tableName, attributeName);
    const [results] = await this.sequelize.queryRaw(findForeignKeySql, options);
    if (results.length > 0) {
      // No foreign key constraints found, so we can remove the column
      const dropForeignKeySql = this.queryGenerator.dropForeignKeyQuery(tableName, results[0].constraint_name);
      await this.sequelize.queryRaw(dropForeignKeySql, options);
    }

    // Check if the current column is a primaryKey
    const primaryKeyConstraintSql = this.queryGenerator.getPrimaryKeyConstraintQuery(tableName, attributeName);
    const [result] = await this.sequelize.queryRaw(primaryKeyConstraintSql, options);
    if (result.length > 0) {
      const dropConstraintSql = this.queryGenerator.dropConstraintQuery(tableName, result[0].constraintName);
      await this.sequelize.queryRaw(dropConstraintSql, options);
    }

    const removeSql = this.queryGenerator.removeColumnQuery(tableName, attributeName);

    return this.sequelize.queryRaw(removeSql, options);
  }

  /**
    * @override
    */
  async bulkInsert(tableName, records, options, attributes) {
    // If more than 1,000 rows are inserted outside of a transaction, we can't guarantee safe rollbacks.
    // See https://github.com/sequelize/sequelize/issues/15426
    if (records.length > 1000 && !options.transaction) {
      throw new Error(`MSSQL doesn't allow for inserting more than 1,000 rows at a time, so Sequelize executes the insert as multiple queries. Please run this in a transaction to ensure safe rollbacks`);
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
    const uniqueColumnNames = Object.values(model.getIndexes()).filter(c => c.unique && c.fields.length > 0).map(c => c.fields);

    const attributes = Object.keys(insertValues);
    for (const index of uniqueColumnNames) {
      if (_.intersection(attributes, index).length === index.length) {
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

    const sql = this.queryGenerator.upsertQuery(tableName, insertValues, updateValues, where, model, options);

    // unlike bind, replacements are handled by QueryGenerator, not QueryRaw, and queryRaw will throw if we use the option
    delete options.replacements;

    return await this.sequelize.queryRaw(sql, options);
  }
}
