'use strict';

const { MySqlQueryGenerator } = require('../mysql/query-generator');
const Utils = require('./../../utils');
const semver = require('semver');
const _ = require('lodash');

export class MariaDbQueryGenerator extends MySqlQueryGenerator {
  createSchema(schema, options) {
    options = {
      charset: null,
      collate: null,
      ...options,
    };

    return Utils.joinSQLFragments([
      'CREATE SCHEMA IF NOT EXISTS',
      this.quoteIdentifier(schema),
      options.charset && `DEFAULT CHARACTER SET ${this.escape(options.charset)}`,
      options.collate && `DEFAULT COLLATE ${this.escape(options.collate)}`,
      ';',
    ]);
  }

  dropSchema(schema) {
    return `DROP SCHEMA IF EXISTS ${this.quoteIdentifier(schema)};`;
  }

  getForeignKeysQuery(table, schemaName) {
    // retrieve SQL from `super` (MySQL)
    let SQL = super.getForeignKeysQuery(table, schemaName);
    const databaseVersion = _.get(this, 'sequelize.options.databaseVersion', 0);

    // modify it for MariaDb <v10.5
    if (databaseVersion && semver.lt(this.sequelize.options.databaseVersion, '10.5.0')) {
      SQL = SQL.replace(/JSON_ARRAYAGG/g, 'GROUP_CONCAT');
    }

    return SQL;
  }

  getForeignKeyQuery(table, columnName) {
    // retrieve SQL from `super` (MySQL)
    let SQL = super.getForeignKeyQuery(table, columnName);
    const databaseVersion = _.get(this, 'sequelize.options.databaseVersion', 0);

    // modify it for MariaDb <v10.5
    if (databaseVersion && semver.lt(this.sequelize.options.databaseVersion, '10.5.0')) {
      SQL = SQL.replace(/JSON_ARRAYAGG/g, 'GROUP_CONCAT');
    }

    return SQL;
  }

  showSchemasQuery(options) {
    const schemasToSkip = [
      '\'MYSQL\'',
      '\'INFORMATION_SCHEMA\'',
      '\'PERFORMANCE_SCHEMA\'',
    ];
    if (options.skip && Array.isArray(options.skip) && options.skip.length > 0) {
      for (const schemaName of options.skip) {
        schemasToSkip.push(this.escape(schemaName));
      }
    }

    return Utils.joinSQLFragments([
      'SELECT SCHEMA_NAME as schema_name',
      'FROM INFORMATION_SCHEMA.SCHEMATA',
      `WHERE SCHEMA_NAME NOT IN (${schemasToSkip.join(', ')})`,
      ';',
    ]);
  }

  showTablesQuery(database, options) {
    const searchDatabase = options?.schema || database;

    let query = Utils.toSingleLine(`
      SELECT TABLE_NAME, TABLE_SCHEMA
      FROM   information_schema.tables
      WHERE  TABLE_TYPE = 'BASE TABLE'
    `);
    if (database) {
      query += ` AND TABLE_SCHEMA = ${this.escape(searchDatabase)}`;
    } else {
      query += ` AND TABLE_SCHEMA NOT IN ('MYSQL', 'INFORMATION_SCHEMA', 'PERFORMANCE_SCHEMA')`;
    }

    return `${query};`;
  }

  /**
   * Quote identifier in sql clause
   *
   * @param {string} identifier
   * @param {boolean} force
   *
   * @returns {string}
   */
  quoteIdentifier(identifier, force) {
    return Utils.addTicks(Utils.removeTicks(identifier, '`'), '`');
  }

  /**
   * Generates an SQL query that extract JSON property of given path.
   *
   * @param   {string}               column  The JSON column
   * @param   {string|Array<string>} [path]  The path to extract (optional)
   * @param   {boolean}              [isJson] The value is JSON use alt symbols (optional)
   * @returns {string}                       The generated sql query
   * @private
   */
  jsonPathExtractionQuery(column, path, isJson) {

    const quotedColumn = this.isIdentifierQuoted(column)
      ? column
      : this.quoteIdentifier(column);

    const pathStr = this.escape(['$']
      .concat(_.toPath(path))
      .join('.')
      .replace(/\.(\d+)(?:(?=\.)|$)/g, (__, digit) => `[${digit}]`));

    return `json_unquote(json_extract(${quotedColumn},${pathStr}))`;
  }
}
