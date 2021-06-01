'use strict';

const _ = require('lodash');
const Utils = require('../../utils');
const Op = require('../../operators');
const { QueryInterface } = require('../abstract/query-interface');
const QueryTypes = require('../../query-types');

/**
 * The interface that Sequelize uses to talk with Db2 database
 */
class Db2QueryInterface extends QueryInterface {
  async getForeignKeyReferencesForTable(tableName, options) {
    const queryOptions = {
      ...options,
      type: QueryTypes.FOREIGNKEYS
    };
    const query = this.queryGenerator.getForeignKeysQuery(tableName, this.sequelize.config.username.toUpperCase());
    return this.sequelize.query(query, queryOptions);
  }

  async upsert(tableName, insertValues, updateValues, where, options) {
    options = { ...options };

    const model = options.model;
    const wheres = [];
    const attributes = Object.keys(insertValues);
    let indexes = [];
    let indexFields;

    options = _.clone(options);

    if (!Utils.isWhereEmpty(where)) {
      wheres.push(where);
    }

    // Lets combine unique keys and indexes into one
    indexes = _.map(model.uniqueKeys, value => {
      return value.fields;
    });

    model._indexes.forEach(value => {
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
    });

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
    const result = await this.sequelize.query(sql, options);
    return [result, undefined];
  }
}

exports.Db2QueryInterface = Db2QueryInterface;
