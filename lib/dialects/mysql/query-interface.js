'use strict';

/**
 Returns an object that treats MySQL's inabilities to do certain queries.

 @class QueryInterface
 @static
 @private
 */

const Promise = require('../../promise');
const sequelizeErrors = require('../../errors');

/**
 A wrapper that fixes MySQL's inability to cleanly remove columns from existing tables if they have a foreign key constraint.

 @param  {string} tableName     The name of the table.
 @param  {string} columnName    The name of the attribute that we want to remove.
 @param  {Object} options

 @private
 */
function removeColumn(tableName, columnName, options) {
  options = options || {};

  return this.sequelize.query(
    this.QueryGenerator.getForeignKeyQuery(tableName.tableName ? tableName : {
      tableName,
      schema: this.sequelize.config.database
    }, columnName),
    Object.assign({ raw: true }, options)
  )
    .then(([results]) => {
      //Exclude primary key constraint
      if (!results.length || results[0].constraint_name === 'PRIMARY') {
        // No foreign key constraints found, so we can remove the column
        return;
      }
      return Promise.map(results, constraint => this.sequelize.query(
        this.QueryGenerator.dropForeignKeyQuery(tableName, constraint.constraint_name),
        Object.assign({ raw: true }, options)
      ));
    })
    .then(() => this.sequelize.query(
      this.QueryGenerator.removeColumnQuery(tableName, columnName),
      Object.assign({ raw: true }, options)
    ));
}

function removeConstraint(tableName, constraintName, options) {
  const sql = this.QueryGenerator.showConstraintsQuery(
    tableName.tableName ? tableName : {
      tableName,
      schema: this.sequelize.config.database
    }, constraintName);

  return this.sequelize.query(sql, Object.assign({}, options,
    { type: this.sequelize.QueryTypes.SHOWCONSTRAINTS }))
    .then(constraints => {
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
        query = this.QueryGenerator.dropForeignKeyQuery(tableName, constraintName);
      } else {
        query = this.QueryGenerator.removeIndexQuery(constraint.tableName, constraint.constraintName);
      }

      return this.sequelize.query(query, options);
    });
}

exports.removeConstraint = removeConstraint;
exports.removeColumn = removeColumn;
