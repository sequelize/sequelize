'use strict';

/**
 Returns an object that treats MSSQL's inabilities to do certain queries.

 @class QueryInterface
 @static
 @private
 */

/**
  A wrapper that fixes MSSQL's inability to cleanly remove columns from existing tables if they have a default constraint.

  @method removeColumn
  @for    QueryInterface

  @param  {String} tableName     The name of the table.
  @param  {String} attributeName The name of the attribute that we want to remove.
  @param  {Object} options
  @param  {Boolean|Function} [options.logging] A function that logs the sql queries, or false for explicitly not logging these queries
 @private
 */
const removeColumn = function(tableName, attributeName, options) {
  options = Object.assign({ raw: true }, options || {});

  const findConstraintSql = this.QueryGenerator.getDefaultConstraintQuery(tableName, attributeName);
  return this.sequelize.query(findConstraintSql, options)
    .spread(results => {
      if (!results.length) {
        // No default constraint found -- we can cleanly remove the column
        return;
      }
      const dropConstraintSql = this.QueryGenerator.dropConstraintQuery(tableName, results[0].name);
      return this.sequelize.query(dropConstraintSql, options);
    })
    .then(() => {
      const findForeignKeySql = this.QueryGenerator.getForeignKeyQuery(tableName, attributeName);
      return this.sequelize.query(findForeignKeySql, options);
    })
    .spread(results => {
      if (!results.length) {
        // No foreign key constraints found, so we can remove the column
        return;
      }
      const dropForeignKeySql = this.QueryGenerator.dropForeignKeyQuery(tableName, results[0].constraint_name);
      return this.sequelize.query(dropForeignKeySql, options);
    })
    .then(() => {
      //Check if the current column is a primaryKey
      const primaryKeyConstraintSql = this.QueryGenerator.getPrimaryKeyConstraintQuery(tableName, attributeName);
      return this.sequelize.query(primaryKeyConstraintSql, options);
    })
    .spread(result => {
      if (!result.length) {
        return;
      }
      const dropConstraintSql = this.QueryGenerator.dropConstraintQuery(tableName, result[0].constraintName);
      return this.sequelize.query(dropConstraintSql, options);
    })
    .then(() => {
      const removeSql = this.QueryGenerator.removeColumnQuery(tableName, attributeName);
      return this.sequelize.query(removeSql, options);
    });
};

module.exports = {
  removeColumn
};
