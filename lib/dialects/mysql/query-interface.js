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

 @param  {QueryInterface} qi
 @param  {string} tableName     The name of the table.
 @param  {string} columnName    The name of the attribute that we want to remove.
 @param  {object} options

 @private
 */
function removeColumn(qi, tableName, columnName, options = {}) {
  return qi.sequelize.query(
    qi.QueryGenerator.getForeignKeyQuery(tableName.tableName ? tableName : {
      tableName,
      schema: qi.sequelize.config.database
    }, columnName),
    Object.assign({ raw: true }, options)
  )
    .then(([results]) => {
      //Exclude primary key constraint
      if (!results.length || results[0].constraint_name === 'PRIMARY') {
        // No foreign key constraints found, so we can remove the column
        return;
      }
      return Promise.map(results, constraint => qi.sequelize.query(
        qi.QueryGenerator.dropForeignKeyQuery(tableName, constraint.constraint_name),
        Object.assign({ raw: true }, options)
      ));
    })
    .then(() => qi.sequelize.query(
      qi.QueryGenerator.removeColumnQuery(tableName, columnName),
      Object.assign({ raw: true }, options)
    ));
}

/**
 * @param {QueryInterface} qi
 * @param {string} tableName
 * @param {string} constraintName
 * @param {object} options
 *
 * @private
 */
function removeConstraint(qi, tableName, constraintName, options) {
  const sql = qi.QueryGenerator.showConstraintsQuery(
    tableName.tableName ? tableName : {
      tableName,
      schema: qi.sequelize.config.database
    }, constraintName);

  return qi.sequelize.query(sql, Object.assign({}, options,
    { type: qi.sequelize.QueryTypes.SHOWCONSTRAINTS }))
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
        query = qi.QueryGenerator.dropForeignKeyQuery(tableName, constraintName);
      } else {
        query = qi.QueryGenerator.removeIndexQuery(constraint.tableName, constraint.constraintName);
      }

      return qi.sequelize.query(query, options);
    });
}

exports.removeConstraint = removeConstraint;
exports.removeColumn = removeColumn;
