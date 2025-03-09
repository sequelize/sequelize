'use strict';

import { Op, QueryTypes } from '@sequelize/core';
import { isWhereEmpty } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/query-builder-utils.js';
import { assertNoReservedBind } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/sql.js';
import clone from 'lodash/clone';
import intersection from 'lodash/intersection';
import isPlainObject from 'lodash/isPlainObject';
import { Db2QueryInterfaceTypeScript } from './query-interface-typescript.internal';

/**
 * The interface that Sequelize uses to talk with Db2 database
 */
export class Db2QueryInterface extends Db2QueryInterfaceTypeScript {
  async upsert(tableName, insertValues, updateValues, where, options) {
    if (options.bind) {
      assertNoReservedBind(options.bind);
    }

    options = { ...options };

    const model = options.model;
    const wheres = [];
    const attributes = Object.keys(insertValues);
    let indexFields;

    options = clone(options);

    if (!isWhereEmpty(where)) {
      wheres.push(where);
    }

    // Lets combine unique keys and indexes into one
    const indexes = [];

    for (const value of model.getIndexes()) {
      if (value.unique) {
        // fields in the index may both the strings or objects with an attribute property - lets sanitize that
        indexFields = value.fields.map(field => {
          if (isPlainObject(field)) {
            return field.attribute;
          }

          return field;
        });
        indexes.push(indexFields);
      }
    }

    for (const index of indexes) {
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

    delete options.replacements;

    return this.sequelize.queryRaw(sql, options);
  }

  async addConstraint(tableName, options) {
    try {
      await super.addConstraint(tableName, options);
    } catch (error) {
      if (!error.cause) {
        throw error;
      }

      // Operation not allowed for reason code "7" on table "DB2INST1.users".  SQLSTATE=57007
      if (error.cause.sqlcode !== -668 || error.cause.state !== '57007') {
        throw error;
      }

      // https://www.ibm.com/support/pages/how-verify-and-resolve-sql0668n-reason-code-7-when-accessing-table
      await this.executeTableReorg(tableName);
      await super.addConstraint(tableName, options);
    }
  }

  /**
   * DB2 can put tables in the "reorg pending" state after a structure change (e.g. ALTER)
   * Other changes cannot be done to these tables until the reorg has been completed.
   *
   * This method forces a reorg to happen now.
   *
   * @param {TableName} tableName - The name of the table to reorg
   */
  async executeTableReorg(tableName) {
    // https://www.ibm.com/support/pages/sql0668n-operating-not-allowed-reason-code-7-seen-when-querying-or-viewing-table-db2-warehouse-cloud-and-db2-cloud
    return await this.sequelize.query(
      `CALL SYSPROC.ADMIN_CMD('REORG TABLE ${this.queryGenerator.quoteTable(tableName)}')`,
    );
  }
}
