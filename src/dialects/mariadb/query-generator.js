'use strict';

const { MySqlQueryGenerator } = require('../mysql/query-generator');
const _ = require('lodash');

export class MariaDbQueryGenerator extends MySqlQueryGenerator {

  _getTechnicalSchemaNames() {
    return ['MYSQL', 'INFORMATION_SCHEMA', 'PERFORMANCE_SCHEMA', 'mysql', 'information_schema', 'performance_schema'];
  }

  /**
   * Generates an SQL query that extract JSON property of given path.
   *
   * @param   {string}               _column  The JSON column
   * @param   {string|Array<string>} [_path]  The path to extract (optional)
   * @returns {string}                        The generated sql query
   * @private
   */
  jsonPathExtractionQuery(_column, _path) {
    const quotedColumn = this.isIdentifierQuoted(_column)
      ? _column
      : this.quoteIdentifier(_column);

    const pathStr = this.escape(['$']
      .concat(_.toPath(_path))
      .join('.')
      .replace(/\.(\d+)(?:(?=\.)|$)/g, (__, digit) => `[${digit}]`));

    return `json_unquote(json_extract(${quotedColumn},${pathStr}))`;
  }
}
