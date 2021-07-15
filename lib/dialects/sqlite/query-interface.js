'use strict';

const sequelizeErrors = require('../../errors');
const QueryTypes = require('../../query-types');
const { QueryInterface } = require('../abstract/query-interface');
const { cloneDeep } = require('../../utils');
const _ = require('lodash');

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
    Object.assign(fields[attributeName], this.normalizeAttribute(dataTypeOrOptions));

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

  /**
   * @override
   */
  async describeTable(tableName, options) {
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

    const sql = this.queryGenerator.describeTableQuery(tableName, schema, schemaDelimiter);
    options = { ...options, type: QueryTypes.DESCRIBE };
    const sqlIndexes = this.queryGenerator.showIndexesQuery(tableName);

    try {
      const data = await this.sequelize.query(sql, options);
      /*
       * If no data is returned from the query, then the table name may be wrong.
       * Query generators that use information_schema for retrieving table info will just return an empty result set,
       * it will not throw an error like built-ins do (e.g. DESCRIBE on MySql).
       */
      if (_.isEmpty(data)) {
        throw new Error(`No description found for "${tableName}" table. Check the table name and schema; remember, they _are_ case sensitive.`);
      }

      const indexes = await this.sequelize.query(sqlIndexes, options);
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

      const foreignKeys = await this.getForeignKeyReferencesForTable(tableName, options);
      for (const foreignKey of foreignKeys) {
        data[foreignKey.columnName].references = {
          model: foreignKey.referencedTableName,
          key: foreignKey.referencedColumnName
        };
      }

      return data;
    } catch (e) {
      if (e.original && e.original.code === 'ER_NO_SUCH_TABLE') {
        throw new Error(`No description found for "${tableName}" table. Check the table name and schema; remember, they _are_ case sensitive.`);
      }

      throw e;
    }
  }
}

exports.SQLiteQueryInterface = SQLiteQueryInterface;
