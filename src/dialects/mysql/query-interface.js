'use strict';

const sequelizeErrors = require('../../errors');
const { QueryInterface } = require('../abstract/query-interface');
const QueryTypes = require('../../query-types');

/**
 * The interface that Sequelize uses to talk with MySQL/MariaDB database
 */
class MySQLQueryInterface extends QueryInterface {
  /**
   * A wrapper that fixes MySQL's inability to cleanly remove columns from existing tables if they have a foreign key constraint.
   *
   * @override
   */
  async removeColumn(tableName, columnName, options) {
    options = options || {};

    const [results] = await this.sequelize.query(
      this.queryGenerator.getForeignKeyQuery(tableName.tableName ? tableName : {
        tableName,
        schema: this.sequelize.config.database
      }, columnName),
      { raw: true, ...options }
    );

    //Exclude primary key constraint
    if (results.length && results[0].constraint_name !== 'PRIMARY') {
      await Promise.all(results.map(constraint => this.sequelize.query(
        this.queryGenerator.dropForeignKeyQuery(tableName, constraint.constraint_name),
        { raw: true, ...options }
      )));
    }

    return await this.sequelize.query(
      this.queryGenerator.removeColumnQuery(tableName, columnName),
      { raw: true, ...options }
    );
  }

  /**
   * @override
   */
  async upsert(tableName, insertValues, updateValues, where, options) {
    options = { ...options };

    options.type = QueryTypes.UPSERT;
    options.updateOnDuplicate = Object.keys(updateValues);
    options.upsertKeys = Object.values(options.model.primaryKeys).map(item => item.field);

    const model = options.model;
    const sql = this.queryGenerator.insertQuery(tableName, insertValues, model.rawAttributes, options);
    return await this.sequelize.query(sql, options);
  }

  /**
   * @override
   */
  async removeConstraint(tableName, constraintName, options) {
    const sql = this.queryGenerator.showConstraintsQuery(
      tableName.tableName ? tableName : {
        tableName,
        schema: this.sequelize.config.database
      }, constraintName);

    const constraints = await this.sequelize.query(sql, { ...options,
      type: this.sequelize.QueryTypes.SHOWCONSTRAINTS });

    const constraint = constraints[0];
    let query;
    if (!constraint || !constraint.constraintType) {
      throw new sequelizeErrors.UnknownConstraintError(
        {
          message: `Constraint ${constraintName} on table ${tableName} does not exist`,
          constraint: constraintName,
          table: tableName
        });
    }

    if (constraint.constraintType === 'FOREIGN KEY') {
      query = this.queryGenerator.dropForeignKeyQuery(tableName, constraintName);
    } else {
      query = this.queryGenerator.removeIndexQuery(constraint.tableName, constraint.constraintName);
    }

    return await this.sequelize.query(query, options);
  }
}

exports.MySQLQueryInterface = MySQLQueryInterface;
