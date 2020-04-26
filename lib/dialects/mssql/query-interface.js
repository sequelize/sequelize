'use strict';

/**
 Returns an object that treats MSSQL's inabilities to do certain queries.

 @class QueryInterface
 @static
 @private
 */

/**
  A wrapper that fixes MSSQL's inability to cleanly remove columns from existing tables if they have a default constraint.


  @param  {QueryInterface} qi
  @param  {string} tableName     The name of the table.
  @param  {string} attributeName The name of the attribute that we want to remove.
  @param  {object} options
  @param  {boolean|Function} [options.logging] A function that logs the sql queries, or false for explicitly not logging these queries

  @private
 */
const removeColumn = async function(qi, tableName, attributeName, options) {
  options = Object.assign({ raw: true }, options || {});

  const findConstraintSql = qi.QueryGenerator.getDefaultConstraintQuery(tableName, attributeName);
  const [results0] = await qi.sequelize.query(findConstraintSql, options);
  if (results0.length) {
    // No default constraint found -- we can cleanly remove the column
    const dropConstraintSql = qi.QueryGenerator.dropConstraintQuery(tableName, results0[0].name);
    await qi.sequelize.query(dropConstraintSql, options);
  }
  const findForeignKeySql = qi.QueryGenerator.getForeignKeyQuery(tableName, attributeName);
  const [results] = await qi.sequelize.query(findForeignKeySql, options);
  if (results.length) {
    // No foreign key constraints found, so we can remove the column
    const dropForeignKeySql = qi.QueryGenerator.dropForeignKeyQuery(tableName, results[0].constraint_name);
    await qi.sequelize.query(dropForeignKeySql, options);
  }
  //Check if the current column is a primaryKey
  const primaryKeyConstraintSql = qi.QueryGenerator.getPrimaryKeyConstraintQuery(tableName, attributeName);
  const [result] = await qi.sequelize.query(primaryKeyConstraintSql, options);
  if (result.length) {
    const dropConstraintSql = qi.QueryGenerator.dropConstraintQuery(tableName, result[0].constraintName);
    await qi.sequelize.query(dropConstraintSql, options);
  }
  const removeSql = qi.QueryGenerator.removeColumnQuery(tableName, attributeName);
  return qi.sequelize.query(removeSql, options);
};

module.exports = {
  removeColumn
};
