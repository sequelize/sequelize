'use strict';

var Utils = require('../../utils')
  , DataTypes = require('../../data-types')
  , SqlString = require('../../sql-string')
  , Transaction = require('../../transaction')
  , util = require('util')
  , _ = require("lodash");

var MySqlQueryGenerator = Utils._.extend(
  Utils._.clone(require('../abstract/query-generator')),
  Utils._.clone(require('../mysql/query-generator'))
);

var hashToWhereConditions = MySqlQueryGenerator.hashToWhereConditions;

module.exports = (function() {
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

    createTableQuery: function(tableName, attributes, options) {
      options = options || {};

      var query = 'CREATE TABLE IF NOT EXISTS <%= table %> (<%= attributes%>)'
        , primaryKeys = []
        , needsMultiplePrimaryKeys = (Utils._.values(attributes).filter(function(definition) {
            return Utils._.includes(definition, 'PRIMARY KEY');
          }).length > 1)
        , attrStr = []
        , modifierLastIndex = -1;

      for (var attr in attributes) {
        if (attributes.hasOwnProperty(attr)) {
          var dataType = attributes[attr];

          if (Utils._.includes(dataType, 'AUTOINCREMENT')) {
            dataType = dataType.replace(/BIGINT/, 'INTEGER');
          }

          // SQLite thinks that certain modifiers should come before the length declaration,
          // whereas other dialects want them after, see http://www.sqlite.org/lang_createtable.html.

          // Start by finding the index of the last of the modifiers
          ['UNSIGNED', 'BINARY', 'ZEROFILL'].forEach(function (modifier) {
            var tmpIndex = dataType.indexOf(modifier);

            if (tmpIndex > modifierLastIndex) {
              modifierLastIndex = tmpIndex + modifier.length;
            }
          });

          if (modifierLastIndex) {
            // If a modifier was found, and a lenght declaration is given before the modifier, move the length
            var length = dataType.match(/\(\s*\d+(\s*,\s*\d)?\s*\)/);
            if (length && length.index < modifierLastIndex) {
              dataType = dataType.replace(length[0], '');

              // Since the legnth was placed before the modifier, removing the length has changed the index
              if (length.index < modifierLastIndex) {
                modifierLastIndex -= length[0].length;
              }
              dataType = Utils.spliceStr(dataType, modifierLastIndex, 0, length[0]).trim();
            }

            modifierLastIndex = -1;
          }

          var dataTypeString = dataType;
          if (Utils._.includes(dataType, 'PRIMARY KEY')) {
            if (Utils._.includes(dataType, 'INTEGER')) {
              dataTypeString = 'INTEGER PRIMARY KEY'; // Only INTEGER is allowed for primary key, see https://github.com/sequelize/sequelize/issues/969 (no lenght, unsigned etc)
            }

            if (needsMultiplePrimaryKeys) {
              primaryKeys.push(attr);
              dataTypeString = dataType.replace(/PRIMARY KEY/, 'NOT NULL');
            }
          }
          attrStr.push(this.quoteIdentifier(attr) + " " + dataTypeString);
        }
      }

      var values = {
        table: this.quoteTable(tableName),
        attributes: attrStr.join(", "),
        charset: (options.charset ? "DEFAULT CHARSET=" + options.charset : "")
      }
      , pkString = primaryKeys.map(function(pk) { return this.quoteIdentifier(pk); }.bind(this)).join(", ");

      if (!!options.uniqueKeys) {
        Utils._.each(options.uniqueKeys, function(columns) {
          if (!columns.singleField) { // If it's a single field its handled in column def, not as an index
            values.attributes += ", UNIQUE (" + columns.fields.join(', ') + ")";
          }
        });
      }

      if (pkString.length > 0) {
        values.attributes += ", PRIMARY KEY (" + pkString + ")";
      }

      var sql = Utils._.template(query, values).trim() + ";";
      return this.replaceBooleanDefaults(sql);
    },

    booleanValue: function(value){
      return !!value ? 1 : 0;
    },

    uniqueConstraintMapping: {
      code: 'SQLITE_CONSTRAINT',
      map: function(str) {
        var match = str.match(/columns (.*?) are/); // Sqlite pre 2.2 behavior - Error: SQLITE_CONSTRAINT: columns x, y are not unique
        if (match !== null && match.length >= 2) {
          return {
            fields: match[1].split(', ')
          };
        }

        match = str.match(/UNIQUE constraint failed: (.*)/); // Sqlite 2.2 behavior - Error: SQLITE_CONSTRAINT: UNIQUE constraint failed: table.x, table.y
        if (match !== null && match.length >= 2) {
          return {
            fields: match[1].split(', ').map(function (columnWithTable) {
              return columnWithTable.split('.')[1];
            })
          };
        }

        return false;
      }
    },

    addLimitAndOffset: function(options, model){
      var fragment = '';
      if (options.offset && !options.limit) {
        fragment += " LIMIT " + options.offset + ", " + 10000000000000;
      } else if (options.limit) {
        if (options.offset) {
          fragment += " LIMIT " + options.offset + ", " + options.limit;
        } else {
          fragment += " LIMIT " + options.limit;
        }
      }

      return fragment;
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

    bulkInsertQuery: function(tableName, attrValueHashes, options) {
      var query = "INSERT<%= ignoreDuplicates %> INTO <%= table %> (<%= attributes %>) VALUES <%= tuples %>;"
        , tuples = []
        , allAttributes = [];

      Utils._.forEach(attrValueHashes, function(attrValueHash, i) {
        Utils._.forOwn(attrValueHash, function(value, key, hash) {
          if (allAttributes.indexOf(key) === -1) allAttributes.push(key);
        });
      });

      Utils._.forEach(attrValueHashes, function(attrValueHash, i) {
        tuples.push("(" +
          allAttributes.map(function (key) {
            return this.escape(attrValueHash[key]);
          }.bind(this)).join(",") +
        ")");
      }.bind(this));

      var replacements  = {
        ignoreDuplicates: options && options.ignoreDuplicates ? ' OR IGNORE' : '',
        table: this.quoteTable(tableName),
        attributes: allAttributes.map(function(attr) {
                      return this.quoteIdentifier(attr);
                    }.bind(this)).join(","),
        tuples: tuples
      };

      return Utils._.template(query)(replacements);
    },

    updateQuery: function(tableName, attrValueHash, where, options) {
      options = options || {};
      _.defaults(options, this.options);

      attrValueHash = Utils.removeNullValuesFromHash(attrValueHash, options.omitNull, options);

      var query  = "UPDATE <%= table %> SET <%= values %> WHERE <%= where %>"
        , values = [];

      for (var key in attrValueHash) {
        var value = attrValueHash[key];
        values.push(this.quoteIdentifier(key) + "=" + this.escape(value));
      }

      var replacements = {
        table: this.quoteTable(tableName),
        values: values.join(","),
        where: this.getWhereConditions(where)
      };

      return Utils._.template(query)(replacements);
    },

    deleteQuery: function(tableName, where, options) {
      options = options || {};

      var query = "DELETE FROM <%= table %> WHERE <%= where %>";
      var replacements = {
        table: this.quoteTable(tableName),
        where: this.getWhereConditions(where)
      };

      return Utils._.template(query)(replacements);
    },

    attributesToSQL: function(attributes) {
      var result = {};

      for (var name in attributes) {
        var dataType = attributes[name];
        var fieldName = dataType.field || name;

        if (Utils._.isObject(dataType)) {
          var template     = "<%= type %>"
            , replacements = { type: dataType.type };

          if (dataType.type.toString() === DataTypes.ENUM.toString()) {
            replacements.type = "TEXT";

            if (!(Array.isArray(dataType.values) && (dataType.values.length > 0))) {
              throw new Error('Values for ENUM haven\'t been defined.');
            }
          }

          if (dataType.hasOwnProperty('allowNull') && !dataType.allowNull) {
            template += " NOT NULL";
          }

          if (Utils.defaultValueSchemable(dataType.defaultValue)) {
            // TODO thoroughly check that DataTypes.NOW will properly
            // get populated on all databases as DEFAULT value
            // i.e. mysql requires: DEFAULT CURRENT_TIMESTAMP
            template += " DEFAULT <%= defaultValue %>";
            replacements.defaultValue = this.escape(dataType.defaultValue);
          }

          if (dataType.unique === true) {
            template += " UNIQUE";
          }

          if (dataType.primaryKey) {
            template += " PRIMARY KEY";

            if (dataType.autoIncrement) {
              template += ' AUTOINCREMENT';
            }
          }

          if(dataType.references) {
            template += " REFERENCES <%= referencesTable %> (<%= referencesKey %>)";
            replacements.referencesTable = this.quoteTable(dataType.references);

            if(dataType.referencesKey) {
              replacements.referencesKey = this.quoteIdentifier(dataType.referencesKey);
            } else {
              replacements.referencesKey = this.quoteIdentifier('id');
            }

            if(dataType.onDelete) {
              template += " ON DELETE <%= onDeleteAction %>";
              replacements.onDeleteAction = dataType.onDelete.toUpperCase();
            }

            if(dataType.onUpdate) {
              template += " ON UPDATE <%= onUpdateAction %>";
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

    showIndexQuery: function(tableName) {
      var sql = "PRAGMA INDEX_LIST(<%= tableName %>)";
      return Utils._.template(sql, { tableName: this.quoteTable(tableName) });
    },

    removeIndexQuery: function(tableName, indexNameOrAttributes) {
      var sql       = "DROP INDEX IF EXISTS <%= indexName %>"
        , indexName = indexNameOrAttributes;

      if (typeof indexName !== 'string') {
        indexName = Utils.inflection.underscore(tableName + '_' + indexNameOrAttributes.join('_'));
      }

      return Utils._.template(sql, { tableName: this.quoteIdentifiers(tableName), indexName: indexName });
    },

    describeTableQuery: function(tableName, schema, schemaDelimiter) {
      var options = {};
      options.schema = schema;
      options.schemaDelimiter = schemaDelimiter;
      options.quoted = false;

      var sql = "PRAGMA TABLE_INFO(<%= tableName %>);";
      return Utils._.template(sql, { tableName: this.addSchema({tableName: this.quoteIdentifiers(tableName), options: options})});
    },

    removeColumnQuery: function(tableName, attributes) {
      attributes = this.attributesToSQL(attributes);

      var backupTableName = tableName + "_backup";
      var query = [
        this.createTableQuery(backupTableName, attributes).replace('CREATE TABLE', 'CREATE TEMPORARY TABLE'),
        "INSERT INTO <%= tableName %>_backup SELECT <%= attributeNames %> FROM <%= tableName %>;",
        "DROP TABLE <%= tableName %>;",
        this.createTableQuery(tableName, attributes),
        "INSERT INTO <%= tableName %> SELECT <%= attributeNames %> FROM <%= tableName %>_backup;",
        "DROP TABLE <%= tableName %>_backup;"
      ].join("");

      return Utils._.template(query, {
        tableName: tableName,
        attributeNames: Utils._.keys(attributes).join(', ')
      });
    },

    renameColumnQuery: function(tableName, attrNameBefore, attrNameAfter, attributes) {
      attributes = this.attributesToSQL(attributes);

      var backupTableName = tableName + "_backup";
      var query = [
        this.createTableQuery(backupTableName, attributes).replace('CREATE TABLE', 'CREATE TEMPORARY TABLE'),
        "INSERT INTO <%= tableName %>_backup SELECT <%= attributeNamesImport %> FROM <%= tableName %>;",
        "DROP TABLE <%= tableName %>;",
        this.createTableQuery(tableName, attributes),
        "INSERT INTO <%= tableName %> SELECT <%= attributeNamesExport %> FROM <%= tableName %>_backup;",
        "DROP TABLE <%= tableName %>_backup;"
      ].join("");

      return Utils._.template(query, {
        tableName: tableName,
        attributeNamesImport: Utils._.keys(attributes).map(function(attr) {
          return (attrNameAfter === attr) ? this.quoteIdentifier(attrNameBefore) + ' AS ' + this.quoteIdentifier(attr) : this.quoteIdentifier(attr);
        }.bind(this)).join(', '),
        attributeNamesExport: Utils._.keys(attributes).map(function(attr) {
          return this.quoteIdentifier(attr);
        }.bind(this)).join(', ')
      });
    },

    startTransactionQuery: function(transaction, options) {
      if (options.parent) {
        return 'SAVEPOINT ' + this.quoteIdentifier(transaction.name) + ';';
      }

      return "BEGIN TRANSACTION;";
    },

    setAutocommitQuery: function() {
      return "-- SQLite does not support SET autocommit.";
    },

    setIsolationLevelQuery: function(value) {
      switch (value) {
        case Transaction.ISOLATION_LEVELS.REPEATABLE_READ:
          return "-- SQLite is not able to choose the isolation level REPEATABLE READ.";
        case Transaction.ISOLATION_LEVELS.READ_UNCOMMITTED:
          return "PRAGMA read_uncommitted = ON;";
        case Transaction.ISOLATION_LEVELS.READ_COMMITTED:
          return "PRAGMA read_uncommitted = OFF;";
        case Transaction.ISOLATION_LEVELS.SERIALIZABLE:
          return "-- SQLite's default isolation level is SERIALIZABLE. Nothing to do.";
        default:
          throw new Error('Unknown isolation level: ' + value);
      }
    },

    replaceBooleanDefaults: function(sql) {
      return sql.replace(/DEFAULT '?false'?/g, "DEFAULT 0").replace(/DEFAULT '?true'?/g, "DEFAULT 1");
    },

    quoteIdentifier: function(identifier, force) {
      if (identifier === '*') return identifier;
      return Utils.addTicks(identifier, "`");
    },

        /**
     * Generates an SQL query that returns all foreign keys of a table.
     *
     * @param  {String} tableName  The name of the table.
     * @param  {String} schemaName The name of the schema.
     * @return {String}            The generated sql query.
     */
    getForeignKeysQuery: function(tableName, schemaName) {
      var sql = "PRAGMA foreign_key_list(<%= tableName %>)";
      return Utils._.template(sql, { tableName: tableName });
    }
  };

  return Utils._.extend({}, MySqlQueryGenerator, QueryGenerator);
})();
