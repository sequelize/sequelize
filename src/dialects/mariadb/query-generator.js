'use strict';

import { normalizeDataType } from '../abstract/data-types-utils';
import { joinSQLFragments } from '../../utils';

const { MySqlQueryGenerator } = require('../mysql/query-generator');
const _ = require('lodash');

export class MariaDbQueryGenerator extends MySqlQueryGenerator {

  _getTechnicalSchemaNames() {
    return ['MYSQL', 'INFORMATION_SCHEMA', 'PERFORMANCE_SCHEMA', 'mysql', 'information_schema', 'performance_schema'];
  }

  addColumnQuery(table, key, dataType, options = {}) {
    const ifNotExists = options.ifNotExists ? 'IF NOT EXISTS' : '';

    dataType = {
      ...dataType,
      type: normalizeDataType(dataType.type, this.dialect),
    };

    return joinSQLFragments([
      'ALTER TABLE',
      this.quoteTable(table),
      'ADD',
      ifNotExists,
      this.quoteIdentifier(key),
      this.attributeToSQL(dataType, {
        context: 'addColumn',
        tableName: table,
        foreignKey: key,
      }),
      ';',
    ]);
  }

  removeColumnQuery(tableName, attributeName, options = {}) {
    const ifExists = options.ifExists ? 'IF EXISTS' : '';

    return joinSQLFragments([
      'ALTER TABLE',
      this.quoteTable(tableName),
      'DROP',
      ifExists,
      this.quoteIdentifier(attributeName),
      ';',
    ]);
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
