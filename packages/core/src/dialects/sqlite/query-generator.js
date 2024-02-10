'use strict';

import { removeNullishValuesFromHash } from '../../utils/format';
import { defaultValueSchemable } from '../../utils/query-builder-utils';
import { rejectInvalidOptions } from '../../utils/check';
import { ADD_COLUMN_QUERY_SUPPORTABLE_OPTIONS, CREATE_TABLE_QUERY_SUPPORTABLE_OPTIONS } from '../abstract/query-generator';
import { SqliteQueryGeneratorInternal } from './query-generator-internal';

import defaults from 'lodash/defaults';
import each from 'lodash/each';
import isObject from 'lodash/isObject';

const { Transaction } = require('../../transaction');
const { SqliteQueryGeneratorTypeScript } = require('./query-generator-typescript');

const ADD_COLUMN_QUERY_SUPPORTED_OPTIONS = new Set();
// TODO: add support for 'uniqueKeys' by improving the createTableQuery implementation so it also generates a CREATE UNIQUE INDEX query
const CREATE_TABLE_QUERY_SUPPORTED_OPTIONS = new Set();

export class SqliteQueryGenerator extends SqliteQueryGeneratorTypeScript {
  #internals;

  constructor(
    dialect,
    internals = new SqliteQueryGeneratorInternal(dialect),
  ) {
    super(dialect, internals);

    this.#internals = internals;
  }

  createTableQuery(tableName, attributes, options) {
    if (options) {
      rejectInvalidOptions(
        'createTableQuery',
        this.dialect.name,
        CREATE_TABLE_QUERY_SUPPORTABLE_OPTIONS,
        CREATE_TABLE_QUERY_SUPPORTED_OPTIONS,
        options,
      );
    }

    options = options || {};

    const primaryKeys = [];
    const needsMultiplePrimaryKeys = Object.values(attributes).filter(definition => definition.includes('PRIMARY KEY')).length > 1;
    const attrArray = [];

    for (const attr in attributes) {
      if (Object.hasOwn(attributes, attr)) {
        const dataType = attributes[attr];
        const containsAutoIncrement = dataType.includes('AUTOINCREMENT');

        let dataTypeString = dataType;
        if (dataType.includes('PRIMARY KEY')) {
          if (dataType.includes('INT')) {
            // Only INTEGER is allowed for primary key, see https://github.com/sequelize/sequelize/issues/969 (no lenght, unsigned etc)
            dataTypeString = containsAutoIncrement ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'INTEGER PRIMARY KEY';

            if (dataType.includes(' REFERENCES')) {
              dataTypeString += dataType.slice(dataType.indexOf(' REFERENCES'));
            }
          }

          if (needsMultiplePrimaryKeys) {
            primaryKeys.push(attr);
            if (dataType.includes('NOT NULL')) {
              dataTypeString = dataType.replace(' PRIMARY KEY', '');
            } else {
              dataTypeString = dataType.replace('PRIMARY KEY', 'NOT NULL');
            }
          }
        }

        attrArray.push(`${this.quoteIdentifier(attr)} ${dataTypeString}`);
      }
    }

    const table = this.quoteTable(tableName);
    let attrStr = attrArray.join(', ');
    const pkString = primaryKeys.map(pk => this.quoteIdentifier(pk)).join(', ');

    // sqlite has a bug where using CONSTRAINT constraint_name UNIQUE during CREATE TABLE
    //  does not respect the provided constraint name
    //  and uses sqlite_autoindex_ as the name of the constraint instead.
    //  CREATE UNIQUE INDEX does not have this issue, so we're using that instead
    //
    // if (options.uniqueKeys) {
    //   each(options.uniqueKeys, (columns, indexName) => {
    //     if (columns.customIndex) {
    //       if (typeof indexName !== 'string') {
    //         indexName = generateIndexName(tableName, columns);
    //       }
    //
    //       attrStr += `, CONSTRAINT ${
    //         this.quoteIdentifier(indexName)
    //       } UNIQUE (${
    //         columns.fields.map(field => this.quoteIdentifier(field)).join(', ')
    //       })`;
    //     }
    //   });
    // }

    if (pkString.length > 0) {
      attrStr += `, PRIMARY KEY (${pkString})`;
    }

    const sql = `CREATE TABLE IF NOT EXISTS ${table} (${attrStr});`;

    return this.replaceBooleanDefaults(sql);
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

    const attributes = {};
    attributes[key] = dataType;
    const fields = this.attributesToSQL(attributes, { context: 'addColumn' });
    const attribute = `${this.quoteIdentifier(key)} ${fields[key]}`;

    const sql = `ALTER TABLE ${this.quoteTable(table)} ADD ${attribute};`;

    return this.replaceBooleanDefaults(sql);
  }

  updateQuery(tableName, attrValueHash, where, options, attributes) {
    options = options || {};
    defaults(options, this.options);

    attrValueHash = removeNullishValuesFromHash(attrValueHash, options.omitNull, options);

    const modelAttributeMap = Object.create(null);
    const values = [];
    const bind = Object.create(null);
    const bindParam = options.bindParam === undefined ? this.#internals.bindParam(bind) : options.bindParam;
    let suffix = '';

    if (options.returning) {
      const returnValues = this.generateReturnValues(attributes, options);

      suffix += returnValues.returningFragment;

      // ensure that the return output is properly mapped to model fields.
      if (this.dialect.supports.returnValues) {
        options.mapToModel = true;
      }
    }

    if (attributes) {
      each(attributes, (attribute, key) => {
        modelAttributeMap[key] = attribute;
        if (attribute.field) {
          modelAttributeMap[attribute.field] = attribute;
        }
      });
    }

    for (const key in attrValueHash) {
      const value = attrValueHash[key] ?? null;

      const escapedValue = this.escape(value, {
        replacements: options.replacements,
        bindParam,
        type: modelAttributeMap[key]?.type,
        // TODO: model,
      });

      values.push(`${this.quoteIdentifier(key)}=${escapedValue}`);
    }

    let query;
    const whereOptions = { ...options, bindParam };

    if (options.limit) {
      query = `UPDATE ${this.quoteTable(tableName)} SET ${values.join(',')} WHERE rowid IN (SELECT rowid FROM ${this.quoteTable(tableName)} ${this.whereQuery(where, whereOptions)} LIMIT ${this.escape(options.limit, undefined, options)})${suffix}`.trim();
    } else {
      query = `UPDATE ${this.quoteTable(tableName)} SET ${values.join(',')} ${this.whereQuery(where, whereOptions)}${suffix}`.trim();
    }

    const result = { query };
    if (options.bindParam !== false) {
      result.bind = bind;
    }

    return result;
  }

  attributesToSQL(attributes, options) {
    const result = {};
    for (const name in attributes) {
      const attribute = attributes[name];
      const columnName = attribute.field || attribute.columnName || name;

      if (isObject(attribute)) {
        let sql = attribute.type.toString();

        if (attribute.allowNull === false) {
          sql += ' NOT NULL';
        }

        if (defaultValueSchemable(attribute.defaultValue, this.dialect)) {
          // TODO thoroughly check that DataTypes.NOW will properly
          // get populated on all databases as DEFAULT value
          // i.e. mysql requires: DEFAULT CURRENT_TIMESTAMP
          sql += ` DEFAULT ${this.escape(attribute.defaultValue, { ...options, type: attribute.type })}`;
        }

        if (attribute.unique === true) {
          sql += ' UNIQUE';
        }

        if (attribute.primaryKey) {
          sql += ' PRIMARY KEY';

          if (attribute.autoIncrement) {
            sql += ' AUTOINCREMENT';
          }
        }

        if (attribute.references) {
          const referencesTable = this.quoteTable(attribute.references.table);

          let referencesKey;
          if (attribute.references.key) {
            referencesKey = this.quoteIdentifier(attribute.references.key);
          } else {
            referencesKey = this.quoteIdentifier('id');
          }

          sql += ` REFERENCES ${referencesTable} (${referencesKey})`;

          if (attribute.onDelete) {
            sql += ` ON DELETE ${attribute.onDelete.toUpperCase()}`;
          }

          if (attribute.onUpdate) {
            sql += ` ON UPDATE ${attribute.onUpdate.toUpperCase()}`;
          }
        }

        result[columnName] = sql;
      } else {
        result[columnName] = attribute;
      }
    }

    return result;
  }

  startTransactionQuery(transaction) {
    if (transaction.parent) {
      return `SAVEPOINT ${this.quoteIdentifier(transaction.name)};`;
    }

    return `BEGIN ${transaction.options.type} TRANSACTION;`;
  }

  setIsolationLevelQuery(value) {
    switch (value) {
      case Transaction.ISOLATION_LEVELS.REPEATABLE_READ:
        return '-- SQLite is not able to choose the isolation level REPEATABLE READ.';
      case Transaction.ISOLATION_LEVELS.READ_UNCOMMITTED:
        return 'PRAGMA read_uncommitted = ON;';
      case Transaction.ISOLATION_LEVELS.READ_COMMITTED:
        return 'PRAGMA read_uncommitted = OFF;';
      case Transaction.ISOLATION_LEVELS.SERIALIZABLE:
        return '-- SQLite\'s default isolation level is SERIALIZABLE. Nothing to do.';
      default:
        throw new Error(`Unknown isolation level: ${value}`);
    }
  }

  replaceBooleanDefaults(sql) {
    return sql.replaceAll(/DEFAULT '?false'?/g, 'DEFAULT 0').replaceAll(/DEFAULT '?true'?/g, 'DEFAULT 1');
  }
}
