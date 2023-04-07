'use strict';

import { joinSQLFragments } from '../../utils/join-sql-fragments';
import { EMPTY_OBJECT } from '../../utils/object.js';
import { defaultValueSchemable } from '../../utils/query-builder-utils';
import { addTicks, quoteIdentifier } from '../../utils/dialect.js';
import { rejectInvalidOptions } from '../../utils/check';
import {
  ADD_COLUMN_QUERY_SUPPORTABLE_OPTIONS,
  CREATE_DATABASE_QUERY_SUPPORTABLE_OPTIONS,
  CREATE_SCHEMA_QUERY_SUPPORTABLE_OPTIONS,
  LIST_SCHEMAS_QUERY_SUPPORTABLE_OPTIONS,
  REMOVE_COLUMN_QUERY_SUPPORTABLE_OPTIONS,
} from '../abstract/query-generator';

const _ = require('lodash');
const { SnowflakeQueryGeneratorTypeScript } = require('./query-generator-typescript');
const { Op } = require('../../operators');

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

/**
 * list of reserved words in Snowflake
 * source: https://docs.snowflake.com/en/sql-reference/reserved-keywords.html
 *
 * @private
 */
const SNOWFLAKE_RESERVED_WORDS = 'account,all,alter,and,any,as,between,by,case,cast,check,column,connect,connections,constraint,create,cross,current,current_date,current_time,current_timestamp,current_user,database,delete,distinct,drop,else,exists,false,following,for,from,full,grant,group,gscluster,having,ilike,in,increment,inner,insert,intersect,into,is,issue,join,lateral,left,like,localtime,localtimestamp,minus,natural,not,null,of,on,or,order,organization,qualify,regexp,revoke,right,rlike,row,rows,sample,schema,select,set,some,start,table,tablesample,then,to,trigger,true,try_cast,union,unique,update,using,values,view,when,whenever,where,with'.split(',');

const typeWithoutDefault = new Set(['BLOB', 'TEXT', 'GEOMETRY', 'JSON']);

const ADD_COLUMN_QUERY_SUPPORTED_OPTIONS = new Set();
const CREATE_DATABASE_QUERY_SUPPORTED_OPTIONS = new Set(['charset', 'collate']);
const CREATE_SCHEMA_QUERY_SUPPORTED_OPTIONS = new Set();
const LIST_SCHEMAS_QUERY_SUPPORTED_OPTIONS = new Set();
const REMOVE_COLUMN_QUERY_SUPPORTED_OPTIONS = new Set();

export class SnowflakeQueryGenerator extends SnowflakeQueryGeneratorTypeScript {
  constructor(options) {
    super(options);

    this.whereSqlBuilder.setOperatorKeyword(Op.regexp, 'REGEXP');
    this.whereSqlBuilder.setOperatorKeyword(Op.notRegexp, 'NOT REGEXP');
  }

  createDatabaseQuery(databaseName, options) {
    if (options) {
      rejectInvalidOptions(
        'createDatabaseQuery',
        this.dialect.name,
        CREATE_DATABASE_QUERY_SUPPORTABLE_OPTIONS,
        CREATE_DATABASE_QUERY_SUPPORTED_OPTIONS,
        options,
      );
    }

    return joinSQLFragments([
      'CREATE DATABASE IF NOT EXISTS',
      this.quoteIdentifier(databaseName),
      options?.charset && `DEFAULT CHARACTER SET ${this.escape(options.charset)}`,
      options?.collate && `DEFAULT COLLATE ${this.escape(options.collate)}`,
      ';',
    ]);
  }

  dropDatabaseQuery(databaseName) {
    return `DROP DATABASE IF EXISTS ${this.quoteIdentifier(databaseName)};`;
  }

  listDatabasesQuery() {
    return `SHOW DATABASES;`;
  }

  createSchemaQuery(schema, options) {
    if (options) {
      rejectInvalidOptions(
        'createSchemaQuery',
        this.dialect.name,
        CREATE_SCHEMA_QUERY_SUPPORTABLE_OPTIONS,
        CREATE_SCHEMA_QUERY_SUPPORTED_OPTIONS,
        options,
      );
    }

    return `CREATE SCHEMA IF NOT EXISTS ${this.quoteIdentifier(schema)};`;
  }

  dropSchemaQuery(schema) {
    return `DROP SCHEMA IF EXISTS ${this.quoteIdentifier(schema)} CASCADE;`;
  }

  listSchemasQuery(options) {
    if (options) {
      rejectInvalidOptions(
        'listSchemasQuery',
        this.dialect.name,
        LIST_SCHEMAS_QUERY_SUPPORTABLE_OPTIONS,
        LIST_SCHEMAS_QUERY_SUPPORTED_OPTIONS,
        options,
      );
    }

    return `SHOW SCHEMAS;`;
  }

  versionQuery() {
    return 'SELECT CURRENT_VERSION()';
  }

  createTableQuery(tableName, attributes, options) {
    options = {
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
          match = dataType.match(/^(.+) (REFERENCES.*)$/);
          attrStr.push(`${this.quoteIdentifier(attr)} ${match[1].replace('PRIMARY KEY', '')}`);
          foreignKeys[attr] = match[2];
        } else {
          attrStr.push(`${this.quoteIdentifier(attr)} ${dataType.replace('PRIMARY KEY', '')}`);
        }
      } else if (dataType.includes('REFERENCES')) {
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

        attributesClause += `, UNIQUE ${this.quoteIdentifier(indexName)} (${columns.fields.map(field => this.quoteIdentifier(field)).join(', ')})`;
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
      options.comment && typeof options.comment === 'string' && `COMMENT ${this.escape(options.comment)}`,
      options.charset && `DEFAULT CHARSET=${options.charset}`,
      options.collate && `COLLATE ${options.collate}`,
      options.rowFormat && `ROW_FORMAT=${options.rowFormat}`,
      ';',
    ]);
  }

  showTablesQuery(database) {
    return joinSQLFragments([
      'SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = \'BASE TABLE\'',
      database ? `AND TABLE_SCHEMA = ${this.escape(database)}` : 'AND TABLE_SCHEMA NOT IN ( \'INFORMATION_SCHEMA\', \'PERFORMANCE_SCHEMA\', \'SYS\')',
      ';',
    ]);
  }

  tableExistsQuery(table) {
    const tableName = table.tableName ?? table;
    const schema = table.schema;

    return joinSQLFragments([
      'SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = \'BASE TABLE\'',
      `AND TABLE_SCHEMA = ${schema !== undefined ? this.escape(schema) : 'CURRENT_SCHEMA()'}`,
      `AND TABLE_NAME = ${this.escape(tableName)}`,
      ';',
    ]);
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
    const query = (...subQuerys) => joinSQLFragments([
      'ALTER TABLE',
      this.quoteTable(tableName),
      'ALTER COLUMN',
      ...subQuerys,
      ';',
    ]);
    const sql = [];
    for (const attributeName in attributes) {
      let definition = this.dataTypeMapping(tableName, attributeName, attributes[attributeName]);
      const attrSql = [];

      if (definition.includes('NOT NULL')) {
        attrSql.push(query(this.quoteIdentifier(attributeName), 'SET NOT NULL'));

        definition = definition.replace('NOT NULL', '').trim();
      } else if (!definition.includes('REFERENCES')) {
        attrSql.push(query(this.quoteIdentifier(attributeName), 'DROP NOT NULL'));
      }

      if (definition.includes('DEFAULT')) {
        attrSql.push(query(this.quoteIdentifier(attributeName), 'SET DEFAULT', definition.match(/DEFAULT ([^;]+)/)[1]));

        definition = definition.replace(/(DEFAULT[^;]+)/, '').trim();
      } else if (!definition.includes('REFERENCES')) {
        attrSql.push(query(this.quoteIdentifier(attributeName), 'DROP DEFAULT'));
      }

      if (/UNIQUE;*$/.test(definition)) {
        definition = definition.replace(/UNIQUE;*$/, '');
        attrSql.push(query('ADD UNIQUE (', this.quoteIdentifier(attributeName), ')').replace('ALTER COLUMN', ''));
      }

      if (definition.includes('REFERENCES')) {
        definition = definition.replace(/.+?(?=REFERENCES)/, '');
        attrSql.push(query('ADD FOREIGN KEY (', this.quoteIdentifier(attributeName), ')', definition).replace('ALTER COLUMN', ''));
      } else {
        attrSql.push(query(this.quoteIdentifier(attributeName), 'TYPE', definition));
      }

      sql.push(attrSql.join(''));
    }

    return sql.join('');
  }

  renameColumnQuery(tableName, attrBefore, attributes) {
    const attrString = [];

    for (const attrName in attributes) {
      const definition = attributes[attrName];
      attrString.push(`'${attrBefore}' '${attrName}' ${definition}`);
    }

    return joinSQLFragments([
      'ALTER TABLE',
      this.quoteTable(tableName),
      'RENAME COLUMN',
      attrString.join(' to '),
      ';',
    ]);
  }

  truncateTableQuery(tableName) {
    return joinSQLFragments([
      'TRUNCATE',
      this.quoteTable(tableName),
    ]);
  }

  deleteQuery(tableName, where, options = EMPTY_OBJECT, model) {
    const escapeOptions = { ...options, model };

    const table = this.quoteTable(tableName);
    const limit = options.limit && ` LIMIT ${this.escape(options.limit, escapeOptions)}`;
    let primaryKeys = '';
    let primaryKeysSelection = '';

    let whereClause = this.whereQuery(where, escapeOptions);
    if (whereClause) {
      whereClause = ` ${whereClause}`;
    }

    if (limit) {
      if (!model) {
        throw new Error('Cannot LIMIT delete without a model.');
      }

      const pks = Object.values(model.primaryKeys).map(pk => this.quoteIdentifier(pk.field)).join(',');

      primaryKeys = model.primaryKeyAttributes.length > 1 ? `(${pks})` : pks;
      primaryKeysSelection = pks;

      return joinSQLFragments([
        'DELETE FROM',
        table,
        'WHERE',
        primaryKeys,
        'IN (SELECT',
        primaryKeysSelection,
        'FROM',
        table,
        whereClause,
        limit,
        ')',
      ]);
    }

    return joinSQLFragments([
      'DELETE FROM',
      table,
      whereClause,
    ]);
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

    const attributeString = attribute.type.toString({ dialect: this.dialect });
    let template = attributeString;

    if (attribute.allowNull === false) {
      template += ' NOT NULL';
    }

    if (attribute.autoIncrement) {
      template += ' AUTOINCREMENT';
    }

    // BLOB/TEXT/GEOMETRY/JSON cannot have a default value
    if (!typeWithoutDefault.has(attributeString)
      && attribute.type._binary !== true
      && defaultValueSchemable(attribute.defaultValue)) {
      template += ` DEFAULT ${this.escape(attribute.defaultValue, { ...options, type: attribute.type })}`;
    }

    if (attribute.unique === true) {
      template += ' UNIQUE';
    }

    if (attribute.primaryKey) {
      template += ' PRIMARY KEY';
    }

    if (attribute.comment) {
      template += ` COMMENT ${this.escape(attribute.comment, options)}`;
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

  dataTypeMapping(tableName, attr, dataType) {
    if (dataType.includes('PRIMARY KEY')) {
      dataType = dataType.replace('PRIMARY KEY', '');
    }

    if (dataType.includes('SERIAL')) {
      if (dataType.includes('BIGINT')) {
        dataType = dataType.replace('SERIAL', 'BIGSERIAL');
        dataType = dataType.replace('BIGINT', '');
      } else if (dataType.includes('SMALLINT')) {
        dataType = dataType.replace('SERIAL', 'SMALLSERIAL');
        dataType = dataType.replace('SMALLINT', '');
      } else {
        dataType = dataType.replace('INTEGER', '');
      }

      dataType = dataType.replace('NOT NULL', '');
    }

    return dataType;
  }

  /**
   * Generates an SQL query that returns all foreign keys of a table.
   *
   * @param  {object} table  The table.
   * @param  {string} schemaName The name of the schema.
   * @returns {string}            The generated sql query.
   * @private
   */
  getForeignKeysQuery(table, schemaName) {
    const tableName = table.tableName || table;

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

  addLimitAndOffset(options) {
    if (options.offset) {
      return ` LIMIT ${this.escape(options.limit ?? null, options)} OFFSET ${this.escape(options.offset, options)}`;
    }

    if (options.limit != null) {
      return ` LIMIT ${this.escape(options.limit, options)}`;
    }

    return '';
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
    const optForceQuote = force || false;
    // TODO [>7]: remove "quoteIdentifiers: false" option
    const optQuoteIdentifiers = this.options.quoteIdentifiers !== false;

    if (
      optForceQuote === true
      // TODO [>7]: drop this.options.quoteIdentifiers. Always quote identifiers.
      || optQuoteIdentifiers !== false
      || identifier.includes('.')
      || identifier.includes('->')
      || SNOWFLAKE_RESERVED_WORDS.includes(identifier.toLowerCase())
    ) {
      // In Snowflake if tables or attributes are created double-quoted,
      // they are also case sensitive. If they contain any uppercase
      // characters, they must always be double-quoted. This makes it
      // impossible to write queries in portable SQL if tables are created in
      // this way. Hence, we strip quotes if we don't want case sensitivity.
      return quoteIdentifier(identifier, this.dialect.TICK_CHAR_LEFT, this.dialect.TICK_CHAR_RIGHT);
    }

    return identifier;
  }
}

/**
 * @param {string} identifier
 * @deprecated use "escape" or "escapeString" on QueryGenerator
 */
function wrapSingleQuote(identifier) {
  return addTicks(identifier, '\'');
}
