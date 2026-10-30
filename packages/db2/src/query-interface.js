'use strict';

import { BaseError, Op, QueryTypes, TransactionNestMode } from '@sequelize/core';
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

  async addColumn(table, key, attribute, options) {
    if (attribute?.generatedAs == null) {
      return super.addColumn(table, key, attribute, options);
    }

    // Db2 only adds a generated column to a table in set integrity pending state.
    // Checking the table again computes the column, but puts the tables that reference it in that state,
    // so they are checked too. If anything fails, the rollback takes every table out of that state.
    return this.sequelize.transaction(
      { nestMode: TransactionNestMode.savepoint, transaction: options?.transaction },
      async transaction => {
        const queryOptions = { ...options, transaction };
        const listPendingTables = async () => {
          const rows = await this.sequelize.queryRaw(
            `SELECT TABNAME AS "tableName", TRIM(TABSCHEMA) AS "schema" FROM SYSCAT.TABLES WHERE STATUS = 'C'`,
            { ...queryOptions, type: QueryTypes.SELECT },
          );

          return rows.map(row => this.queryGenerator.quoteTable(row));
        };

        const quotedTable = this.queryGenerator.quoteTable(table);
        // tables that were already pending are left alone
        const alreadyPending = new Set(await listPendingTables());
        await this.sequelize.queryRaw(
          `SET INTEGRITY FOR ${quotedTable} OFF CASCADE DEFERRED`,
          queryOptions,
        );
        await super.addColumn(table, key, attribute, queryOptions);
        await this.sequelize.queryRaw(
          `SET INTEGRITY FOR ${quotedTable} IMMEDIATE CHECKED FORCE GENERATED`,
          queryOptions,
        );

        const descendants = (await listPendingTables()).filter(name => !alreadyPending.has(name));
        if (descendants.length > 0) {
          await this.sequelize.queryRaw(
            `SET INTEGRITY FOR ${descendants.join(', ')} IMMEDIATE CHECKED`,
            queryOptions,
          );
        }
      },
    );
  }

  async addConstraint(tableName, options) {
    await this.#retryAfterReorg(tableName, options, async () => {
      await super.addConstraint(tableName, options);
    });
  }

  async addIndex(tableName, attributes, options, rawTablename) {
    const queryOptions = Array.isArray(attributes) ? options : attributes;

    return this.#retryAfterReorg(tableName, queryOptions, async () => {
      return super.addIndex(tableName, attributes, options, rawTablename);
    });
  }

  async #retryAfterReorg(tableName, options, callback) {
    try {
      return await callback();
    } catch (error) {
      if (!error.cause) {
        throw error;
      }

      // Operation not allowed for reason code "7" on table "DB2INST1.users".  SQLSTATE=57007
      // ibm_db reports the SQLSTATE as "sqlstate" ("state" is kept for older versions).
      // Only reason code 7 means that the table needs a reorg.
      const sqlState = error.cause.sqlstate ?? error.cause.state;
      if (
        error.cause.sqlcode !== -668 ||
        sqlState !== '57007' ||
        !`${error.message} ${error.cause.message}`.includes('reason code "7"')
      ) {
        throw error;
      }

      // REORG TABLE commits the current transaction, so it is only done automatically outside of one
      const transaction =
        options?.transaction === undefined
          ? this.sequelize.getCurrentClsTransaction()
          : options.transaction;
      if (transaction) {
        throw new BaseError(
          `Table ${this.queryGenerator.quoteTable(tableName)} needs to be reorganized (REORG TABLE) before this change, which would commit the current transaction. Run this change outside of a transaction, or reorganize the table first with queryInterface.executeTableReorg().`,
          { cause: error },
        );
      }

      // https://www.ibm.com/support/pages/how-verify-and-resolve-sql0668n-reason-code-7-when-accessing-table
      await this.executeTableReorg(tableName, options);

      return callback();
    }
  }

  /**
   * DB2 can put tables in the "reorg pending" state after a structure change (e.g. ALTER)
   * Other changes cannot be done to these tables until the reorg has been completed.
   *
   * This method forces a reorg to happen now.
   * Note that it commits the current transaction.
   *
   * @param {TableName} tableName - The name of the table to reorg
   * @param {object} [options] - Query options
   */
  async executeTableReorg(tableName, options) {
    // https://www.ibm.com/support/pages/sql0668n-operating-not-allowed-reason-code-7-seen-when-querying-or-viewing-table-db2-warehouse-cloud-and-db2-cloud
    return await this.sequelize.query(
      `CALL SYSPROC.ADMIN_CMD('REORG TABLE ${this.queryGenerator.quoteTable(tableName)}')`,
      { transaction: options?.transaction, logging: options?.logging },
    );
  }
}
