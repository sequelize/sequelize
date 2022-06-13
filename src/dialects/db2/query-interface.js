'use strict';

import { AggregateError, DatabaseError } from '../../errors';
import { assertNoReservedBind } from '../../utils/sql';

const _ = require('lodash');
const Utils = require('../../utils');
const { Op } = require('../../operators');
const { QueryInterface } = require('../abstract/query-interface');
const { QueryTypes } = require('../../query-types');

/**
 * The interface that Sequelize uses to talk with Db2 database
 */
export class Db2QueryInterface extends QueryInterface {
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

    if (!Utils.isWhereEmpty(where)) {
      wheres.push(where);
    }

    // Lets combine unique keys and indexes into one
    const indexes = _.map(model.uniqueKeys, value => {
      return value.fields;
    });

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
      // db2 supports out parameters. We don't have a proper API for it yet
      // so this temporary API will have to do.
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
      error.state = errorData[0].sqlstate;

      const wrappedError = new DatabaseError(error);

      try {
        await this.dropTable({
          tableName: errorTable,
          schema: errorSchema,
        });
      } catch (dropError) {
        throw new AggregateError([
          wrappedError,
          new Error(`An error occurred while cleaning up table ${errorSchema}.${errorTable}`, { cause: dropError }),
        ]);
      }

      throw wrappedError;
    }

    return response;
  }

  async createTable(tableName, attributes, options, model) {
    let sql = '';

    options = { ...options };

    if (options && options.uniqueKeys) {
      _.forOwn(options.uniqueKeys, uniqueKey => {
        if (uniqueKey.customIndex === undefined) {
          uniqueKey.customIndex = true;
        }
      });
    }

    if (model) {
      options.uniqueKeys = options.uniqueKeys || model.uniqueKeys;
    }

    attributes = _.mapValues(
      attributes,
      attribute => this.sequelize.normalizeAttribute(attribute),
    );

    if (
      !tableName.schema
      && (options.schema || Boolean(model) && model._schema)
    ) {
      tableName = this.queryGenerator.addSchema({
        tableName,
        _schema: Boolean(model) && model._schema || options.schema,
      });
    }

    attributes = this.queryGenerator.attributesToSQL(attributes, { table: tableName, context: 'createTable' });
    sql = this.queryGenerator.createTableQuery(tableName, attributes, options);

    return await this.sequelize.queryRaw(sql, options);
  }

}
