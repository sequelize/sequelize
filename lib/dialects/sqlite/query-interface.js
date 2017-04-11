'use strict';

const Utils = require('../../utils');
const Promise = require('../../promise');
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
function removeColumn(tableName, attributeName, options) {
  options = options || {};

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
  @private
 */
function changeColumn(tableName, attributes, options) {
  const attributeName = Object.keys(attributes)[0];
  options = options || {};

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
  @private
 */
function renameColumn(tableName, attrNameBefore, attrNameAfter, options) {
  options = options || {};

  return this.describeTable(tableName, options).then(fields => {
    fields[attrNameAfter] = Utils._.clone(fields[attrNameBefore]);
    delete fields[attrNameBefore];

    const sql = this.QueryGenerator.renameColumnQuery(tableName, attrNameBefore, attrNameAfter, fields);
    const subQueries = sql.split(';').filter(q => q !== '');

    return Promise.each(subQueries, subQuery => this.sequelize.query(subQuery + ';', Utils._.assign({raw: true}, options)));
  });
}
exports.renameColumn = renameColumn;

function removeConstraint(tableName, constraintName, options) {
  let createTableSql;

  return this.showConstraint(tableName, constraintName)
    .then(constraints => {
      const constraint = constraints[0];

      if (constraint) {
        createTableSql = constraint.sql;
        constraint.constraintName = this.QueryGenerator.quoteIdentifier(constraint.constraintName);
        let constraintSnippet = `, CONSTRAINT ${constraint.constraintName} ${constraint.constraintType} ${constraint.constraintCondition}`;

        if (constraint.constraintType === 'FOREIGN KEY') {
          const referenceTableName = this.QueryGenerator.quoteTable(constraint.referenceTableName);
          constraint.referenceTableKeys = constraint.referenceTableKeys.map(columnName => this.QueryGenerator.quoteIdentifier(columnName));
          const referenceTableKeys = constraint.referenceTableKeys.join(', ');
          constraintSnippet += ` REFERENCES ${referenceTableName} (${referenceTableKeys})`;
          constraintSnippet += ` ON UPDATE ${constraint.updateAction}`;
          constraintSnippet += ` ON DELETE ${constraint.deleteAction}`;
        }

        createTableSql = createTableSql.replace(constraintSnippet, '');
        createTableSql += ';';

        return this.describeTable(tableName, options);
      } else {
        throw new UnknownConstraintError(`Constraint ${constraintName} on table ${tableName} does not exist`);
      }
    })
    .then(fields => {
      const sql = this.QueryGenerator._alterConstraintQuery(tableName, fields, createTableSql);
      const subQueries = sql.split(';').filter(q => q !== '');

      return Promise.each(subQueries, subQuery => this.sequelize.query(subQuery + ';', Utils._.assign({raw: true}, options)));
    });
}
exports.removeConstraint = removeConstraint;

function addConstraint(tableName, options) {
  const constraintSnippet = this.QueryGenerator.getConstraintSnippet(tableName, options);
  const describeCreateTableSql = this.QueryGenerator.describeCreateTableQuery(tableName);
  let createTableSql;

  return this.sequelize.query(describeCreateTableSql, options)
    .then(constraints => {
      const sql = constraints[0].sql;
      const index = sql.length - 1;
      //Replace ending ')' with constraint snippet - Simulates String.replaceAt
      //http://stackoverflow.com/questions/1431094
      createTableSql = sql.substr(0, index) +  `, ${constraintSnippet})` + sql.substr(index + 1) + ';';

      return this.describeTable(tableName, options);
    })
    .then(fields => {
      const sql = this.QueryGenerator._alterConstraintQuery(tableName, fields, createTableSql);
      const subQueries = sql.split(';').filter(q => q !== '');

      return Promise.each(subQueries, subQuery => this.sequelize.query(subQuery + ';', Utils._.assign({raw: true}, options)));
    });
}
exports.addConstraint = addConstraint;
