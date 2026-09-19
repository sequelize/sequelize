'use strict';

import { Op, QueryTypes } from '@sequelize/core';
import { isWhereEmpty } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/query-builder-utils.js';
import { assertNoReservedBind } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/sql.js';
import clone from 'lodash/clone';
import intersection from 'lodash/intersection';
import isPlainObject from 'lodash/isPlainObject';
import omit from 'lodash/omit';
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

  async addColumn(table, key, attribute, options = {}) {
    const result = await super.addColumn(table, key, attribute, options);

    // `addColumnQuery` forces the column name to be `key`, so that is the column to comment on.
    await this.#setColumnComment(table, key, attribute?.comment, options);

    return result;
  }

  async changeColumn(tableName, attributeName, dataTypeOrOptions, options) {
    const result = await super.changeColumn(tableName, attributeName, dataTypeOrOptions, options);

    // `attributesToSQL` alters `attribute.field` when it is set, and `attributeName` otherwise.
    await this.#setColumnComment(
      tableName,
      dataTypeOrOptions?.field ?? attributeName,
      dataTypeOrOptions?.comment,
      options,
    );

    return result;
  }

  /**
   * Applies a column comment as a separate statement.
   *
   * Db2 has no inline `COMMENT` clause in `ALTER TABLE`, so the comment needs its own
   * `COMMENT ON COLUMN` statement. It cannot simply be appended to the `ALTER TABLE`, because the
   * Db2 driver prepares the SQL it is given and only executes the first statement of it: anything
   * after the first `;` is discarded without an error (ibmdb/node-ibm_db#319). It therefore has to
   * be issued as a second query.
   *
   * Like the other multi-statement operations in this class, the two statements are not wrapped in
   * a transaction of their own; they join the caller's transaction when `options.transaction` is
   * set. A caller that needs the column change and its comment to be atomic has to provide one.
   *
   * @param {TableOrModel} tableName - The table the column belongs to
   * @param {string} columnName - The column to comment on
   * @param {unknown} comment - The comment to set, if any
   * @param {object} options - Query options, passed through to the follow-up query
   */
  async #setColumnComment(tableName, columnName, comment, options) {
    if (!comment || typeof comment !== 'string') {
      return;
    }

    await this.sequelize.queryRaw(
      this.queryGenerator.commentOnColumnQuery(tableName, columnName, comment),
      // `ifNotExists` is an `addColumn` option rather than a query option, and the base
      // `addColumn` strips it the same way. Db2 rejects it in `addColumnQuery` anyway.
      omit(options ?? {}, ['ifNotExists']),
    );
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
