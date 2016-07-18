'use strict';

const Utils = require('../../utils');
const Promise = require('../../promise');

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
function removeColumn(tableName, attributeName, options) {
  options = options || {};

  /* jshint validthis:true */
  return this.describeTable(tableName, options).then(fields => {
    delete fields[attributeName];

    const sql = this.QueryGenerator.removeColumnQuery(tableName, fields);
    const subQueries = sql.split(';').filter(q => q !== '');

    return Promise.each(subQueries, subQuery => this.sequelize.query(subQuery + ';', Utils._.assign({raw: true}, options)));
  });
}
exports.removeColumn = removeColumn;

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
function changeColumn(tableName, attributes, options) {
  const attributeName = Object.keys(attributes)[0];
  options = options || {};

  /* jshint validthis:true */
  return this.describeTable(tableName, options).then(fields => {
    fields[attributeName] = attributes[attributeName];

    const sql = this.QueryGenerator.removeColumnQuery(tableName, fields);
    const subQueries = sql.split(';').filter(q => q !== '');

    return Promise.each(subQueries, subQuery => this.sequelize.query(subQuery + ';', Utils._.assign({raw: true}, options)));
  });
}
exports.changeColumn = changeColumn;

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
function renameColumn(tableName, attrNameBefore, attrNameAfter, options) {
  options = options || {};

  /* jshint validthis:true */
  return this.describeTable(tableName, options).then(fields => {
    fields[attrNameAfter] = Utils._.clone(fields[attrNameBefore]);
    delete fields[attrNameBefore];

    const sql = this.QueryGenerator.renameColumnQuery(tableName, attrNameBefore, attrNameAfter, fields);
    const subQueries = sql.split(';').filter(q => q !== '');

    return Promise.each(subQueries, subQuery => this.sequelize.query(subQuery + ';', Utils._.assign({raw: true}, options)));
  });
}
exports.renameColumn = renameColumn;
