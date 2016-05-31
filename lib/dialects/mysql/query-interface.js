'use strict';

/**
 Returns an object that treats MySQL's inabilities to do certain queries.

 @class QueryInterface
 @static
 */

const _ = require('lodash');

/**
  A wrapper that fixes MySQL's inability to cleanly remove columns from existing tables if they have a foreign key constraint.

  @method removeColumn
  @for    QueryInterface

  @param  {String} tableName     The name of the table.
  @param  {String} columnName    The name of the attribute that we want to remove.
  @param  {Object} options
 */
function removeColumn(tableName, columnName, options) {
  options = options || {};

  /* jshint validthis:true */
  return this.sequelize.query(
      this.QueryGenerator.getForeignKeyQuery(tableName, columnName),
      _.assign({ raw: true }, options)
    )
    .spread(results => {
      if (!results.length) {
        // No foreign key constraints found, so we can remove the column
        return;
      }
      return this.sequelize.query(
        this.QueryGenerator.dropForeignKeyQuery(tableName, results[0].constraint_name),
        _.assign({ raw: true }, options)
      );
    })
    .then(() => this.sequelize.query(
      this.QueryGenerator.removeColumnQuery(tableName, columnName),
      _.assign({ raw: true }, options)
    ));
}
exports.removeColumn = removeColumn;
