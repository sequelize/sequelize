'use strict';

const _ = require('lodash');

const Utils = require('../../utils');
const QueryTypes = require('../../query-types');
const Op = require('../../operators');
const { QueryInterface } = require('../abstract/query-interface');

/**
 * The interface that Sequelize uses to talk with MSSQL database
 */
class MSSqlQueryInterface extends QueryInterface {
  /**
  * A wrapper that fixes MSSQL's inability to cleanly remove columns from existing tables if they have a default constraint.
  *
  * @override
  */
  async removeColumn(tableName, attributeName, options) {
    options = { raw: true, ...options || {} };

    const findConstraintSql = this.queryGenerator.getDefaultConstraintQuery(tableName, attributeName);
    const [results0] = await this.sequelize.query(findConstraintSql, options);
    if (results0.length) {
      // No default constraint found -- we can cleanly remove the column
      const dropConstraintSql = this.queryGenerator.dropConstraintQuery(tableName, results0[0].name);
      await this.sequelize.query(dropConstraintSql, options);
    }
    const findForeignKeySql = this.queryGenerator.getForeignKeyQuery(tableName, attributeName);
    const [results] = await this.sequelize.query(findForeignKeySql, options);
    if (results.length) {
      // No foreign key constraints found, so we can remove the column
      const dropForeignKeySql = this.queryGenerator.dropForeignKeyQuery(tableName, results[0].constraint_name);
      await this.sequelize.query(dropForeignKeySql, options);
    }
    //Check if the current column is a primaryKey
    const primaryKeyConstraintSql = this.queryGenerator.getPrimaryKeyConstraintQuery(tableName, attributeName);
    const [result] = await this.sequelize.query(primaryKeyConstraintSql, options);
    if (result.length) {
      const dropConstraintSql = this.queryGenerator.dropConstraintQuery(tableName, result[0].constraintName);
      await this.sequelize.query(dropConstraintSql, options);
    }
    const removeSql = this.queryGenerator.removeColumnQuery(tableName, attributeName);
    return this.sequelize.query(removeSql, options);
  }

  /**
   * @override
   */
  async upsert(tableName, insertValues, updateValues, where, options) {
    const model = options.model;
    const wheres = [];

    options = { ...options };

    if (!Utils.isWhereEmpty(where)) {
      wheres.push(where);
    }

    // Lets combine unique keys and indexes into one
    let indexes = Object.values(model.uniqueKeys).map(item => item.fields);
    indexes = indexes.concat(Object.values(model._indexes).filter(item => item.unique).map(item => item.fields));

    const attributes = Object.keys(insertValues);
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
    return await this.sequelize.query(sql, options);
  }
}

exports.MSSqlQueryInterface = MSSqlQueryInterface;
