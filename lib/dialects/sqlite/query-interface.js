'use strict';

const _ = require('lodash');
const Promise = require('../../promise');
const sequelizeErrors = require('../../errors');
const QueryTypes = require('../../query-types');

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

  @param  {QueryInterface} qi
  @param  {string} tableName     The name of the table.
  @param  {string} attributeName The name of the attribute that we want to remove.
  @param  {Object} options
  @param  {boolean|Function} [options.logging] A function that logs the sql queries, or false for explicitly not logging these queries

  @since 1.6.0
  @private
 */
function removeColumn(qi, tableName, attributeName, options) {
  options = options || {};

  return qi.describeTable(tableName, options).then(fields => {
    delete fields[attributeName];

    const sql = qi.QueryGenerator.removeColumnQuery(tableName, fields);
    const subQueries = sql.split(';').filter(q => q !== '');

    return Promise.each(subQueries, subQuery => qi.sequelize.query(`${subQuery};`, Object.assign({ raw: true }, options)));
  });
}
exports.removeColumn = removeColumn;

/**
  A wrapper that fixes SQLite's inability to change columns from existing tables.
  It will create a backup of the table, drop the table afterwards and create a
  new table with the same name but with a modified version of the respective column.

  @param  {QueryInterface} qi
  @param  {string} tableName The name of the table.
  @param  {Object} attributes An object with the attribute's name as key and its options as value object.
  @param  {Object} options
  @param  {boolean|Function} [options.logging] A function that logs the sql queries, or false for explicitly not logging these queries

  @since 1.6.0
  @private
 */
function changeColumn(qi, tableName, attributes, options) {
  const attributeName = Object.keys(attributes)[0];
  options = options || {};

  return qi.describeTable(tableName, options).then(fields => {
    fields[attributeName] = attributes[attributeName];

    const sql = qi.QueryGenerator.removeColumnQuery(tableName, fields);
    const subQueries = sql.split(';').filter(q => q !== '');

    return Promise.each(subQueries, subQuery => qi.sequelize.query(`${subQuery};`, Object.assign({ raw: true }, options)));
  });
}
exports.changeColumn = changeColumn;

/**
  A wrapper that fixes SQLite's inability to rename columns from existing tables.
  It will create a backup of the table, drop the table afterwards and create a
  new table with the same name but with a renamed version of the respective column.

  @param  {QueryInterface} qi
  @param  {string} tableName The name of the table.
  @param  {string} attrNameBefore The name of the attribute before it was renamed.
  @param  {string} attrNameAfter The name of the attribute after it was renamed.
  @param  {Object} options
  @param  {boolean|Function} [options.logging] A function that logs the sql queries, or false for explicitly not logging these queries

  @since 1.6.0
  @private
 */
function renameColumn(qi, tableName, attrNameBefore, attrNameAfter, options) {
  options = options || {};

  return qi.describeTable(tableName, options).then(fields => {
    fields[attrNameAfter] = _.clone(fields[attrNameBefore]);
    delete fields[attrNameBefore];

    const sql = qi.QueryGenerator.renameColumnQuery(tableName, attrNameBefore, attrNameAfter, fields);
    const subQueries = sql.split(';').filter(q => q !== '');

    return Promise.each(subQueries, subQuery => qi.sequelize.query(`${subQuery};`, Object.assign({ raw: true }, options)));
  });
}
exports.renameColumn = renameColumn;

/**
 * @param {QueryInterface} qi
 * @param {string} tableName
 * @param {string} constraintName
 * @param {Object} options
 *
 * @private
 */
function removeConstraint(qi, tableName, constraintName, options) {
  let createTableSql;

  return qi.showConstraint(tableName, constraintName)
    .then(constraints => {
      const constraint = constraints[0];

      if (constraint) {
        createTableSql = constraint.sql;
        constraint.constraintName = qi.QueryGenerator.quoteIdentifier(constraint.constraintName);
        let constraintSnippet = `, CONSTRAINT ${constraint.constraintName} ${constraint.constraintType} ${constraint.constraintCondition}`;

        if (constraint.constraintType === 'FOREIGN KEY') {
          const referenceTableName = qi.QueryGenerator.quoteTable(constraint.referenceTableName);
          constraint.referenceTableKeys = constraint.referenceTableKeys.map(columnName => qi.QueryGenerator.quoteIdentifier(columnName));
          const referenceTableKeys = constraint.referenceTableKeys.join(', ');
          constraintSnippet += ` REFERENCES ${referenceTableName} (${referenceTableKeys})`;
          constraintSnippet += ` ON UPDATE ${constraint.updateAction}`;
          constraintSnippet += ` ON DELETE ${constraint.deleteAction}`;
        }

        createTableSql = createTableSql.replace(constraintSnippet, '');
        createTableSql += ';';

        return qi.describeTable(tableName, options);
      }
      throw new sequelizeErrors.UnknownConstraintError({
        message: `Constraint ${constraintName} on table ${tableName} does not exist`,
        constraint: constraintName,
        table: tableName
      });
    })
    .then(fields => {
      const sql = qi.QueryGenerator._alterConstraintQuery(tableName, fields, createTableSql);
      const subQueries = sql.split(';').filter(q => q !== '');

      return Promise.each(subQueries, subQuery => qi.sequelize.query(`${subQuery};`, Object.assign({ raw: true }, options)));
    });
}
exports.removeConstraint = removeConstraint;

/**
 * @param {QueryInterface} qi
 * @param {string} tableName
 * @param {Object} options
 *
 * @private
 */
function addConstraint(qi, tableName, options) {
  const constraintSnippet = qi.QueryGenerator.getConstraintSnippet(tableName, options);
  const describeCreateTableSql = qi.QueryGenerator.describeCreateTableQuery(tableName);
  let createTableSql;

  return qi.sequelize.query(describeCreateTableSql, Object.assign({}, options, { type: QueryTypes.SELECT, raw: true }))
    .then(constraints => {
      const sql = constraints[0].sql;
      const index = sql.length - 1;
      //Replace ending ')' with constraint snippet - Simulates String.replaceAt
      //http://stackoverflow.com/questions/1431094
      createTableSql = `${sql.substr(0, index)}, ${constraintSnippet})${sql.substr(index + 1)};`;

      return qi.describeTable(tableName, options);
    })
    .then(fields => {
      const sql = qi.QueryGenerator._alterConstraintQuery(tableName, fields, createTableSql);
      const subQueries = sql.split(';').filter(q => q !== '');

      return Promise.each(subQueries, subQuery => qi.sequelize.query(`${subQuery};`, Object.assign({ raw: true }, options)));
    });
}
exports.addConstraint = addConstraint;

/**
 * @param {QueryInterface} qi
 * @param {string} tableName
 * @param {Object} options  Query Options
 *
 * @private
 * @returns {Promise}
 */
function getForeignKeyReferencesForTable(qi, tableName, options) {
  const database = qi.sequelize.config.database;
  const query = qi.QueryGenerator.getForeignKeysQuery(tableName, database);
  return qi.sequelize.query(query, options)
    .then(result => {
      return result.map(row => ({
        tableName,
        columnName: row.from,
        referencedTableName: row.table,
        referencedColumnName: row.to,
        tableCatalog: database,
        referencedTableCatalog: database
      }));
    });
}

exports.getForeignKeyReferencesForTable = getForeignKeyReferencesForTable;
