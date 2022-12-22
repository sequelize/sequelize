'use strict';

import { rejectInvalidOptions } from '../../utils/check';
import { addTicks } from '../../utils/dialect';
import { joinSQLFragments } from '../../utils/join-sql-fragments';
import { defaultValueSchemable } from '../../utils/query-builder-utils';
import { Cast, Json } from '../../utils/sequelize-method';
import { underscore } from '../../utils/string';
import { attributeTypeToSql, normalizeDataType } from '../abstract/data-types-utils';
import {
  ADD_COLUMN_QUERY_SUPPORTABLE_OPTIONS,
  REMOVE_COLUMN_QUERY_SUPPORTABLE_OPTIONS,
} from '../abstract/query-generator';

const _ = require('lodash');
const { MySqlQueryGeneratorTypeScript } = require('./query-generator-typescript');
const { Op } = require('../../operators');

const JSON_FUNCTION_REGEX = /^\s*((?:[a-z]+_){0,2}jsonb?(?:_[a-z]+){0,2})\([^)]*\)/i;
const JSON_OPERATOR_REGEX = /^\s*(->>?|@>|<@|\?[&|]?|\|{2}|#-)/i;
const TOKEN_CAPTURE_REGEX = /^\s*((?:(["'`])(?:(?!\2).|\2{2})*\2)|[\s\w]+|[()+,.;-])/i;
const FOREIGN_KEY_FIELDS = [
  'CONSTRAINT_NAME as constraint_name',
  'CONSTRAINT_NAME as constraintName',
  'CONSTRAINT_SCHEMA as constraintSchema',
  'CONSTRAINT_SCHEMA as constraintCatalog',
  'TABLE_NAME as tableName',
  'TABLE_SCHEMA as tableSchema',
  'TABLE_SCHEMA as tableCatalog',
  'COLUMN_NAME as columnName',
  'REFERENCED_TABLE_SCHEMA as referencedTableSchema',
  'REFERENCED_TABLE_SCHEMA as referencedTableCatalog',
  'REFERENCED_TABLE_NAME as referencedTableName',
  'REFERENCED_COLUMN_NAME as referencedColumnName',
].join(',');

const typeWithoutDefault = new Set(['BLOB', 'TEXT', 'GEOMETRY', 'JSON']);
const ADD_COLUMN_QUERY_SUPPORTED_OPTIONS = new Set();
const REMOVE_COLUMN_QUERY_SUPPORTED_OPTIONS = new Set();

export class MySqlQueryGenerator extends MySqlQueryGeneratorTypeScript {
  constructor(options) {
    super(options);

    this.OperatorMap = {
      ...this.OperatorMap,
      [Op.regexp]: 'REGEXP',
      [Op.notRegexp]: 'NOT REGEXP',
    };
  }

  createSchemaQuery(schemaName, options) {
    return joinSQLFragments([
      'CREATE SCHEMA IF NOT EXISTS',
      this.quoteIdentifier(schemaName),
      options?.charset && `DEFAULT CHARACTER SET ${this.escape(options.charset)}`,
      options?.collate && `DEFAULT COLLATE ${this.escape(options.collate)}`,
      ';',
    ]);
  }

  dropSchemaQuery(schemaName) {
    return `DROP SCHEMA IF EXISTS ${this.quoteIdentifier(schemaName)};`;
  }

  // TODO: typescript - protected
  _getTechnicalSchemaNames() {
    return ['MYSQL', 'INFORMATION_SCHEMA', 'PERFORMANCE_SCHEMA', 'SYS', 'mysql', 'information_schema', 'performance_schema', 'sys'];
  }

  listSchemasQuery(options) {
    const schemasToSkip = this._getTechnicalSchemaNames();

    if (Array.isArray(options?.skip)) {
      schemasToSkip.push(...options.skip);
    }

    return joinSQLFragments([
      'SELECT SCHEMA_NAME as schema_name',
      'FROM INFORMATION_SCHEMA.SCHEMATA',
      `WHERE SCHEMA_NAME NOT IN (${schemasToSkip.map(schema => this.escape(schema)).join(', ')})`,
      ';',
    ]);
  }

  versionQuery() {
    return 'SELECT VERSION() as `version`';
  }

  createTableQuery(tableName, attributes, options) {
    options = {
      engine: 'InnoDB',
      charset: null,
      rowFormat: null,
      ...options,
    };

    const primaryKeys = [];
    const foreignKeys = {};
    const attrStr = [];

    for (const attr in attributes) {
      if (!Object.prototype.hasOwnProperty.call(attributes, attr)) {
        continue;
      }

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
    const pkString = primaryKeys.map(pk => this.quoteIdentifier(pk)).join(', ');

    if (options.uniqueKeys) {
      _.each(options.uniqueKeys, (columns, indexName) => {
        if (typeof indexName !== 'string') {
          indexName = `uniq_${tableName}_${columns.fields.join('_')}`;
        }

        attributesClause += `, UNIQUE ${this.quoteIdentifier(indexName)} (${columns.fields.map(field => this.quoteIdentifier(field))
          .join(', ')})`;
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

    return joinSQLFragments([
      'CREATE TABLE IF NOT EXISTS',
      table,
      `(${attributesClause})`,
      `ENGINE=${options.engine}`,
      options.comment && typeof options.comment === 'string' && `COMMENT ${this.escape(options.comment)}`,
      options.charset && `DEFAULT CHARSET=${options.charset}`,
      options.collate && `COLLATE ${options.collate}`,
      options.initialAutoIncrement && `AUTO_INCREMENT=${options.initialAutoIncrement}`,
      options.rowFormat && `ROW_FORMAT=${options.rowFormat}`,
      ';',
    ]);
  }

  showTablesQuery(schemaName) {
    let query = 'SELECT TABLE_NAME, TABLE_SCHEMA FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = \'BASE TABLE\'';
    if (schemaName) {
      query += ` AND TABLE_SCHEMA = ${this.escape(schemaName)}`;
    } else {
      const technicalSchemas = this._getTechnicalSchemaNames();

      query += ` AND TABLE_SCHEMA NOT IN (${technicalSchemas.map(schema => this.escape(schema)).join(', ')})`;
    }

    return `${query};`;
  }

  tableExistsQuery(table) {
    // remove first & last `, then escape as SQL string
    const tableName = this.escape(this.quoteTable(table).slice(1, -1));

    return `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME = ${tableName} AND TABLE_SCHEMA = ${this.escape(this.sequelize.config.database)}`;
  }

  addColumnQuery(table, key, dataType, options) {
    if (options) {
      rejectInvalidOptions(
        'addColumnQuery',
        this.dialect.name,
        ADD_COLUMN_QUERY_SUPPORTABLE_OPTIONS,
        ADD_COLUMN_QUERY_SUPPORTED_OPTIONS,
        options,
      );
    }

    dataType = {
      ...dataType,
      type: normalizeDataType(dataType.type, this.dialect),
    };

    return joinSQLFragments([
      'ALTER TABLE',
      this.quoteTable(table),
      'ADD',
      this.quoteIdentifier(key),
      this.attributeToSQL(dataType, {
        context: 'addColumn',
        tableName: table,
        foreignKey: key,
      }),
      ';',
    ]);
  }

  removeColumnQuery(tableName, attributeName, options) {
    if (options) {
      rejectInvalidOptions(
        'removeColumnQuery',
        this.dialect.name,
        REMOVE_COLUMN_QUERY_SUPPORTABLE_OPTIONS,
        REMOVE_COLUMN_QUERY_SUPPORTED_OPTIONS,
        options,
      );
    }

    return joinSQLFragments([
      'ALTER TABLE',
      this.quoteTable(tableName),
      'DROP',
      this.quoteIdentifier(attributeName),
      ';',
    ]);
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

    return joinSQLFragments([
      'ALTER TABLE',
      this.quoteTable(tableName),
      attrString.length && `CHANGE ${attrString.join(', ')}`,
      constraintString.length && `ADD ${constraintString.join(', ')}`,
      ';',
    ]);
  }

  renameColumnQuery(tableName, attrBefore, attributes) {
    const attrString = [];

    for (const attrName in attributes) {
      const definition = attributes[attrName];
      attrString.push(`\`${attrBefore}\` \`${attrName}\` ${definition}`);
    }

    return joinSQLFragments([
      'ALTER TABLE',
      this.quoteTable(tableName),
      'CHANGE',
      attrString.join(', '),
      ';',
    ]);
  }

  handleSequelizeMethod(smth, tableName, factory, options, prepend) {
    if (smth instanceof Json) {
      // Parse nested object
      if (smth.conditions) {
        const conditions = this.parseConditionObject(smth.conditions).map(condition => `${this.jsonPathExtractionQuery(condition.path[0], _.tail(condition.path))} = '${condition.value}'`);

        return conditions.join(' AND ');
      }

      if (smth.path) {
        let str;

        // Allow specifying conditions using the sqlite json functions
        if (this._checkValidJsonStatement(smth.path)) {
          str = smth.path;
        } else {
          // Also support json property accessors
          const paths = _.toPath(smth.path);
          const column = paths.shift();
          str = this.jsonPathExtractionQuery(column, paths);
        }

        if (smth.value) {
          str += ` = ${this.escape(smth.value, undefined, options)}`;
        }

        return str;
      }
    } else if (smth instanceof Cast) {
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

  truncateTableQuery(tableName) {
    return `TRUNCATE ${this.quoteTable(tableName)}`;
  }

  deleteQuery(tableName, where, options = {}, model) {
    let query = `DELETE FROM ${this.quoteTable(tableName)}`;

    where = this.getWhereConditions(where, null, model, options);
    if (where) {
      query += ` WHERE ${where}`;
    }

    if (options.limit) {
      query += ` LIMIT ${this.escape(options.limit, undefined, _.pick(options, ['bind', 'replacements']))}`;
    }

    return query;
  }

  showConstraintsQuery(table, constraintName) {
    const tableName = table.tableName || table;
    const schemaName = table.schema;

    return joinSQLFragments([
      'SELECT CONSTRAINT_CATALOG AS constraintCatalog,',
      'CONSTRAINT_NAME AS constraintName,',
      'CONSTRAINT_SCHEMA AS constraintSchema,',
      'CONSTRAINT_TYPE AS constraintType,',
      'TABLE_NAME AS tableName,',
      'TABLE_SCHEMA AS tableSchema',
      'from INFORMATION_SCHEMA.TABLE_CONSTRAINTS',
      `WHERE table_name='${tableName}'`,
      constraintName && `AND constraint_name = '${constraintName}'`,
      schemaName && `AND TABLE_SCHEMA = '${schemaName}'`,
      ';',
    ]);
  }

  attributeToSQL(attribute, options) {
    if (!_.isPlainObject(attribute)) {
      attribute = {
        type: attribute,
      };
    }

    const attributeString = attributeTypeToSql(attribute.type, { escape: this.escape.bind(this), dialect: this.dialect });
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
      && defaultValueSchemable(attribute.defaultValue)) {
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

    if ((!options || !options.withoutForeignKeyConstraints) && attribute.references) {
      if (options && options.context === 'addColumn' && options.foreignKey) {
        const fkName = this.quoteIdentifier(`${this.extractTableDetails(options.tableName).tableName}_${options.foreignKey}_foreign_idx`);

        template += `, ADD CONSTRAINT ${fkName} FOREIGN KEY (${this.quoteIdentifier(options.foreignKey)})`;
      }

      template += ` REFERENCES ${this.quoteTable(attribute.references.table)}`;

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
   * Check whether the statement is json function or simple path
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
      const string = stmt.slice(currentIndex);
      const functionMatches = JSON_FUNCTION_REGEX.exec(string);
      if (functionMatches) {
        currentIndex += functionMatches[0].indexOf('(');
        hasJsonFunction = true;
        continue;
      }

      const operatorMatches = JSON_OPERATOR_REGEX.exec(string);
      if (operatorMatches) {
        currentIndex += operatorMatches[0].length;
        hasJsonFunction = true;
        continue;
      }

      const tokenMatches = TOKEN_CAPTURE_REGEX.exec(string);
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
   * @param {object} table The table.
   * @returns {string} The generated sql query.
   * @private
   */
  getForeignKeysQuery(table) {
    const tableName = table.tableName || table;
    // TODO (https://github.com/sequelize/sequelize/pull/14687): use dialect.getDefaultSchema() instead of this.sequelize.config.database
    const schemaName = table.schema || this.sequelize.config.database;

    return joinSQLFragments([
      'SELECT',
      FOREIGN_KEY_FIELDS,
      `FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE where TABLE_NAME = '${tableName}'`,
      `AND CONSTRAINT_NAME!='PRIMARY' AND CONSTRAINT_SCHEMA='${schemaName}'`,
      'AND REFERENCED_TABLE_NAME IS NOT NULL',
      ';',
    ]);
  }

  /**
   * Generates an SQL query that returns the foreign key constraint of a given column.
   *
   * @param  {object} table  The table.
   * @param  {string} columnName The name of the column.
   * @returns {string}            The generated sql query.
   * @private
   */
  getForeignKeyQuery(table, columnName) {
    const quotedSchemaName = table.schema ? wrapSingleQuote(table.schema) : '';
    const quotedTableName = wrapSingleQuote(table.tableName || table);
    const quotedColumnName = wrapSingleQuote(columnName);

    return joinSQLFragments([
      'SELECT',
      FOREIGN_KEY_FIELDS,
      'FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE',
      'WHERE (',
      [
        `REFERENCED_TABLE_NAME = ${quotedTableName}`,
        table.schema && `AND REFERENCED_TABLE_SCHEMA = ${quotedSchemaName}`,
        `AND REFERENCED_COLUMN_NAME = ${quotedColumnName}`,
      ],
      ') OR (',
      [
        `TABLE_NAME = ${quotedTableName}`,
        table.schema && `AND TABLE_SCHEMA = ${quotedSchemaName}`,
        `AND COLUMN_NAME = ${quotedColumnName}`,
        'AND REFERENCED_TABLE_NAME IS NOT NULL',
      ],
      ')',
    ]);
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
    return joinSQLFragments([
      'ALTER TABLE',
      this.quoteTable(tableName),
      'DROP FOREIGN KEY',
      this.quoteIdentifier(foreignKey),
      ';',
    ]);
  }

  /**
   * Generates an SQL query that extract JSON property of given path.
   *
   * @param   {string}               column  The JSON column
   * @param   {string|Array<string>} [path]  The path to extract (optional)
   * @returns {string}                       The generated sql query
   * @private
   */
  jsonPathExtractionQuery(column, path) {
    let paths = _.toPath(path);
    const quotedColumn = this.isIdentifierQuoted(column)
      ? column
      : this.quoteIdentifier(column);

    /**
     * Non digit sub paths need to be quoted as ECMAScript identifiers
     * https://bugs.mysql.com/bug.php?id=81896
     */
    paths = paths.map(subPath => {
      return /\D/.test(subPath)
        ? addTicks(subPath, '"')
        : subPath;
    });

    const pathStr = this.escape(['$']
      .concat(paths)
      .join('.')
      .replace(/\.(\d+)(?:(?=\.)|$)/g, (__, digit) => `[${digit}]`));

    return `json_unquote(json_extract(${quotedColumn},${pathStr}))`;
  }
}

/**
 * @param {string} identifier
 * @deprecated use "escape" or "escapeString" on QueryGenerator
 */
function wrapSingleQuote(identifier) {
  return addTicks(identifier, '\'');
}
