'use strict';

const _ = require('lodash');
const Utils = require('../../utils');
const MySQLQueryGenerator = require('../mysql/query-generator');
const util = require('util');

class MariaDBQueryGenerator extends MySQLQueryGenerator {

  createSchema(schema, options) {
    options = {
      charset: null,
      collate: null,
      ...options
    };

    const charset = options.charset ? ` DEFAULT CHARACTER SET ${this.escape(options.charset)}` : '';
    const collate = options.collate ? ` DEFAULT COLLATE ${this.escape(options.collate)}` : '';

    return `CREATE SCHEMA IF NOT EXISTS ${this.quoteIdentifier(schema)}${charset}${collate};`;
  }

  dropSchema(schema) {
    return `DROP SCHEMA IF EXISTS ${this.quoteIdentifier(schema)};`;
  }

  showSchemasQuery(options) {
    const skip =  options.skip && Array.isArray(options.skip) && options.skip.length > 0 ? options.skip : null;
    return `SELECT SCHEMA_NAME as schema_name FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME NOT IN ('MYSQL', 'INFORMATION_SCHEMA', 'PERFORMANCE_SCHEMA'${skip ? skip.reduce( (sql, schemaName) => sql +=  `,${this.escape(schemaName)}`, '') : ''});`;
  }

  showTablesQuery() {
    return 'SELECT TABLE_NAME, TABLE_SCHEMA FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA NOT IN (\'MYSQL\', \'INFORMATION_SCHEMA\', \'PERFORMANCE_SCHEMA\') AND TABLE_TYPE = \'BASE TABLE\'';
  }

  handleSequelizeMethod(smth, tableName, factory, options, prepend) {
    if (smth instanceof Utils.Json) {
      // Parse nested object
      if (smth.conditions) {
        const conditions = this.parseConditionObject(smth.conditions).map(
          condition =>
            `json_unquote(json_extract(${this.quoteIdentifier(
              condition.path[0])},'$.${_.tail(condition.path).join(
              '.')}')) = '${condition.value}'`
        );

        return conditions.join(' and ');
      }
      if (smth.path) {
        let str;

        // Allow specifying conditions using the sqlite json functions
        if (this._checkValidJsonStatement(smth.path)) {
          str = smth.path;
        } else {
          // Also support json dot notation
          let path = smth.path;
          let startWithDot = true;

          // Convert .number. to [number].
          path = path.replace(/\.(\d+)\./g, '[$1].');
          // Convert .number$ to [number]
          path = path.replace(/\.(\d+)$/, '[$1]');

          path = path.split('.');

          let columnName = path.shift();
          const match = columnName.match(/\[\d+\]$/);
          // If columnName ends with [\d+]
          if (match !== null) {
            path.unshift(columnName.substr(match.index));
            columnName = columnName.substr(0, match.index);
            startWithDot = false;
          }

          str = `json_unquote(json_extract(${this.quoteIdentifier(
            columnName)},'$${startWithDot ? '.' : ''}${path.join('.')}'))`;
        }

        if (smth.value) {
          str += util.format(' = %s', this.escape(smth.value));
        }

        return str;
      }
    } else if (smth instanceof Utils.Cast) {
      const lowType = smth.type.toLowerCase();
      if (lowType.includes('timestamp')) {
        smth.type = 'datetime';
      } else if (smth.json && lowType.includes('boolean')) {
        // true or false cannot be casted as booleans within a JSON structure
        smth.type = 'char';
      } else if (lowType.includes('double precision') || lowType.includes('boolean') || lowType.includes('integer')) {
        smth.type = 'decimal';
      } else if (lowType.includes('text')) {
        smth.type = 'char';
      }
    }

    return super.handleSequelizeMethod(smth, tableName, factory, options, prepend);
  }

}

module.exports = MariaDBQueryGenerator;
