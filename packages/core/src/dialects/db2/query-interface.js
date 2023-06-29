'use strict';

import { AggregateError, DatabaseError, BaseError } from '../../errors';
import { isWhereEmpty } from '../../utils/query-builder-utils';
import { assertNoReservedBind } from '../../utils/sql';

const _ = require('lodash');
const { Op } = require('../../operators');
const { AbstractQueryInterface } = require('../abstract/query-interface');
const { QueryTypes } = require('../../query-types');

/**
 * The interface that Sequelize uses to talk with Db2 database
 */
export class Db2QueryInterface extends AbstractQueryInterface {
  async getForeignKeyReferencesForTable(tableName, options) {
    const queryOptions = {
      ...options,
      type: QueryTypes.FOREIGNKEYS,
    };
    const query = this.queryGenerator.getForeignKeysQuery(tableName, this.sequelize.config.username.toUpperCase());

    return this.sequelize.queryRaw(query, queryOptions);
  }

  async upsert(tableName, insertValues, updateValues, where, options) {
    if (options.bind) {
      assertNoReservedBind(options.bind);
    }

    options = { ...options };

    const model = options.model;
    const wheres = [];
    const attributes = Object.keys(insertValues);
    let indexFields;

    options = _.clone(options);

    if (!isWhereEmpty(where)) {
      wheres.push(where);
    }

    // Lets combine unique keys and indexes into one
    const indexes = [];

    for (const value of model.getIndexes()) {
      if (value.unique) {
        // fields in the index may both the strings or objects with an attribute property - lets sanitize that
        indexFields = value.fields.map(field => {
          if (_.isPlainObject(field)) {
            return field.attribute;
          }

          return field;
        });
        indexes.push(indexFields);
      }
    }

    for (const index of indexes) {
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

    delete options.replacements;

    const result = await this.sequelize.queryRaw(sql, options);

    return [result, undefined];
  }

  async dropSchema(schema, options) {
    const outParams = new Map();

    // DROP SCHEMA works in a weird way in DB2:
    // Its query uses ADMIN_DROP_SCHEMA, which stores the error message in a table
    // specified by two IN-OUT parameters.
    // If the returned values for these parameters is not null, then an error occurred.
    const response = await super.dropSchema(schema, {
      ...options,
      // TODO: db2 supports out parameters. We don't have a proper API for it yet
      //   for now, this temporary API will have to do.
      _unsafe_db2Outparams: outParams,
    });

    const errorTable = outParams.get('sequelize_errorTable');
    if (errorTable != null) {
      const errorSchema = outParams.get('sequelize_errorSchema');

      const errorData = await this.sequelize.queryRaw(`SELECT * FROM "${errorSchema}"."${errorTable}"`, {
        type: QueryTypes.SELECT,
      });

      // replicate the data ibm_db adds on an error object
      const error = new Error(errorData[0].DIAGTEXT);
      error.sqlcode = errorData[0].SQLCODE;
      error.sql = errorData[0].STATEMENT;
      error.state = errorData[0].SQLSTATE;

      const wrappedError = new DatabaseError(error);

      try {
        await this.dropTable({
          tableName: errorTable,
          schema: errorSchema,
        });
      } catch (dropError) {
        throw new AggregateError([
          wrappedError,
          new BaseError(`An error occurred while cleaning up table ${errorSchema}.${errorTable}`, { cause: dropError }),
        ]);
      }

      // -204 is "name is undefined" (schema does not exist)
      // 'queryInterface.dropSchema' is supposed to be DROP SCHEMA IF EXISTS
      // so we can ignore this error
      if (error.sqlcode === -204 && error.state === '42704') {
        return response;
      }

      throw wrappedError;
    }

    return response;
  }

  // TODO: drop "schema" options from the option bag, it must be passed through tableName instead.
  async createTable(tableName, attributes, options, model) {
    let sql = '';

    options = { ...options };

    if (model) {
      options.uniqueKeys = options.uniqueKeys || model.uniqueKeys;
    }

    attributes = _.mapValues(
      attributes,
      attribute => this.sequelize.normalizeAttribute(attribute),
    );

    const modelTable = model?.table;

    if (
      !tableName.schema
      && (options.schema || modelTable?.schema)
    ) {
      tableName = this.queryGenerator.extractTableDetails(tableName);
      tableName.schema = modelTable?.schema || options.schema || tableName.schema;
    }

    attributes = this.queryGenerator.attributesToSQL(attributes, { table: tableName, context: 'createTable', withoutForeignKeyConstraints: options.withoutForeignKeyConstraints });
    sql = this.queryGenerator.createTableQuery(tableName, attributes, options);

    return await this.sequelize.queryRaw(sql, options);
  }

  async addConstraint(tableName, options) {
    try {
      return await super.addConstraint(tableName, options);
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
    return await this.sequelize.query(`CALL SYSPROC.ADMIN_CMD('REORG TABLE ${this.queryGenerator.quoteTable(tableName)}')`);
  }
}
