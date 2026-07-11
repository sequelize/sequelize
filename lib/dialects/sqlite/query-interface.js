'use strict';

const _ = require('lodash');
const { each: pEach } = require('../../utils/promise-helpers');
const UnknownConstraintError = require('../../errors').UnknownConstraintError;

/**
 Returns an object that treats SQLite's inabilities to do certain queries.

 @class QueryInterface
 @static
 @private
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
  @private
 */
async function removeColumn(tableName, attributeName, options) {
  options = options || {};

  const fields = await this.describeTable(tableName, options);
  delete fields[attributeName];

  const sql = this.QueryGenerator.removeColumnQuery(tableName, fields);
  const subQueries = sql.split(';').filter((q) => q !== '');

  return pEach(subQueries, (subQuery) => this.sequelize.query(subQuery + ';', Object.assign({ raw: true }, options)));
}
exports.removeColumn = removeColumn;

/**
  A wrapper that fixes SQLite's inability to change columns from existing tables.
  It will create a backup of the table, drop the table afterwards and create a
  new table with the same name but with a modified version of the respective column.

  @method changeColumn
  @for    QueryInterface

  @param  {String} tableName The name of the table.
  @param  {Object} attributes An object with the attribute's name as key and its options as value object.
  @param  {Object} options
  @param  {Boolean|Function} [options.logging] A function that logs the sql queries, or false for explicitly not logging these queries

  @since 1.6.0
  @private
 */
async function changeColumn(tableName, attributes, options) {
  const attributeName = Object.keys(attributes)[0];
  options = options || {};

  const fields = await this.describeTable(tableName, options);
  fields[attributeName] = attributes[attributeName];

  const sql = this.QueryGenerator.removeColumnQuery(tableName, fields);
  const subQueries = sql.split(';').filter((q) => q !== '');

  return pEach(subQueries, (subQuery) => this.sequelize.query(subQuery + ';', Object.assign({ raw: true }, options)));
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
  @private
 */
async function renameColumn(tableName, attrNameBefore, attrNameAfter, options) {
  options = options || {};

  const fields = await this.describeTable(tableName, options);
  fields[attrNameAfter] = _.clone(fields[attrNameBefore]);
  delete fields[attrNameBefore];

  const sql = this.QueryGenerator.renameColumnQuery(tableName, attrNameBefore, attrNameAfter, fields);
  const subQueries = sql.split(';').filter((q) => q !== '');

  return pEach(subQueries, (subQuery) => this.sequelize.query(subQuery + ';', Object.assign({ raw: true }, options)));
}
exports.renameColumn = renameColumn;

async function removeConstraint(tableName, constraintName, options) {
  const constraints = await this.showConstraint(tableName, constraintName);
  const constraint = constraints[0];

  if (!constraint) {
    throw new UnknownConstraintError(`Constraint ${constraintName} on table ${tableName} does not exist`);
  }

  let createTableSql = constraint.sql;
  constraint.constraintName = this.QueryGenerator.quoteIdentifier(constraint.constraintName);
  let constraintSnippet = `, CONSTRAINT ${constraint.constraintName} ${constraint.constraintType} ${constraint.constraintCondition}`;

  if (constraint.constraintType === 'FOREIGN KEY') {
    const referenceTableName = this.QueryGenerator.quoteTable(constraint.referenceTableName);
    constraint.referenceTableKeys = constraint.referenceTableKeys.map((columnName) =>
      this.QueryGenerator.quoteIdentifier(columnName)
    );
    const referenceTableKeys = constraint.referenceTableKeys.join(', ');
    constraintSnippet += ` REFERENCES ${referenceTableName} (${referenceTableKeys})`;
    constraintSnippet += ` ON UPDATE ${constraint.updateAction}`;
    constraintSnippet += ` ON DELETE ${constraint.deleteAction}`;
  }

  createTableSql = createTableSql.replace(constraintSnippet, '');
  createTableSql += ';';

  const fields = await this.describeTable(tableName, options);
  const sql = this.QueryGenerator._alterConstraintQuery(tableName, fields, createTableSql);
  const subQueries = sql.split(';').filter((q) => q !== '');

  return pEach(subQueries, (subQuery) => this.sequelize.query(subQuery + ';', Object.assign({ raw: true }, options)));
}
exports.removeConstraint = removeConstraint;

async function addConstraint(tableName, options) {
  const constraintSnippet = this.QueryGenerator.getConstraintSnippet(tableName, options);
  const describeCreateTableSql = this.QueryGenerator.describeCreateTableQuery(tableName);

  const constraints = await this.sequelize.query(describeCreateTableSql, options);
  const sql = constraints[0].sql;
  const index = sql.length - 1;
  //Replace ending ')' with constraint snippet - Simulates String.replaceAt
  //http://stackoverflow.com/questions/1431094
  const createTableSql = sql.slice(0, index) + `, ${constraintSnippet})` + sql.slice(index + 1) + ';';

  const fields = await this.describeTable(tableName, options);
  const alterSql = this.QueryGenerator._alterConstraintQuery(tableName, fields, createTableSql);
  const subQueries = alterSql.split(';').filter((q) => q !== '');

  return pEach(subQueries, (subQuery) => this.sequelize.query(subQuery + ';', Object.assign({ raw: true }, options)));
}
exports.addConstraint = addConstraint;

/**
 *
 * @param {String} tableName
 * @param {Object} options  Query Options
 *
 * @private
 * @returns {Promise}
 */
async function getForeignKeyReferencesForTable(tableName, options) {
  const database = this.sequelize.config.database;
  const query = this.QueryGenerator.getForeignKeysQuery(tableName, database);
  const result = await this.sequelize.query(query, options);
  return result.map((row) => ({
    tableName,
    columnName: row.from,
    referencedTableName: row.table,
    referencedColumnName: row.to,
    tableCatalog: database,
    referencedTableCatalog: database
  }));
}

exports.getForeignKeyReferencesForTable = getForeignKeyReferencesForTable;
