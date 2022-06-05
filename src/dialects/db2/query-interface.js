'use strict';

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
    const query = this.queryGenerator.getForeignKeysQuery(tableName, this.sequelize.config.username.toUpperCase(), options);
    const foreignKeys = await this.sequelize.queryRaw(query, queryOptions);

    // convert Column field values to array
    Array.from([foreignKeys]).flat().forEach(tuple => {
      for (const key in tuple) {
        if (key.toLowerCase().includes('column')) {
          // db2/query-generator currently only supports LISTAGG()
          //   this will need to be updated if it ever supports array_agg or
          //   json_arrayagg refer to abstract/query-interface in that case
          //   for a generic array-value gnerator
          const listaggDelimiter = ', ';
          tuple[key] = tuple[key].split(listaggDelimiter);
        }
      }
    });

    return foreignKeys;
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

    for (const value of model._indexes) {
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
    if (options.indexes) {
      for (const fields of options.indexes) {
        const fieldArr = fields.fields;
        if (fieldArr.length === 1) {
          for (const field of fieldArr) {
            for (const property in attributes) {
              if (field === attributes[property].field) {
                attributes[property].unique = true;
              }
            }
          }
        }
      }
    }

    if (options.alter && options.indexes) {
      for (const fields of options.indexes) {
        const fieldArr = fields.fields;
        if (fieldArr.length === 1) {
          for (const field of fieldArr) {
            for (const property in attributes) {
              if (field === attributes[property].field && attributes[property].unique) {
                attributes[property].unique = false;
              }
            }
          }
        }
      }
    }

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
