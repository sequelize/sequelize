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
      attribute => this.sequelize.normalizeAttribute(attribute)
    );  
    if (options.indexes) {
      options.indexes.forEach(fields=>{
        const fieldArr = fields.fields;
        if (fieldArr.length === 1) {
          fieldArr.forEach(field=>{       
            for (const property in attributes) {
              if (field === attributes[property].field) {
                attributes[property].unique = true;
              }
            }
          });
        }
      });
    }
    if (options.alter) {
      if (options.indexes) {
        options.indexes.forEach(fields=>{
          const fieldArr = fields.fields;
          if (fieldArr.length === 1) {
            fieldArr.forEach(field=>{       
              for (const property in attributes) {
                if (field === attributes[property].field && attributes[property].unique) {
                  attributes[property].unique = false;
                }
              }
            });
          }
        });
      }
    }

    if (
      !tableName.schema &&
      (options.schema || !!model && model._schema)
    ) {
      tableName = this.queryGenerator.addSchema({
        tableName,
        _schema: !!model && model._schema || options.schema
      });
    }

    attributes = this.queryGenerator.attributesToSQL(attributes, { table: tableName, context: 'createTable', withoutForeignKeyConstraints: options.withoutForeignKeyConstraints });
    sql = this.queryGenerator.createTableQuery(tableName, attributes, options);

    return await this.sequelize.query(sql, options);
  }

}

exports.Db2QueryInterface = Db2QueryInterface;
