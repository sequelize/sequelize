'use strict';

import { addTicks, removeTicks } from '../../utils/dialect';
import { removeNullishValuesFromHash } from '../../utils/format';
import { EMPTY_OBJECT } from '../../utils/object.js';
import { defaultValueSchemable } from '../../utils/query-builder-utils';
import { rejectInvalidOptions } from '../../utils/check';
import { ADD_COLUMN_QUERY_SUPPORTABLE_OPTIONS, REMOVE_COLUMN_QUERY_SUPPORTABLE_OPTIONS } from '../abstract/query-generator';

const { Transaction } = require('../../transaction');
const _ = require('lodash');
const { SqliteQueryGeneratorTypeScript } = require('./query-generator-typescript');

const ADD_COLUMN_QUERY_SUPPORTED_OPTIONS = new Set();
const REMOVE_COLUMN_QUERY_SUPPORTED_OPTIONS = new Set();

export class SqliteQueryGenerator extends SqliteQueryGeneratorTypeScript {
  createSchemaQuery() {
    throw new Error(`Schemas are not supported in ${this.dialect.name}.`);
  }

  dropSchemaQuery() {
    throw new Error(`Schemas are not supported in ${this.dialect.name}.`);
  }

  listSchemasQuery() {
    throw new Error(`Schemas are not supported in ${this.dialect.name}.`);
  }

  versionQuery() {
    return 'SELECT sqlite_version() as `version`';
  }

  createTableQuery(tableName, attributes, options) {
    options = options || {};

    const primaryKeys = [];
    const needsMultiplePrimaryKeys = Object.values(attributes).filter(definition => definition.includes('PRIMARY KEY')).length > 1;
    const attrArray = [];

    for (const attr in attributes) {
      if (Object.prototype.hasOwnProperty.call(attributes, attr)) {
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
    //   _.each(options.uniqueKeys, (columns, indexName) => {
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

  addLimitAndOffset(options, model) {
    let fragment = '';
    if (options.limit != null) {
      fragment += ` LIMIT ${this.escape(options.limit, options)}`;
    } else if (options.offset) {
      // limit must be specified if offset is specified.
      fragment += ` LIMIT -1`;
    }

    if (options.offset) {
      fragment += ` OFFSET ${this.escape(options.offset, options)}`;
    }

    return fragment;
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

  showTablesQuery() {
    return 'SELECT name FROM `sqlite_master` WHERE type=\'table\' and name!=\'sqlite_sequence\';';
  }

  updateQuery(tableName, attrValueHash, where, options, attributes) {
    options = options || {};
    _.defaults(options, this.options);

    attrValueHash = removeNullishValuesFromHash(attrValueHash, options.omitNull, options);

    const modelAttributeMap = Object.create(null);
    const values = [];
    const bind = Object.create(null);
    const bindParam = options.bindParam === undefined ? this.bindParam(bind) : options.bindParam;

    if (attributes) {
      _.each(attributes, (attribute, key) => {
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
      query = `UPDATE ${this.quoteTable(tableName)} SET ${values.join(',')} WHERE rowid IN (SELECT rowid FROM ${this.quoteTable(tableName)} ${this.whereQuery(where, whereOptions)} LIMIT ${this.escape(options.limit, undefined, options)})`.trim();
    } else {
      query = `UPDATE ${this.quoteTable(tableName)} SET ${values.join(',')} ${this.whereQuery(where, whereOptions)}`.trim();
    }

    const result = { query };
    if (options.bindParam !== false) {
      result.bind = bind;
    }

    return result;
  }

  truncateTableQuery(tableName, options = {}) {
    return [
      `DELETE FROM ${this.quoteTable(tableName)}`,
      options.restartIdentity ? `; DELETE FROM ${this.quoteTable('sqlite_sequence')} WHERE ${this.quoteIdentifier('name')} = ${addTicks(removeTicks(this.quoteTable(tableName), '`'), '\'')};` : '',
    ].join('');
  }

  deleteQuery(tableName, where, options = EMPTY_OBJECT, model) {
    _.defaults(options, this.options);

    let whereClause = this.whereQuery(where, { ...options, model });
    if (whereClause) {
      whereClause = ` ${whereClause}`;
    }

    if (options.limit) {
      whereClause = `WHERE rowid IN (SELECT rowid FROM ${this.quoteTable(tableName)} ${whereClause} LIMIT ${this.escape(options.limit, options)})`;
    }

    return `DELETE FROM ${this.quoteTable(tableName)} ${whereClause}`.trim();
  }

  attributesToSQL(attributes, options) {
    const result = {};
    for (const name in attributes) {
      const attribute = attributes[name];
      const columnName = attribute.field || attribute.columnName || name;

      if (_.isObject(attribute)) {
        let sql = attribute.type.toString();

        if (attribute.allowNull === false) {
          sql += ' NOT NULL';
        }

        if (defaultValueSchemable(attribute.defaultValue)) {
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

  showConstraintsQuery(tableName, constraintName) {
    let sql = `SELECT sql FROM sqlite_master WHERE tbl_name='${tableName}'`;

    if (constraintName) {
      sql += ` AND sql LIKE '%${constraintName}%'`;
    }

    return `${sql};`;
  }

  describeCreateTableQuery(tableName) {
    return `SELECT sql FROM sqlite_master WHERE tbl_name='${tableName}';`;
  }

  // TODO: this should not implement `removeColumnQuery` but a new sqlite specific function possibly called `replaceTableQuery`
  removeColumnQuery(tableName, attributes, options) {
    if (options) {
      rejectInvalidOptions(
        'removeColumnQuery',
        this.dialect.name,
        REMOVE_COLUMN_QUERY_SUPPORTABLE_OPTIONS,
        REMOVE_COLUMN_QUERY_SUPPORTED_OPTIONS,
        options,
      );
    }

    attributes = this.attributesToSQL(attributes);

    const table = this.extractTableDetails(tableName);

    // TODO: this is unsafe, this table could already exist
    const backupTableName = {
      tableName: `${table.tableName}_backup`,
      schema: table.schema,
      delimiter: table.delimiter,
    };

    const quotedTableName = this.quoteTable(tableName);
    const quotedBackupTableName = this.quoteTable(backupTableName);
    const attributeNames = Object.keys(attributes).map(attr => this.quoteIdentifier(attr)).join(', ');

    return `${this.createTableQuery(backupTableName, attributes)}`
      + `INSERT INTO ${quotedBackupTableName} SELECT ${attributeNames} FROM ${quotedTableName};`
      + `DROP TABLE ${quotedTableName};`
      + `ALTER TABLE ${quotedBackupTableName} RENAME TO ${quotedTableName};`;
  }

  _alterConstraintQuery(tableName, attributes, createTableSql) {
    let backupTableName;

    attributes = this.attributesToSQL(attributes);

    if (typeof tableName === 'object') {
      backupTableName = {
        tableName: `${tableName.tableName}_backup`,
        schema: tableName.schema,
      };
    } else {
      backupTableName = `${tableName}_backup`;
    }

    const quotedTableName = this.quoteTable(tableName);
    const quotedBackupTableName = this.quoteTable(backupTableName);
    const attributeNames = Object.keys(attributes).map(attr => this.quoteIdentifier(attr)).join(', ');

    return `${createTableSql
      .replace(`CREATE TABLE ${quotedTableName}`, `CREATE TABLE ${quotedBackupTableName}`)
      .replace(`CREATE TABLE ${quotedTableName.replace(/`/g, '"')}`, `CREATE TABLE ${quotedBackupTableName}`)
    }INSERT INTO ${quotedBackupTableName} SELECT ${attributeNames} FROM ${quotedTableName};`
      + `DROP TABLE ${quotedTableName};`
      + `ALTER TABLE ${quotedBackupTableName} RENAME TO ${quotedTableName};`;
  }

  renameColumnQuery(tableName, attrNameBefore, attrNameAfter, attributes) {

    let backupTableName;

    attributes = this.attributesToSQL(attributes);

    if (typeof tableName === 'object') {
      backupTableName = {
        tableName: `${tableName.tableName}_backup`,
        schema: tableName.schema,
      };
    } else {
      backupTableName = `${tableName}_backup`;
    }

    const quotedTableName = this.quoteTable(tableName);
    const quotedBackupTableName = this.quoteTable(backupTableName);
    const attributeNamesImport = Object.keys(attributes).map(attr => (attrNameAfter === attr ? `${this.quoteIdentifier(attrNameBefore)} AS ${this.quoteIdentifier(attr)}` : this.quoteIdentifier(attr))).join(', ');
    const attributeNamesExport = Object.keys(attributes).map(attr => this.quoteIdentifier(attr)).join(', ');

    // Temporary tables don't support foreign keys, so creating a temporary table will not allow foreign keys to be preserved
    return `${this.createTableQuery(backupTableName, attributes)
    }INSERT INTO ${quotedBackupTableName} SELECT ${attributeNamesImport} FROM ${quotedTableName};`
      + `DROP TABLE ${quotedTableName};${
        this.createTableQuery(tableName, attributes)
      }INSERT INTO ${quotedTableName} SELECT ${attributeNamesExport} FROM ${quotedBackupTableName};`
      + `DROP TABLE ${quotedBackupTableName};`;
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
    return sql.replace(/DEFAULT '?false'?/g, 'DEFAULT 0').replace(/DEFAULT '?true'?/g, 'DEFAULT 1');
  }

  tableExistsQuery(tableName) {
    return `SELECT name FROM sqlite_master WHERE type='table' AND name=${this.escape(this.extractTableDetails(tableName).tableName)};`;
  }

  /**
   * Generates an SQL query to check if there are any foreign key violations in the db schema
   *
   * @param {string} tableName  The name of the table
   */
  foreignKeyCheckQuery(tableName) {
    return `PRAGMA foreign_key_check(${this.quoteTable(tableName)});`;
  }
}
