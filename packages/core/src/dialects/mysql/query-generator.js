'use strict';

import { inspect } from 'node:util';
import { rejectInvalidOptions } from '../../utils/check';
import { joinSQLFragments } from '../../utils/join-sql-fragments';
import { EMPTY_OBJECT } from '../../utils/object.js';
import { defaultValueSchemable } from '../../utils/query-builder-utils';
import { attributeTypeToSql, normalizeDataType } from '../abstract/data-types-utils';
import { ADD_COLUMN_QUERY_SUPPORTABLE_OPTIONS, REMOVE_COLUMN_QUERY_SUPPORTABLE_OPTIONS } from '../abstract/query-generator';

import each from 'lodash/each';
import isPlainObject from 'lodash/isPlainObject';

const { MySqlQueryGeneratorTypeScript } = require('./query-generator-typescript');

const typeWithoutDefault = new Set(['BLOB', 'TEXT', 'GEOMETRY', 'JSON']);
const ADD_COLUMN_QUERY_SUPPORTED_OPTIONS = new Set();
const REMOVE_COLUMN_QUERY_SUPPORTED_OPTIONS = new Set();

export class MySqlQueryGenerator extends MySqlQueryGeneratorTypeScript {
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
      if (!Object.hasOwn(attributes, attr)) {
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
      each(options.uniqueKeys, (columns, indexName) => {
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
      if (Object.hasOwn(foreignKeys, fkey)) {
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

  truncateTableQuery(tableName) {
    return `TRUNCATE ${this.quoteTable(tableName)}`;
  }

  deleteQuery(tableName, where, options = EMPTY_OBJECT, model) {
    let query = `DELETE FROM ${this.quoteTable(tableName)}`;

    const escapeOptions = { ...options, model };
    const whereSql = this.whereQuery(where, escapeOptions);
    if (whereSql) {
      query += ` ${whereSql}`;
    }

    if (options.limit) {
      query += ` LIMIT ${this.escape(options.limit, escapeOptions)}`;
    }

    return query;
  }

  attributeToSQL(attribute, options) {
    if (!isPlainObject(attribute)) {
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

  _getBeforeSelectAttributesFragment(options) {
    let fragment = '';

    const MINIMUM_EXECUTION_TIME_VALUE = 0;
    const MAXIMUM_EXECUTION_TIME_VALUE = 4_294_967_295;

    if (options.maxExecutionTimeHintMs != null) {
      if (Number.isSafeInteger(options.maxExecutionTimeHintMs)
        && options.maxExecutionTimeHintMs >= MINIMUM_EXECUTION_TIME_VALUE
        && options.maxExecutionTimeHintMs <= MAXIMUM_EXECUTION_TIME_VALUE) {
        fragment += ` /*+ MAX_EXECUTION_TIME(${options.maxExecutionTimeHintMs}) */`;
      } else {
        throw new Error(`maxExecutionTimeMs must be between ${MINIMUM_EXECUTION_TIME_VALUE} and ${MAXIMUM_EXECUTION_TIME_VALUE}, but it is ${inspect(options.maxExecutionTimeHintMs)}`);
      }
    }

    return fragment;
  }
}
