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
  @param  {Object} options
  @param  {boolean|Function} [options.logging] A function that logs the sql queries, or false for explicitly not logging these queries

  @private
 */
const removeColumn = function(qi, tableName, attributeName, options) {
  options = Object.assign({ raw: true }, options || {});

  const findConstraintSql = qi.QueryGenerator.getDefaultConstraintQuery(tableName, attributeName);
  return qi.sequelize.query(findConstraintSql, options)
    .then(([results]) => {
      if (!results.length) {
        // No default constraint found -- we can cleanly remove the column
        return;
      }
      const dropConstraintSql = qi.QueryGenerator.dropConstraintQuery(tableName, results[0].name);
      return qi.sequelize.query(dropConstraintSql, options);
    })
    .then(() => {
      const findForeignKeySql = qi.QueryGenerator.getForeignKeyQuery(tableName, attributeName);
      return qi.sequelize.query(findForeignKeySql, options);
    })
    .then(([results]) => {
      if (!results.length) {
        // No foreign key constraints found, so we can remove the column
        return;
      }
      const dropForeignKeySql = qi.QueryGenerator.dropForeignKeyQuery(tableName, results[0].constraint_name);
      return qi.sequelize.query(dropForeignKeySql, options);
    })
    .then(() => {
      //Check if the current column is a primaryKey
      const primaryKeyConstraintSql = qi.QueryGenerator.getPrimaryKeyConstraintQuery(tableName, attributeName);
      return qi.sequelize.query(primaryKeyConstraintSql, options);
    })
    .then(([result]) => {
      if (!result.length) {
        return;
      }
      const dropConstraintSql = qi.QueryGenerator.dropConstraintQuery(tableName, result[0].constraintName);
      return qi.sequelize.query(dropConstraintSql, options);
    })
    .then(() => {
      const removeSql = qi.QueryGenerator.removeColumnQuery(tableName, attributeName);
      return qi.sequelize.query(removeSql, options);
    });
};

module.exports = {
  removeColumn
};
