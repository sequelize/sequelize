'use strict';

/* jshint -W110 */
var Utils = require('../../utils')
  , Transaction = require('../../transaction')
  , _ = require('lodash');

var MySqlQueryGenerator = Utils._.extend(
  Utils._.clone(require('../abstract/query-generator')),
  Utils._.clone(require('../mysql/query-generator'))
);

var QueryGenerator = {
  options: {},
  dialect: 'sqlite',

  createSchema: function() {
    var query = "SELECT name FROM `sqlite_master` WHERE type='table' and name!='sqlite_sequence';";
    return Utils._.template(query)({});
  },

  showSchemasQuery: function() {
    return "SELECT name FROM `sqlite_master` WHERE type='table' and name!='sqlite_sequence';";
  },

  versionQuery: function() {
    return 'SELECT sqlite_version() as `version`';
  },

  createTableQuery: function(tableName, attributes, options) {
    options = options || {};

    var query = 'CREATE TABLE IF NOT EXISTS <%= table %> (<%= attributes%>)'
      , primaryKeys = []
      , needsMultiplePrimaryKeys = (Utils._.values(attributes).filter(function(definition) {
          return Utils._.includes(definition, 'PRIMARY KEY');
        }).length > 1)
      , attrStr = [];

    for (var attr in attributes) {
      if (attributes.hasOwnProperty(attr)) {
        var dataType = attributes[attr];
        var containsAutoIncrement = Utils._.includes(dataType, 'AUTOINCREMENT');

        if (containsAutoIncrement) {
          dataType = dataType.replace(/BIGINT/, 'INTEGER');
        }

        var dataTypeString = dataType;
        if (Utils._.includes(dataType, 'PRIMARY KEY')) {
          if (Utils._.includes(dataType, 'INTEGER')) { // Only INTEGER is allowed for primary key, see https://github.com/sequelize/sequelize/issues/969 (no lenght, unsigned etc)
            dataTypeString = containsAutoIncrement ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'INTEGER PRIMARY KEY';
          }

          if (needsMultiplePrimaryKeys) {
            primaryKeys.push(attr);
            dataTypeString = dataType.replace(/PRIMARY KEY/, 'NOT NULL');
          }
        }
        attrStr.push(this.quoteIdentifier(attr) + ' ' + dataTypeString);
      }
    }

    var values = {
      table: this.quoteTable(tableName),
      attributes: attrStr.join(', '),
      charset: (options.charset ? 'DEFAULT CHARSET=' + options.charset : '')
    }
    , pkString = primaryKeys.map(function(pk) { return this.quoteIdentifier(pk); }.bind(this)).join(', ');

    if (!!options.uniqueKeys) {
      var quoteIdentifier = this.quoteIdentifier.bind(this);
      Utils._.each(options.uniqueKeys, function(columns) {
        if (!columns.singleField) { // If it's a single field its handled in column def, not as an index
          values.attributes += ', UNIQUE (' + columns.fields.map(function(field) { return quoteIdentifier(field); }).join(', ') + ')';
        }
      });
    }

    if (pkString.length > 0) {
      values.attributes += ', PRIMARY KEY (' + pkString + ')';
    }

    var sql = Utils._.template(query)(values).trim() + ';';
    return this.replaceBooleanDefaults(sql);
  },

  booleanValue: function(value){
    return !!value ? 1 : 0;
  },

  addColumnQuery: function(table, key, dataType) {
    var query = 'ALTER TABLE <%= table %> ADD <%= attribute %>;'
      , attributes = {};

    attributes[key] = dataType;
    var fields = this.attributesToSQL(attributes, {
      context: 'addColumn'
    });
    var attribute = Utils._.template('<%= key %> <%= definition %>')({
        key: this.quoteIdentifier(key),
        definition: fields[key]
      });

    var sql =  Utils._.template(query)({
      table: this.quoteTable(table),
      attribute: attribute
    });

    return this.replaceBooleanDefaults(sql);
  },

  showTablesQuery: function() {
    return "SELECT name FROM `sqlite_master` WHERE type='table' and name!='sqlite_sequence';";
  },

  upsertQuery: function (tableName, insertValues, updateValues, where, rawAttributes, options) {
    options.ignore = true;

    var sql = this.insertQuery(tableName, insertValues, rawAttributes, options) + ' ' + this.updateQuery(tableName, updateValues, where, options, rawAttributes);

    return sql;
  },

  updateQuery: function(tableName, attrValueHash, where, options, attributes) {
    options = options || {};
    _.defaults(options, this.options);

    attrValueHash = Utils.removeNullValuesFromHash(attrValueHash, options.omitNull, options);

    var query  = 'UPDATE <%= table %> SET <%= values %> <%= where %>'
      , modelAttributeMap = {}
      , values = [];

    if (attributes) {
      _.each(attributes, function(attribute, key) {
        modelAttributeMap[key] = attribute;
        if (attribute.field) {
          modelAttributeMap[attribute.field] = attribute;
        }
      });
    }

    for (var key in attrValueHash) {
      var value = attrValueHash[key];
      values.push(this.quoteIdentifier(key) + '=' + this.escape(value, (modelAttributeMap && modelAttributeMap[key] || undefined), { context: 'UPDATE' }));
    }

    var replacements = {
      table: this.quoteTable(tableName),
      values: values.join(','),
      where: this.whereQuery(where)
    };

    return Utils._.template(query)(replacements).trim();
  },

  deleteQuery: function(tableName, where, options) {
    options = options || {};

    var query = 'DELETE FROM <%= table %><%= where %>';
    var replacements = {
      table: this.quoteTable(tableName),
      where: this.getWhereConditions(where)
    };

    if (replacements.where) {
      replacements.where = ' WHERE ' + replacements.where;
    }

    return Utils._.template(query)(replacements);
  },

  attributesToSQL: function(attributes) {
    var result = {};

    for (var name in attributes) {
      var dataType = attributes[name];
      var fieldName = dataType.field || name;

      if (Utils._.isObject(dataType)) {
        var template     = '<%= type %>'
          , replacements = { type: dataType.type.toString() };

        if (dataType.hasOwnProperty('allowNull') && !dataType.allowNull) {
          template += ' NOT NULL';
        }

        if (Utils.defaultValueSchemable(dataType.defaultValue)) {
          // TODO thoroughly check that DataTypes.NOW will properly
          // get populated on all databases as DEFAULT value
          // i.e. mysql requires: DEFAULT CURRENT_TIMESTAMP
          template += ' DEFAULT <%= defaultValue %>';
          replacements.defaultValue = this.escape(dataType.defaultValue, dataType);
        }

        if (dataType.unique === true) {
          template += ' UNIQUE';
        }

        if (dataType.primaryKey) {
          template += ' PRIMARY KEY';

          if (dataType.autoIncrement) {
            template += ' AUTOINCREMENT';
          }
        }

        if(dataType.references) {
          dataType = Utils.formatReferences(dataType);
          template += ' REFERENCES <%= referencesTable %> (<%= referencesKey %>)';
          replacements.referencesTable = this.quoteTable(dataType.references.model);

          if(dataType.references.key) {
            replacements.referencesKey = this.quoteIdentifier(dataType.references.key);
          } else {
            replacements.referencesKey = this.quoteIdentifier('id');
          }

          if(dataType.onDelete) {
            template += ' ON DELETE <%= onDeleteAction %>';
            replacements.onDeleteAction = dataType.onDelete.toUpperCase();
          }

          if(dataType.onUpdate) {
            template += ' ON UPDATE <%= onUpdateAction %>';
            replacements.onUpdateAction = dataType.onUpdate.toUpperCase();
          }

        }

        result[fieldName] = Utils._.template(template)(replacements);
      } else {
        result[fieldName] = dataType;
      }
    }

    return result;
  },

  findAutoIncrementField: function(factory) {
    var fields = [];

    for (var name in factory.attributes) {
      if (factory.attributes.hasOwnProperty(name)) {
        var definition = factory.attributes[name];
        if (definition && definition.autoIncrement) {
          fields.push(name);
        }
      }
    }

    return fields;
  },

  showIndexesQuery: function(tableName) {
    var sql = 'PRAGMA INDEX_LIST(<%= tableName %>)';
    return Utils._.template(sql)({ tableName: this.quoteTable(tableName) });
  },

  removeIndexQuery: function(tableName, indexNameOrAttributes) {
    var sql = 'DROP INDEX IF EXISTS <%= indexName %>'
      , indexName = indexNameOrAttributes;

    if (typeof indexName !== 'string') {
      indexName = Utils.inflection.underscore(tableName + '_' + indexNameOrAttributes.join('_'));
    }

    return Utils._.template(sql)( { tableName: this.quoteIdentifiers(tableName), indexName: indexName });
  },

  describeTableQuery: function(tableName, schema, schemaDelimiter) {
    var table = {};
    table.$schema = schema;
    table.$schemaDelimiter = schemaDelimiter;
    table.tableName = tableName;

    var sql = 'PRAGMA TABLE_INFO(<%= tableName %>);';
    return Utils._.template(sql)({tableName: this.quoteTable(this.addSchema(table))});
  },

  removeColumnQuery: function(tableName, attributes) {
    var backupTableName
      , query;

    attributes = this.attributesToSQL(attributes);

    if (typeof tableName === 'object') {
      backupTableName = {
        tableName: tableName.tableName + '_backup',
        schema: tableName.schema
      };
    } else {
      backupTableName = tableName + '_backup';
    }

    query = [
      this.createTableQuery(backupTableName, attributes).replace('CREATE TABLE', 'CREATE TEMPORARY TABLE'),
      'INSERT INTO <%= backupTableName %> SELECT <%= attributeNames %> FROM <%= tableName %>;',
      'DROP TABLE <%= tableName %>;',
      this.createTableQuery(tableName, attributes),
      'INSERT INTO <%= tableName %> SELECT <%= attributeNames %> FROM <%= backupTableName %>;',
      'DROP TABLE <%= backupTableName %>;'
    ].join('');

    return Utils._.template(query)({
      tableName: this.quoteTable(tableName),
      backupTableName: this.quoteTable(backupTableName),
      attributeNames: Utils._.keys(attributes).join(', ')
    });
  },

  renameColumnQuery: function(tableName, attrNameBefore, attrNameAfter, attributes) {
    var backupTableName
      , query;

    attributes = this.attributesToSQL(attributes);

    if (typeof tableName === 'object') {
      backupTableName = {
        tableName: tableName.tableName + '_backup',
        schema: tableName.schema
      };
    } else {
      backupTableName = tableName + '_backup';
    }

    query = [
      this.createTableQuery(backupTableName, attributes).replace('CREATE TABLE', 'CREATE TEMPORARY TABLE'),
      'INSERT INTO <%= backupTableName %> SELECT <%= attributeNamesImport %> FROM <%= tableName %>;',
      'DROP TABLE <%= tableName %>;',
      this.createTableQuery(tableName, attributes),
      'INSERT INTO <%= tableName %> SELECT <%= attributeNamesExport %> FROM <%= backupTableName %>;',
      'DROP TABLE <%= backupTableName %>;'
    ].join('');

    return Utils._.template(query)({
      tableName: this.quoteTable(tableName),
      backupTableName: this.quoteTable(backupTableName),
      attributeNamesImport: Utils._.keys(attributes).map(function(attr) {
        return (attrNameAfter === attr) ? this.quoteIdentifier(attrNameBefore) + ' AS ' + this.quoteIdentifier(attr) : this.quoteIdentifier(attr);
      }.bind(this)).join(', '),
      attributeNamesExport: Utils._.keys(attributes).map(function(attr) {
        return this.quoteIdentifier(attr);
      }.bind(this)).join(', ')
    });
  },

  startTransactionQuery: function(transaction, options) {
    if (transaction.parent) {
      return 'SAVEPOINT ' + this.quoteIdentifier(transaction.name) + ';';
    }

    return 'BEGIN ' + transaction.options.type  + ' TRANSACTION;';
  },

  setAutocommitQuery: function() {
    return '-- SQLite does not support SET autocommit.';
  },

  setIsolationLevelQuery: function(value) {
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

  replaceBooleanDefaults: function(sql) {
    return sql.replace(/DEFAULT '?false'?/g, 'DEFAULT 0').replace(/DEFAULT '?true'?/g, 'DEFAULT 1');
  },

  quoteIdentifier: function(identifier) {
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
  getForeignKeysQuery: function(tableName, schemaName) {
    var sql = 'PRAGMA foreign_key_list(<%= tableName %>)';
    return Utils._.template(sql)({ tableName: tableName });
  }
};

module.exports = Utils._.extend({}, MySqlQueryGenerator, QueryGenerator);
