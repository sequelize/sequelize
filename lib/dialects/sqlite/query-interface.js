'use strict';

var Utils = require('../../utils')
  , Promise = require('../../promise');

/**
 Returns an object that treats SQLite's inabilities to do certain queries.

 @class QueryInterface
 @static
 */

/**
  A wrapper that fixes SQLite's inability to remove columns from existing tables.
  It will create a backup of the table, drop the table afterwards and create a
  new table with the same name but without the obsolete column.

  @method removeColumn
  @for    QueryInterface

  @param  {String} tableName     The name of the table.
  @param  {String} attributeName The name of the attribute that we want to remove.
  @param  {Object} options
  @param  {Boolean|Function} [options.logging] A function that logs the sql queries, or false for explicitly not logging these queries

  @since 1.6.0
 */
var removeColumn = function(tableName, attributeName, options) {
  var self = this;
  options = options || {};

  return this.describeTable(tableName).then(function(fields) {
    delete fields[attributeName];

    var sql = self.QueryGenerator.removeColumnQuery(tableName, fields)
      , subQueries = sql.split(';').filter(function(q) { return q !== ''; });

    return Promise.each(subQueries, function(subQuery) {
      return self.sequelize.query(subQuery + ';', { raw: true, logging: options.logging });
    });
  });
};

/**
  A wrapper that fixes SQLite's inability to change columns from existing tables.
  It will create a backup of the table, drop the table afterwards and create a
  new table with the same name but with a modified version of the respective column.

  @method changeColumn
  @for    QueryInterface

  @param  {String} tableName The name of the table.
  @param  {Object} attributes An object with the attribute's name as key and it's options as value object.
  @param  {Object} options
  @param  {Boolean|Function} [options.logging] A function that logs the sql queries, or false for explicitly not logging these queries

  @since 1.6.0
 */
var changeColumn = function(tableName, attributes, options) {
  var attributeName = Utils._.keys(attributes)[0]
    , self = this;
  options = options || {};

  return this.describeTable(tableName, options).then(function(fields) {
    fields[attributeName] = attributes[attributeName];

    var sql = self.QueryGenerator.removeColumnQuery(tableName, fields)
      , subQueries = sql.split(';').filter(function(q) { return q !== ''; });

    return Promise.each(subQueries, function(subQuery) {
      return self.sequelize.query(subQuery + ';', { raw: true, logging: options.logging });
    });
  });
};

/**
  A wrapper that fixes SQLite's inability to rename columns from existing tables.
  It will create a backup of the table, drop the table afterwards and create a
  new table with the same name but with a renamed version of the respective column.

  @method renameColumn
  @for    QueryInterface

  @param  {String} tableName The name of the table.
  @param  {String} attrNameBefore The name of the attribute before it was renamed.
  @param  {String} attrNameAfter The name of the attribute after it was renamed.
  @param  {Object} options
  @param  {Boolean|Function} [options.logging] A function that logs the sql queries, or false for explicitly not logging these queries

  @since 1.6.0
 */
var renameColumn = function(tableName, attrNameBefore, attrNameAfter, options) {
  var self = this;
  options = options || {};

  return this.describeTable(tableName, options).then(function(fields) {
    fields[attrNameAfter] = Utils._.clone(fields[attrNameBefore]);
    delete fields[attrNameBefore];

    var sql = self.QueryGenerator.renameColumnQuery(tableName, attrNameBefore, attrNameAfter, fields)
      , subQueries = sql.split(';').filter(function(q) { return q !== ''; });

    return Promise.each(subQueries, function(subQuery) {
      return self.sequelize.query(subQuery + ';', { raw: true, logging: options.logging });
    });
  });
};

module.exports = {
  removeColumn: removeColumn,
  changeColumn: changeColumn,
  renameColumn: renameColumn
};
