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
    Object.assign(fields[attributeName], attributes[attributeName]);

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
      // sqlite can't show only one constraint, so we find here the one to remove
      const constraint = constraints.find(constaint => constaint.constraintName === constraintName);

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

/**
 * Describe a table structure
 *
 * This method returns an array of hashes containing information about all attributes in the table.
 *
 * ```js
 * {
 *    name: {
 *      type:         'VARCHAR(255)', // this will be 'CHARACTER VARYING' for pg!
 *      allowNull:    true,
 *      defaultValue: null,
 *      unique:       true,           // available for sqlite only
 *      references:   {},             // available for sqlite only
 *    },
 *    isBetaMember: {
 *      type:         'TINYINT(1)', // this will be 'BOOLEAN' for pg!
 *      allowNull:    false,
 *      defaultValue: false,
 *      unique:       false,        // available for sqlite only
 *      references:   {},           // available for sqlite only
 *    }
 * }
 * ```
 *
 * @param {QueryInterface} qi
 * @param {string} tableName table name
 * @param {Object} [options] Query options
 *
 * @returns {Promise<Object>}
 */
function describeTable(qi, tableName, options) {
  let schema = null;
  let schemaDelimiter = null;

  if (typeof options === 'string') {
    schema = options;
  } else if (typeof options === 'object' && options !== null) {
    schema = options.schema || null;
    schemaDelimiter = options.schemaDelimiter || null;
  }

  if (typeof tableName === 'object' && tableName !== null) {
    schema = tableName.schema;
    tableName = tableName.tableName;
  }

  const sql = qi.QueryGenerator.describeTableQuery(tableName, schema, schemaDelimiter);
  options = Object.assign({}, options, { type: QueryTypes.DESCRIBE });

  return qi.sequelize.query(sql, options).then(data => {
    /*
      * If no data is returned from the query, then the table name may be wrong.
      * Query generators that use information_schema for retrieving table info will just return an empty result set,
      * it will not throw an error like built-ins do (e.g. DESCRIBE on MySql).
      */
    if (_.isEmpty(data)) {
      throw new Error(`No description found for "${tableName}" table. Check the table name and schema; remember, they _are_ case sensitive.`);
    }

    return qi.showIndex(tableName, options).then(indexes => {
      for (const prop in data) {
        data[prop].unique = false;
      }
      for (const index of indexes) {
        for (const field of index.fields) {
          if (index.unique !== undefined) {
            data[field.attribute].unique = index.unique;
          }
        }
      }

      return qi.getForeignKeyReferencesForTable(tableName, options).then(foreignKeys => {
        for (const foreignKey of foreignKeys) {
          data[foreignKey.columnName].references = {
            model: foreignKey.referencedTableName,
            key: foreignKey.referencedColumnName
          };
        }
        return data;
      });
    });
  }).catch(e => {
    if (e.original && e.original.code === 'ER_NO_SUCH_TABLE') {
      throw Error(`No description found for "${tableName}" table. Check the table name and schema; remember, they _are_ case sensitive.`);
    }

    throw e;
  });
}
exports.describeTable = describeTable;
