'use strict';

const sequelizeErrors = require('../../errors');
const QueryTypes = require('../../query-types');
const { QueryInterface } = require('../abstract/query-interface');
const { cloneDeep } = require('../../utils');

/**
 * The interface that Sequelize uses to talk with SQLite database
 */
class SQLiteQueryInterface extends QueryInterface {
  /**
   * A wrapper that fixes SQLite's inability to remove columns from existing tables.
   * It will create a backup of the table, drop the table afterwards and create a
   * new table with the same name but without the obsolete column.
   *
   * @override
   */
  async removeColumn(tableName, attributeName, options) {
    options = options || {};

    const fields = await this.describeTable(tableName, options);
    delete fields[attributeName];

    const sql = this.queryGenerator.removeColumnQuery(tableName, fields);
    const subQueries = sql.split(';').filter(q => q !== '');

    for (const subQuery of subQueries) await this.sequelize.query(`${subQuery};`, { raw: true, ...options });
  }

  /**
   * A wrapper that fixes SQLite's inability to change columns from existing tables.
   * It will create a backup of the table, drop the table afterwards and create a
   * new table with the same name but with a modified version of the respective column.
   *
   * @override
   */
  async changeColumn(tableName, attributeName, dataTypeOrOptions, options) {
    options = options || {};

    const fields = await this.describeTable(tableName, options);
    fields[attributeName] = this.normalizeAttribute(dataTypeOrOptions);

    const sql = this.queryGenerator.removeColumnQuery(tableName, fields);
    const subQueries = sql.split(';').filter(q => q !== '');

    for (const subQuery of subQueries) await this.sequelize.query(`${subQuery};`, { raw: true, ...options });
  }

  /**
   * A wrapper that fixes SQLite's inability to rename columns from existing tables.
   * It will create a backup of the table, drop the table afterwards and create a
   * new table with the same name but with a renamed version of the respective column.
   *
   * @override
   */
  async renameColumn(tableName, attrNameBefore, attrNameAfter, options) {
    options = options || {};
    const fields = await this.assertTableHasColumn(tableName, attrNameBefore, options);

    fields[attrNameAfter] = { ...fields[attrNameBefore] };
    delete fields[attrNameBefore];

    const sql = this.queryGenerator.renameColumnQuery(tableName, attrNameBefore, attrNameAfter, fields);
    const subQueries = sql.split(';').filter(q => q !== '');

    for (const subQuery of subQueries) await this.sequelize.query(`${subQuery};`, { raw: true, ...options });
  }

  /**
   * @override
   */
  async removeConstraint(tableName, constraintName, options) {
    let createTableSql;

    const constraints = await this.showConstraint(tableName, constraintName);
    // sqlite can't show only one constraint, so we find here the one to remove
    const constraint = constraints.find(constaint => constaint.constraintName === constraintName);

    if (!constraint) {
      throw new sequelizeErrors.UnknownConstraintError({
        message: `Constraint ${constraintName} on table ${tableName} does not exist`,
        constraint: constraintName,
        table: tableName
      });
    }
    createTableSql = constraint.sql;
    constraint.constraintName = this.queryGenerator.quoteIdentifier(constraint.constraintName);
    let constraintSnippet = `, CONSTRAINT ${constraint.constraintName} ${constraint.constraintType} ${constraint.constraintCondition}`;

    if (constraint.constraintType === 'FOREIGN KEY') {
      const referenceTableName = this.queryGenerator.quoteTable(constraint.referenceTableName);
      constraint.referenceTableKeys = constraint.referenceTableKeys.map(columnName => this.queryGenerator.quoteIdentifier(columnName));
      const referenceTableKeys = constraint.referenceTableKeys.join(', ');
      constraintSnippet += ` REFERENCES ${referenceTableName} (${referenceTableKeys})`;
      constraintSnippet += ` ON UPDATE ${constraint.updateAction}`;
      constraintSnippet += ` ON DELETE ${constraint.deleteAction}`;
    }

    createTableSql = createTableSql.replace(constraintSnippet, '');
    createTableSql += ';';

    const fields = await this.describeTable(tableName, options);

    const sql = this.queryGenerator._alterConstraintQuery(tableName, fields, createTableSql);
    const subQueries = sql.split(';').filter(q => q !== '');

    for (const subQuery of subQueries) await this.sequelize.query(`${subQuery};`, { raw: true, ...options });
  }

  /**
   * @override
   */
  async addConstraint(tableName, options) {
    if (!options.fields) {
      throw new Error('Fields must be specified through options.fields');
    }

    if (!options.type) {
      throw new Error('Constraint type must be specified through options.type');
    }

    options = cloneDeep(options);

    const constraintSnippet = this.queryGenerator.getConstraintSnippet(tableName, options);
    const describeCreateTableSql = this.queryGenerator.describeCreateTableQuery(tableName);

    const constraints = await this.sequelize.query(describeCreateTableSql, { ...options, type: QueryTypes.SELECT, raw: true });
    let sql = constraints[0].sql;
    const index = sql.length - 1;
    //Replace ending ')' with constraint snippet - Simulates String.replaceAt
    //http://stackoverflow.com/questions/1431094
    const createTableSql = `${sql.substr(0, index)}, ${constraintSnippet})${sql.substr(index + 1)};`;

    const fields = await this.describeTable(tableName, options);
    sql = this.queryGenerator._alterConstraintQuery(tableName, fields, createTableSql);
    const subQueries = sql.split(';').filter(q => q !== '');

    for (const subQuery of subQueries) await this.sequelize.query(`${subQuery};`, { raw: true, ...options });
  }

  /**
   * @override
   */
  async getForeignKeyReferencesForTable(tableName, options) {
    const database = this.sequelize.config.database;
    const query = this.queryGenerator.getForeignKeysQuery(tableName, database);
    const result = await this.sequelize.query(query, options);
    return result.map(row => ({
      tableName,
      columnName: row.from,
      referencedTableName: row.table,
      referencedColumnName: row.to,
      tableCatalog: database,
      referencedTableCatalog: database
    }));
  }

  /**
   * @override
   */
  async dropAllTables(options) {
    options = options || {};
    const skip = options.skip || [];

    const tableNames = await this.showAllTables(options);
    await this.sequelize.query('PRAGMA foreign_keys = OFF', options);
    await this._dropAllTables(tableNames, skip, options);
    await this.sequelize.query('PRAGMA foreign_keys = ON', options);
  }
}

exports.SQLiteQueryInterface = SQLiteQueryInterface;
