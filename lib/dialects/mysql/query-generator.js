'use strict';

const _ = require('lodash');
const Utils = require('../../utils');
const AbstractQueryGenerator = require('../abstract/query-generator');
const util = require('util');
const Op = require('../../operators');


const jsonFunctionRegex = /^\s*((?:[a-z]+_){0,2}jsonb?(?:_[a-z]+){0,2})\([^)]*\)/i;
const jsonOperatorRegex = /^\s*(->>?|@>|<@|\?[|&]?|\|{2}|#-)/i;
const tokenCaptureRegex = /^\s*((?:([`"'])(?:(?!\2).|\2{2})*\2)|[\w\d\s]+|[().,;+-])/i;
const foreignKeyFields = 'CONSTRAINT_NAME as constraint_name,'
  + 'CONSTRAINT_NAME as constraintName,'
  + 'CONSTRAINT_SCHEMA as constraintSchema,'
  + 'CONSTRAINT_SCHEMA as constraintCatalog,'
  + 'TABLE_NAME as tableName,'
  + 'TABLE_SCHEMA as tableSchema,'
  + 'TABLE_SCHEMA as tableCatalog,'
  + 'COLUMN_NAME as columnName,'
  + 'REFERENCED_TABLE_SCHEMA as referencedTableSchema,'
  + 'REFERENCED_TABLE_SCHEMA as referencedTableCatalog,'
  + 'REFERENCED_TABLE_NAME as referencedTableName,'
  + 'REFERENCED_COLUMN_NAME as referencedColumnName';

const typeWithoutDefault = new Set(['BLOB', 'TEXT', 'GEOMETRY', 'JSON']);

class MySQLQueryGenerator extends AbstractQueryGenerator {
  constructor(options) {
    super(options);

    this.OperatorMap = Object.assign({}, this.OperatorMap, {
      [Op.regexp]: 'REGEXP',
      [Op.notRegexp]: 'NOT REGEXP'
    });
  }

  createDatabaseQuery(databaseName, options) {
    options = Object.assign({
      charset: null,
      collate: null
    }, options || {});

    const database = this.quoteIdentifier(databaseName);
    const charset = options.charset ? ` DEFAULT CHARACTER SET ${this.escape(options.charset)}` : '';
    const collate = options.collate ? ` DEFAULT COLLATE ${this.escape(options.collate)}` : '';

    return `${`CREATE DATABASE IF NOT EXISTS ${database}${charset}${collate}`.trim()};`;
  }

  dropDatabaseQuery(databaseName) {
    return `DROP DATABASE IF EXISTS ${this.quoteIdentifier(databaseName).trim()};`;
  }

  createSchema() {
    return 'SHOW TABLES';
  }

  showSchemasQuery() {
    return 'SHOW TABLES';
  }

  versionQuery() {
    return 'SELECT VERSION() as `version`';
  }

  createTableQuery(tableName, attributes, options) {
    options = Object.assign({
      engine: 'InnoDB',
      charset: null,
      rowFormat: null
    }, options || {});

    const primaryKeys = [];
    const foreignKeys = {};
    const attrStr = [];

    for (const attr in attributes) {
      if (!Object.prototype.hasOwnProperty.call(attributes, attr)) continue;
      const dataType = attributes[attr];
      let match;

      if (dataType.includes('PRIMARY KEY')) {
        primaryKeys.push(attr);

        if (dataType.includes('REFERENCES')) {
          // MySQL doesn't support inline REFERENCES declarations: move to the end
          match = dataType.match(/^(.+) (REFERENCES.*)$/);
          attrStr.push(`${this.quoteIdentifier(attr)} ${match[1].replace('PRIMARY KEY', '')}`);
          foreignKeys[attr] = match[2];
        } else {
          attrStr.push(`${this.quoteIdentifier(attr)} ${dataType.replace('PRIMARY KEY', '')}`);
        }
      } else if (dataType.includes('REFERENCES')) {
        // MySQL doesn't support inline REFERENCES declarations: move to the end
        match = dataType.match(/^(.+) (REFERENCES.*)$/);
        attrStr.push(`${this.quoteIdentifier(attr)} ${match[1]}`);
        foreignKeys[attr] = match[2];
      } else {
        attrStr.push(`${this.quoteIdentifier(attr)} ${dataType}`);
      }
    }

    const table = this.quoteTable(tableName);
    let attributesClause = attrStr.join(', ');
    const comment = options.comment && typeof options.comment === 'string' ? ` COMMENT ${this.escape(options.comment)}` : '';
    const engine = options.engine;
    const charset = options.charset ? ` DEFAULT CHARSET=${options.charset}` : '';
    const collation = options.collate ? ` COLLATE ${options.collate}` : '';
    const rowFormat = options.rowFormat ? ` ROW_FORMAT=${options.rowFormat}` : '';
    const initialAutoIncrement = options.initialAutoIncrement ? ` AUTO_INCREMENT=${options.initialAutoIncrement}` : '';
    const pkString = primaryKeys.map(pk => this.quoteIdentifier(pk)).join(', ');

    if (options.uniqueKeys) {
      _.each(options.uniqueKeys, (columns, indexName) => {
        if (columns.customIndex) {
          if (typeof indexName !== 'string') {
            indexName = `uniq_${tableName}_${columns.fields.join('_')}`;
          }
          attributesClause += `, UNIQUE ${this.quoteIdentifier(indexName)} (${columns.fields.map(field => this.quoteIdentifier(field)).join(', ')})`;
        }
      });
    }

    if (pkString.length > 0) {
      attributesClause += `, PRIMARY KEY (${pkString})`;
    }

    for (const fkey in foreignKeys) {
      if (Object.prototype.hasOwnProperty.call(foreignKeys, fkey)) {
        attributesClause += `, FOREIGN KEY (${this.quoteIdentifier(fkey)}) ${foreignKeys[fkey]}`;
      }
    }

    return `CREATE TABLE IF NOT EXISTS ${table} (${attributesClause}) ENGINE=${engine}${comment}${charset}${collation}${initialAutoIncrement}${rowFormat};`;
  }


  describeTableQuery(tableName, schema, schemaDelimiter) {
    const table = this.quoteTable(
      this.addSchema({
        tableName,
        _schema: schema,
        _schemaDelimiter: schemaDelimiter
      })
    );

    return `SHOW FULL COLUMNS FROM ${table};`;
  }

  showTablesQuery() {
    return 'SHOW TABLES;';
  }

  addColumnQuery(table, key, dataType) {
    const definition = this.attributeToSQL(dataType, {
      context: 'addColumn',
      tableName: table,
      foreignKey: key
    });

    return `ALTER TABLE ${this.quoteTable(table)} ADD ${this.quoteIdentifier(key)} ${definition};`;
  }

  removeColumnQuery(tableName, attributeName) {
    return `ALTER TABLE ${this.quoteTable(tableName)} DROP ${this.quoteIdentifier(attributeName)};`;
  }

  changeColumnQuery(tableName, attributes) {
    const attrString = [];
    const constraintString = [];

    for (const attributeName in attributes) {
      let definition = attributes[attributeName];
      if (definition.includes('REFERENCES')) {
        const attrName = this.quoteIdentifier(attributeName);
        definition = definition.replace(/.+?(?=REFERENCES)/, '');
        constraintString.push(`FOREIGN KEY (${attrName}) ${definition}`);
      } else {
        attrString.push(`\`${attributeName}\` \`${attributeName}\` ${definition}`);
      }
    }

    let finalQuery = '';
    if (attrString.length) {
      finalQuery += `CHANGE ${attrString.join(', ')}`;
      finalQuery += constraintString.length ? ' ' : '';
    }
    if (constraintString.length) {
      finalQuery += `ADD ${constraintString.join(', ')}`;
    }

    return `ALTER TABLE ${this.quoteTable(tableName)} ${finalQuery};`;
  }

  renameColumnQuery(tableName, attrBefore, attributes) {
    const attrString = [];

    for (const attrName in attributes) {
      const definition = attributes[attrName];
      attrString.push(`\`${attrBefore}\` \`${attrName}\` ${definition}`);
    }

    return `ALTER TABLE ${this.quoteTable(tableName)} CHANGE ${attrString.join(', ')};`;
  }

  handleSequelizeMethod(smth, tableName, factory, options, prepend) {
    if (smth instanceof Utils.Json) {
      // Parse nested object
      if (smth.conditions) {
        const conditions = this.parseConditionObject(smth.conditions).map(condition =>
          `${this.quoteIdentifier(condition.path[0])}->>'$.${_.tail(condition.path).join('.')}' = '${condition.value}'`
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

          str = `${this.quoteIdentifier(columnName)}->>'$${startWithDot ? '.' : ''}${path.join('.')}'`;
        }

        if (smth.value) {
          str += util.format(' = %s', this.escape(smth.value));
        }

        return str;
      }
    } else if (smth instanceof Utils.Cast) {
      if (/timestamp/i.test(smth.type)) {
        smth.type = 'datetime';
      } else if (smth.json && /boolean/i.test(smth.type)) {
        // true or false cannot be casted as booleans within a JSON structure
        smth.type = 'char';
      } else if (/double precision/i.test(smth.type) || /boolean/i.test(smth.type) || /integer/i.test(smth.type)) {
        smth.type = 'decimal';
      } else if (/text/i.test(smth.type)) {
        smth.type = 'char';
      }
    }

    return super.handleSequelizeMethod(smth, tableName, factory, options, prepend);
  }

  _toJSONValue(value) {
    // true/false are stored as strings in mysql
    if (typeof value === 'boolean') {
      return value.toString();
    }
    // null is stored as a string in mysql
    if (value === null) {
      return 'null';
    }
    return value;
  }

  upsertQuery(tableName, insertValues, updateValues, where, model, options) {
    options.onDuplicate = 'UPDATE ';

    options.onDuplicate += Object.keys(updateValues).map(key => {
      key = this.quoteIdentifier(key);
      return `${key}=VALUES(${key})`;
    }).join(', ');

    return this.insertQuery(tableName, insertValues, model.rawAttributes, options);
  }

  truncateTableQuery(tableName) {
    return `TRUNCATE ${this.quoteTable(tableName)}`;
  }

  deleteQuery(tableName, where, options = {}, model) {
    let limit = '';
    let query = `DELETE FROM ${this.quoteTable(tableName)}`;

    if (options.limit) {
      limit = ` LIMIT ${this.escape(options.limit)}`;
    }

    where = this.getWhereConditions(where, null, model, options);

    if (where) {
      query += ` WHERE ${where}`;
    }

    return query + limit;
  }

  showIndexesQuery(tableName, options) {
    return `SHOW INDEX FROM ${this.quoteTable(tableName)}${(options || {}).database ? ` FROM \`${options.database}\`` : ''}`;
  }

  showConstraintsQuery(table, constraintName) {
    const tableName = table.tableName || table;
    const schemaName = table.schema;

    let sql = [
      'SELECT CONSTRAINT_CATALOG AS constraintCatalog,',
      'CONSTRAINT_NAME AS constraintName,',
      'CONSTRAINT_SCHEMA AS constraintSchema,',
      'CONSTRAINT_TYPE AS constraintType,',
      'TABLE_NAME AS tableName,',
      'TABLE_SCHEMA AS tableSchema',
      'from INFORMATION_SCHEMA.TABLE_CONSTRAINTS',
      `WHERE table_name='${tableName}'`
    ].join(' ');

    if (constraintName) {
      sql += ` AND constraint_name = '${constraintName}'`;
    }

    if (schemaName) {
      sql += ` AND TABLE_SCHEMA = '${schemaName}'`;
    }

    return `${sql};`;
  }

  removeIndexQuery(tableName, indexNameOrAttributes) {
    let indexName = indexNameOrAttributes;

    if (typeof indexName !== 'string') {
      indexName = Utils.underscore(`${tableName}_${indexNameOrAttributes.join('_')}`);
    }

    return `DROP INDEX ${this.quoteIdentifier(indexName)} ON ${this.quoteTable(tableName)}`;
  }

  attributeToSQL(attribute, options) {
    if (!_.isPlainObject(attribute)) {
      attribute = {
        type: attribute
      };
    }

    const attributeString = attribute.type.toString({ escape: this.escape.bind(this) });
    let template = attributeString;

    if (attribute.allowNull === false) {
      template += ' NOT NULL';
    }

    if (attribute.autoIncrement) {
      template += ' auto_increment';
    }

    // BLOB/TEXT/GEOMETRY/JSON cannot have a default value
    if (!typeWithoutDefault.has(attributeString)
      && attribute.type._binary !== true
      && Utils.defaultValueSchemable(attribute.defaultValue)) {
      template += ` DEFAULT ${this.escape(attribute.defaultValue)}`;
    }

    if (attribute.unique === true) {
      template += ' UNIQUE';
    }

    if (attribute.primaryKey) {
      template += ' PRIMARY KEY';
    }

    if (attribute.comment) {
      template += ` COMMENT ${this.escape(attribute.comment)}`;
    }

    if (attribute.first) {
      template += ' FIRST';
    }
    if (attribute.after) {
      template += ` AFTER ${this.quoteIdentifier(attribute.after)}`;
    }

    if (attribute.references) {

      if (options && options.context === 'addColumn' && options.foreignKey) {
        const attrName = this.quoteIdentifier(options.foreignKey);
        const fkName = this.quoteIdentifier(`${options.tableName}_${attrName}_foreign_idx`);

        template += `, ADD CONSTRAINT ${fkName} FOREIGN KEY (${attrName})`;
      }

      template += ` REFERENCES ${this.quoteTable(attribute.references.model)}`;

      if (attribute.references.key) {
        template += ` (${this.quoteIdentifier(attribute.references.key)})`;
      } else {
        template += ` (${this.quoteIdentifier('id')})`;
      }

      if (attribute.onDelete) {
        template += ` ON DELETE ${attribute.onDelete.toUpperCase()}`;
      }

      if (attribute.onUpdate) {
        template += ` ON UPDATE ${attribute.onUpdate.toUpperCase()}`;
      }
    }

    return template;
  }

  attributesToSQL(attributes, options) {
    const result = {};

    for (const key in attributes) {
      const attribute = attributes[key];
      result[attribute.field || key] = this.attributeToSQL(attribute, options);
    }

    return result;
  }

  /**
   * Check whether the statmement is json function or simple path
   *
   * @param   {string}  stmt  The statement to validate
   * @returns {boolean}       true if the given statement is json function
   * @throws  {Error}         throw if the statement looks like json function but has invalid token
   * @private
   */
  _checkValidJsonStatement(stmt) {
    if (typeof stmt !== 'string') {
      return false;
    }

    let currentIndex = 0;
    let openingBrackets = 0;
    let closingBrackets = 0;
    let hasJsonFunction = false;
    let hasInvalidToken = false;

    while (currentIndex < stmt.length) {
      const string = stmt.substr(currentIndex);
      const functionMatches = jsonFunctionRegex.exec(string);
      if (functionMatches) {
        currentIndex += functionMatches[0].indexOf('(');
        hasJsonFunction = true;
        continue;
      }

      const operatorMatches = jsonOperatorRegex.exec(string);
      if (operatorMatches) {
        currentIndex += operatorMatches[0].length;
        hasJsonFunction = true;
        continue;
      }

      const tokenMatches = tokenCaptureRegex.exec(string);
      if (tokenMatches) {
        const capturedToken = tokenMatches[1];
        if (capturedToken === '(') {
          openingBrackets++;
        } else if (capturedToken === ')') {
          closingBrackets++;
        } else if (capturedToken === ';') {
          hasInvalidToken = true;
          break;
        }
        currentIndex += tokenMatches[0].length;
        continue;
      }

      break;
    }

    // Check invalid json statement
    if (hasJsonFunction && (hasInvalidToken || openingBrackets !== closingBrackets)) {
      throw new Error(`Invalid json statement: ${stmt}`);
    }

    // return true if the statement has valid json function
    return hasJsonFunction;
  }

  /**
   * Generates an SQL query that returns all foreign keys of a table.
   *
   * @param  {Object} table  The table.
   * @param  {string} schemaName The name of the schema.
   * @returns {string}            The generated sql query.
   * @private
   */
  getForeignKeysQuery(table, schemaName) {
    const tableName = table.tableName || table;
    return `SELECT ${foreignKeyFields} FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE where TABLE_NAME = '${tableName}' AND CONSTRAINT_NAME!='PRIMARY' AND CONSTRAINT_SCHEMA='${schemaName}' AND REFERENCED_TABLE_NAME IS NOT NULL;`;
  }

  /**
   * Generates an SQL query that returns the foreign key constraint of a given column.
   *
   * @param  {Object} table  The table.
   * @param  {string} columnName The name of the column.
   * @returns {string}            The generated sql query.
   * @private
   */
  getForeignKeyQuery(table, columnName) {
    const quotedSchemaName = table.schema ? wrapSingleQuote(table.schema) : '';
    const quotedTableName = wrapSingleQuote(table.tableName || table);
    const quotedColumnName = wrapSingleQuote(columnName);

    return `SELECT ${foreignKeyFields} FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE`
      + ` WHERE (REFERENCED_TABLE_NAME = ${quotedTableName}${table.schema
        ? ` AND REFERENCED_TABLE_SCHEMA = ${quotedSchemaName}`
        : ''} AND REFERENCED_COLUMN_NAME = ${quotedColumnName})`
      + ` OR (TABLE_NAME = ${quotedTableName}${table.schema ?
        ` AND TABLE_SCHEMA = ${quotedSchemaName}` : ''} AND COLUMN_NAME = ${quotedColumnName} AND REFERENCED_TABLE_NAME IS NOT NULL)`;
  }

  /**
   * Generates an SQL query that removes a foreign key from a table.
   *
   * @param  {string} tableName  The name of the table.
   * @param  {string} foreignKey The name of the foreign key constraint.
   * @returns {string}            The generated sql query.
   * @private
   */
  dropForeignKeyQuery(tableName, foreignKey) {
    return `ALTER TABLE ${this.quoteTable(tableName)}
      DROP FOREIGN KEY ${this.quoteIdentifier(foreignKey)};`;
  }
}

// private methods
function wrapSingleQuote(identifier) {
  return Utils.addTicks(identifier, '\'');
}

module.exports = MySQLQueryGenerator;
