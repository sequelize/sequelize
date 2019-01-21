'use strict';

const _ = require('lodash');
const Utils = require('../../utils');
const MySQLQueryGenerator = require('../mysql/query-generator');

const { Slot, Composition, CompositionGroup } = require('../abstract/query-generator/composition');

class MariaDBQueryGenerator extends MySQLQueryGenerator {

  createSchema(schema, options) {
    options = Object.assign({
      charset: null,
      collate: null
    }, options || {});

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
        const conditions = this.parseConditionObject(smth.conditions).map(condition => {
          const quotedColumn = `${tableName ? `${this.quoteIdentifier(tableName)}.` : ''}${this.quoteIdentifier(condition.path[0])}`;
          return new Composition('json_unquote(json_extract(', quotedColumn, ',', new Slot(`$.${_.tail(condition.path).join('.')}`), ')) = ', new Slot(condition.value));
        });

        return CompositionGroup.from(conditions).space(' and ').toComposition();
      }
      if (smth.path) {
        const composition = new Composition();

        // Allow specifying conditions using the sqlite json functions
        if (this._checkValidJsonStatement(smth.path)) {
          composition.add(smth.path);
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

          const quotedColumn = `${tableName ? `${this.quoteIdentifier(tableName)}.` : ''}${this.quoteIdentifier(columnName)}`;

          composition.add('json_unquote(json_extract(', quotedColumn, ',',
            new Slot(`\$${startWithDot ? '.' : ''}${path.join('.')}`), '))');
        }

        if (smth.value) {
          if (smth.value instanceof Utils.SequelizeMethod) {
            return composition.add(' = ', this.handleSequelizeMethod(smth.value));
          }

          return composition.add(' = ', new Slot(smth.value));
        }

        return composition;
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
