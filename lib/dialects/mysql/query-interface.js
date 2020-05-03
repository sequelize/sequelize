'use strict';

/**
 Returns an object that treats MySQL's inabilities to do certain queries.

 @class QueryInterface
 @static
 @private
 */

const sequelizeErrors = require('../../errors');

/**
 A wrapper that fixes MySQL's inability to cleanly remove columns from existing tables if they have a foreign key constraint.

 @param  {QueryInterface} qi
 @param  {string} tableName     The name of the table.
 @param  {string} columnName    The name of the attribute that we want to remove.
 @param  {object} options

 @private
 */
async function removeColumn(qi, tableName, columnName, options) {
  options = options || {};

  const [results] = await qi.sequelize.query(
    qi.QueryGenerator.getForeignKeyQuery(tableName.tableName ? tableName : {
      tableName,
      schema: qi.sequelize.config.database
    }, columnName),
    { raw: true, ...options }
  );

  //Exclude primary key constraint
  if (results.length && results[0].constraint_name !== 'PRIMARY') {
    await Promise.all(results.map(constraint => qi.sequelize.query(
      qi.QueryGenerator.dropForeignKeyQuery(tableName, constraint.constraint_name),
      { raw: true, ...options }
    )));
  }

  return await qi.sequelize.query(
    qi.QueryGenerator.removeColumnQuery(tableName, columnName),
    { raw: true, ...options }
  );
}

/**
 * @param {QueryInterface} qi
 * @param {string} tableName
 * @param {string} constraintName
 * @param {object} options
 *
 * @private
 */
async function removeConstraint(qi, tableName, constraintName, options) {
  const sql = qi.QueryGenerator.showConstraintsQuery(
    tableName.tableName ? tableName : {
      tableName,
      schema: qi.sequelize.config.database
    }, constraintName);

  const constraints = await qi.sequelize.query(sql, {
    ...options,
    type: qi.sequelize.QueryTypes.SHOWCONSTRAINTS
  });

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

  return await qi.sequelize.query(query, options);
}

exports.removeConstraint = removeConstraint;
exports.removeColumn = removeColumn;
