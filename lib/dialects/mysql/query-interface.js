'use strict';

/**
 Returns an object that treats MySQL's inabilities to do certain queries.

 @class QueryInterface
 @static
 */

var _ = require('lodash');

/**
  A wrapper that fixes MySQL's inability to cleanly remove columns from existing tables if they have a foreign key constraint.

  @method removeColumn
  @for    QueryInterface

  @param  {String} tableName     The name of the table.
  @param  {String} columnName    The name of the attribute that we want to remove.
  @param  {Object} options
 */
var removeColumn = function (tableName, columnName, options) {
  var self = this;
  options = options || {};

  return self.sequelize.query(
      self.QueryGenerator.getForeignKeyQuery(tableName, columnName),
      _.assign({ raw: true }, options)
    )
    .spread(function (results) {
      if (!results.length) {
        // No foreign key constraints found, so we can remove the column
        return;
      }
      return self.sequelize.query(
          self.QueryGenerator.dropForeignKeyQuery(tableName, results[0].constraint_name),
          _.assign({ raw: true }, options)
        );
    })
    .then(function () {
      return self.sequelize.query(
          self.QueryGenerator.removeColumnQuery(tableName, columnName),
          _.assign({ raw: true }, options)
        );
    });
};

module.exports = {
  removeColumn: removeColumn
};
