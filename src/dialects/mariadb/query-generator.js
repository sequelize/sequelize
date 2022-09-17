'use strict';

const { MySqlQueryGenerator } = require('../mysql/query-generator');
const Utils = require('./../../utils');
const _ = require('lodash');

export class MariaDbQueryGenerator extends MySqlQueryGenerator {
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

  /**
   * Generates an SQL query that returns all foreign keys of a table.
   *
   * @param  {object} table  The table.
   * @returns {string}            The generated sql query.
   * @private
   */
  getForeignKeysQuery(table) {
    return super.getForeignKeysQuery(table, table.schema || this.sequelize.config.database);
  }

  showTablesQuery(database) {
    let query = 'SELECT TABLE_NAME, TABLE_SCHEMA FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = \'BASE TABLE\'';
    if (database) {
      query += ` AND TABLE_SCHEMA = ${this.escape(database)}`;
    } else {
      query += ' AND TABLE_SCHEMA NOT IN (\'MYSQL\', \'INFORMATION_SCHEMA\', \'PERFORMANCE_SCHEMA\')';
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
