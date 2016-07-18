'use strict';

/* jshint -W110 */
const Utils = require('../../utils');
const Transaction = require('../../transaction');
const _ = require('lodash');
const MySqlQueryGenerator = require('../mysql/query-generator');

const QueryGenerator = {
  /* jshint proto:true */
  __proto__: MySqlQueryGenerator,
  options: {},
  dialect: 'sqlite',

  createSchema() {
    return "SELECT name FROM `sqlite_master` WHERE type='table' and name!='sqlite_sequence';";
  },

  showSchemasQuery() {
    return "SELECT name FROM `sqlite_master` WHERE type='table' and name!='sqlite_sequence';";
  },

  versionQuery() {
    return 'SELECT sqlite_version() as `version`';
  },

  createTableQuery(tableName, attributes, options) {
    options = options || {};

    const primaryKeys = [];
    const needsMultiplePrimaryKeys = (Utils._.values(attributes).filter(definition => _.includes(definition, 'PRIMARY KEY')).length > 1);
    const attrArray = [];

    for (const attr in attributes) {
      if (attributes.hasOwnProperty(attr)) {
        let dataType = attributes[attr];
        const containsAutoIncrement = Utils._.includes(dataType, 'AUTOINCREMENT');

        if (containsAutoIncrement) {
          dataType = dataType.replace(/BIGINT/, 'INTEGER');
        }

        let dataTypeString = dataType;
        if (Utils._.includes(dataType, 'PRIMARY KEY')) {
          if (Utils._.includes(dataType, 'INTEGER')) { // Only INTEGER is allowed for primary key, see https://github.com/sequelize/sequelize/issues/969 (no lenght, unsigned etc)
            dataTypeString = containsAutoIncrement ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'INTEGER PRIMARY KEY';
          }

          if (needsMultiplePrimaryKeys) {
            primaryKeys.push(attr);
            dataTypeString = dataType.replace(/PRIMARY KEY/, 'NOT NULL');
          }
        }
        attrArray.push(this.quoteIdentifier(attr) + ' ' + dataTypeString);
      }
    }

    const table = this.quoteTable(tableName);
    let attrStr = attrArray.join(', ');
    const pkString = primaryKeys.map(pk => this.quoteIdentifier(pk)).join(', ');

    if (!!options.uniqueKeys) {
      Utils._.each(options.uniqueKeys, columns => {
        if (!columns.singleField) { // If it's a single field its handled in column def, not as an index
          attrStr += ', UNIQUE (' + columns.fields.join(', ') + ')';
        }
      });
    }

    if (pkString.length > 0) {
      attrStr += ', PRIMARY KEY (' + pkString + ')';
    }

    const sql = `CREATE TABLE IF NOT EXISTS ${table} (${attrStr});`;
    return this.replaceBooleanDefaults(sql);
  },

  booleanValue(value){
    return !!value ? 1 : 0;
  },

  addColumnQuery(table, key, dataType) {

    const attributes = {};
    attributes[key] = dataType;
    const fields = this.attributesToSQL(attributes, {context: 'addColumn'});
    const attribute = this.quoteIdentifier(key) + ' ' + fields[key];

    const sql = `ALTER TABLE ${this.quoteTable(table)} ADD ${attribute};`;

    return this.replaceBooleanDefaults(sql);
  },

  showTablesQuery() {
    return "SELECT name FROM `sqlite_master` WHERE type='table' and name!='sqlite_sequence';";
  },

  upsertQuery(tableName, insertValues, updateValues, where, rawAttributes, options) {
    options.ignoreDuplicates = true;

    const sql = this.insertQuery(tableName, insertValues, rawAttributes, options) + ' ' + this.updateQuery(tableName, updateValues, where, options, rawAttributes);

    return sql;
  },

  updateQuery(tableName, attrValueHash, where, options, attributes) {
    options = options || {};
    _.defaults(options, this.options);

    attrValueHash = Utils.removeNullValuesFromHash(attrValueHash, options.omitNull, options);

    const modelAttributeMap = {};
    const values = [];

    if (attributes) {
      _.each(attributes, (attribute, key) => {
        modelAttributeMap[key] = attribute;
        if (attribute.field) {
          modelAttributeMap[attribute.field] = attribute;
        }
      });
    }

    for (const key in attrValueHash) {
      const value = attrValueHash[key];
      values.push(this.quoteIdentifier(key) + '=' + this.escape(value, (modelAttributeMap && modelAttributeMap[key] || undefined), { context: 'UPDATE' }));
    }

    return `UPDATE ${this.quoteTable(tableName)} SET ${values.join(',')} ${this.whereQuery(where)}`;
  },

  deleteQuery(tableName, where, options) {
    options = options || {};

    let whereClause = this.getWhereConditions(where);
    if (whereClause) {
      whereClause = ' WHERE ' + whereClause;
    }

    return `DELETE FROM ${this.quoteTable(tableName)}${whereClause}`;
  },

  attributesToSQL(attributes) {
    const result = {};

    for (const name in attributes) {
      const dataType = attributes[name];
      const fieldName = dataType.field || name;

      if (Utils._.isObject(dataType)) {
        let sql = dataType.type.toString();

        if (dataType.hasOwnProperty('allowNull') && !dataType.allowNull) {
          sql += ' NOT NULL';
        }

        if (Utils.defaultValueSchemable(dataType.defaultValue)) {
          // TODO thoroughly check that DataTypes.NOW will properly
          // get populated on all databases as DEFAULT value
          // i.e. mysql requires: DEFAULT CURRENT_TIMESTAMP
          sql += ' DEFAULT ' + this.escape(dataType.defaultValue, dataType);
        }

        if (dataType.unique === true) {
          sql += ' UNIQUE';
        }

        if (dataType.primaryKey) {
          sql += ' PRIMARY KEY';

          if (dataType.autoIncrement) {
            sql += ' AUTOINCREMENT';
          }
        }

        if(dataType.references) {
          const referencesTable = this.quoteTable(dataType.references.model);

          let referencesKey;
          if(dataType.references.key) {
            referencesKey = this.quoteIdentifier(dataType.references.key);
          } else {
            referencesKey = this.quoteIdentifier('id');
          }

          sql += ` REFERENCES ${referencesTable} (${referencesKey})`;

          if(dataType.onDelete) {
            sql += ' ON DELETE ' + dataType.onDelete.toUpperCase();
          }

          if(dataType.onUpdate) {
            sql += ' ON UPDATE ' + dataType.onUpdate.toUpperCase();
          }

        }

        result[fieldName] = sql;
      } else {
        result[fieldName] = dataType;
      }
    }

    return result;
  },

  findAutoIncrementField(factory) {
    const fields = [];

    for (const name in factory.attributes) {
      if (factory.attributes.hasOwnProperty(name)) {
        const definition = factory.attributes[name];
        if (definition && definition.autoIncrement) {
          fields.push(name);
        }
      }
    }

    return fields;
  },

  showIndexesQuery(tableName) {
    return `PRAGMA INDEX_LIST(${this.quoteTable(tableName)})`;
  },

  removeIndexQuery(tableName, indexNameOrAttributes) {
    let indexName = indexNameOrAttributes;

    if (typeof indexName !== 'string') {
      indexName = Utils.underscore(tableName + '_' + indexNameOrAttributes.join('_'));
    }

    return `DROP INDEX IF EXISTS ${this.quoteIdentifier(indexName)}`;
  },

  describeTableQuery(tableName, schema, schemaDelimiter) {
    const table = {
      _schema: schema,
      _schemaDelimiter: schemaDelimiter,
      tableName
    };
    return `PRAGMA TABLE_INFO(${this.quoteTable(this.addSchema(table))});`;
  },

  removeColumnQuery(tableName, attributes) {

    attributes = this.attributesToSQL(attributes);

    let backupTableName;
    if (typeof tableName === 'object') {
      backupTableName = {
        tableName: tableName.tableName + '_backup',
        schema: tableName.schema
      };
    } else {
      backupTableName = tableName + '_backup';
    }

    const quotedTableName = this.quoteTable(tableName);
    const quotedBackupTableName = this.quoteTable(backupTableName);
    const attributeNames = Object.keys(attributes).join(', ');

    return this.createTableQuery(backupTableName, attributes).replace('CREATE TABLE', 'CREATE TEMPORARY TABLE')
      + `INSERT INTO ${quotedBackupTableName} SELECT ${attributeNames} FROM ${quotedTableName};`
      + `DROP TABLE ${quotedTableName};`
      + this.createTableQuery(tableName, attributes)
      + `INSERT INTO ${quotedTableName} SELECT ${attributeNames} FROM ${quotedBackupTableName};`
      + `DROP TABLE ${quotedBackupTableName};`;
  },

  renameColumnQuery(tableName, attrNameBefore, attrNameAfter, attributes) {

    let backupTableName;

    attributes = this.attributesToSQL(attributes);

    if (typeof tableName === 'object') {
      backupTableName = {
        tableName: tableName.tableName + '_backup',
        schema: tableName.schema
      };
    } else {
      backupTableName = tableName + '_backup';
    }

    const quotedTableName = this.quoteTable(tableName);
    const quotedBackupTableName = this.quoteTable(backupTableName);
    const attributeNamesImport = Object.keys(attributes).map(attr =>
      (attrNameAfter === attr) ? this.quoteIdentifier(attrNameBefore) + ' AS ' + this.quoteIdentifier(attr) : this.quoteIdentifier(attr)
    ).join(', ');
    const attributeNamesExport = Object.keys(attributes).map(attr => this.quoteIdentifier(attr)).join(', ');

    return this.createTableQuery(backupTableName, attributes).replace('CREATE TABLE', 'CREATE TEMPORARY TABLE')
      + `INSERT INTO ${quotedBackupTableName} SELECT ${attributeNamesImport} FROM ${quotedTableName};`
      + `DROP TABLE ${quotedTableName};`
      + this.createTableQuery(tableName, attributes)
      + `INSERT INTO ${quotedTableName} SELECT ${attributeNamesExport} FROM ${quotedBackupTableName};`
      + `DROP TABLE ${quotedBackupTableName};`;
  },

  startTransactionQuery(transaction, options) {
    if (transaction.parent) {
      return 'SAVEPOINT ' + this.quoteIdentifier(transaction.name) + ';';
    }

    return 'BEGIN ' + transaction.options.type  + ' TRANSACTION;';
  },

  setAutocommitQuery() {
    // SQLite does not support SET autocommit
    return null;
  },

  setIsolationLevelQuery(value) {
    switch (value) {
      case Transaction.ISOLATION_LEVELS.REPEATABLE_READ:
        return '-- SQLite is not able to choose the isolation level REPEATABLE READ.';
      case Transaction.ISOLATION_LEVELS.READ_UNCOMMITTED:
        return 'PRAGMA read_uncommitted = ON;';
      case Transaction.ISOLATION_LEVELS.READ_COMMITTED:
        return 'PRAGMA read_uncommitted = OFF;';
      case Transaction.ISOLATION_LEVELS.SERIALIZABLE:
        return "-- SQLite's default isolation level is SERIALIZABLE. Nothing to do.";
      default:
        throw new Error('Unknown isolation level: ' + value);
    }
  },

  replaceBooleanDefaults(sql) {
    return sql.replace(/DEFAULT '?false'?/g, 'DEFAULT 0').replace(/DEFAULT '?true'?/g, 'DEFAULT 1');
  },

  quoteIdentifier(identifier) {
    if (identifier === '*') return identifier;
    return Utils.addTicks(identifier, '`');
  },

  /**
   * Generates an SQL query that returns all foreign keys of a table.
   *
   * @param  {String} tableName  The name of the table.
   * @param  {String} schemaName The name of the schema.
   * @return {String}            The generated sql query.
   */
  getForeignKeysQuery(tableName, schemaName) {
    return `PRAGMA foreign_key_list(${tableName})`;
  }
};

module.exports = QueryGenerator;
