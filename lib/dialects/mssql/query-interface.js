'use strict';

/**
 Returns an object that treats MSSQL's inabilities to do certain queries.

 @class QueryInterface
 @static
 */

/**
  A wrapper that fixes MSSQL's inability to cleanly remove columns from existing tables if they have a default constraint.

  @method removeColumn
  @for    QueryInterface

  @param  {String} tableName     The name of the table.
  @param  {String} attributeName The name of the attribute that we want to remove.
  @param  {Object} options
  @param  {Boolean|Function} [options.logging] A function that logs the sql queries, or false for explicitly not logging these queries
 */
const removeColumn = function(tableName, attributeName, options) {
  const self = this;
  options = options || {};

  const findConstraintSql = self.QueryGenerator.getDefaultConstraintQuery(tableName, attributeName);
  return self.sequelize.query(findConstraintSql, { raw: true, logging: options.logging})
    .spread(function(results) {
      if (!results.length) {
        // No default constraint found -- we can cleanly remove the column
        return;
      }
      const dropConstraintSql = self.QueryGenerator.dropConstraintQuery(tableName, results[0].name);
      return self.sequelize.query(dropConstraintSql, { raw: true, logging: options.logging});
    })
    .then(function() {
      const findForeignKeySql = self.QueryGenerator.getForeignKeyQuery(tableName, attributeName);
      return self.sequelize.query(findForeignKeySql, { raw: true, logging: options.logging});
    })
    .spread(function(results) {
      if (!results.length) {
        // No foreign key constraints found, so we can remove the column
        return;
      }
      const dropForeignKeySql = self.QueryGenerator.dropForeignKeyQuery(tableName, results[0].constraint_name);
      return self.sequelize.query(dropForeignKeySql, { raw: true, logging: options.logging});
    })
    .then(function() {
      const removeSql = self.QueryGenerator.removeColumnQuery(tableName, attributeName);
      return self.sequelize.query(removeSql, { raw: true, logging: options.logging});
    });
};

module.exports = {
  removeColumn
};
