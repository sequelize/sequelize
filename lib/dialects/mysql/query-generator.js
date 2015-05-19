'use strict';

var Utils = require('../../utils')
  , DataTypes = require('../../data-types');

module.exports = (function() {
  var QueryGenerator = {
    dialect: 'mysql',

    createSchema: function() {
      var query = 'SHOW TABLES';
      return Utils._.template(query)({});
    },

    showSchemasQuery: function() {
      return 'SHOW TABLES';
    },

    versionQuery: function() {
      return 'SELECT VERSION() as `version`';
    },

    createTableQuery: function(tableName, attributes, options) {
      options = Utils._.extend({
        engine: 'InnoDB',
        charset: null
      }, options || {});

      var self = this;

      var query = 'CREATE TABLE IF NOT EXISTS <%= table %> (<%= attributes%>) ENGINE=<%= engine %><%= comment %><%= charset %><%= collation %><%= initialAutoIncrement %>'
        , primaryKeys = []
        , foreignKeys = {}
        , attrStr = [];

      for (var attr in attributes) {
        if (attributes.hasOwnProperty(attr)) {
          var dataType = attributes[attr]
            , match;

          if (Utils._.includes(dataType, 'PRIMARY KEY')) {
            primaryKeys.push(attr);

            if (Utils._.includes(dataType, 'REFERENCES')) {
               // MySQL doesn't support inline REFERENCES declarations: move to the end
              match = dataType.match(/^(.+) (REFERENCES.*)$/);
              attrStr.push(this.quoteIdentifier(attr) + ' ' + match[1].replace(/PRIMARY KEY/, ''));
              foreignKeys[attr] = match[2];
            } else {
              attrStr.push(this.quoteIdentifier(attr) + ' ' + dataType.replace(/PRIMARY KEY/, ''));
            }
          } else if (Utils._.includes(dataType, 'REFERENCES')) {
            // MySQL doesn't support inline REFERENCES declarations: move to the end
            match = dataType.match(/^(.+) (REFERENCES.*)$/);
            attrStr.push(this.quoteIdentifier(attr) + ' ' + match[1]);
            foreignKeys[attr] = match[2];
          } else {
            attrStr.push(this.quoteIdentifier(attr) + ' ' + dataType);
          }
        }
      }

      var values = {
        table: this.quoteTable(tableName),
        attributes: attrStr.join(', '),
        comment: options.comment && Utils._.isString(options.comment) ? ' COMMENT ' + this.escape(options.comment) : '',
        engine: options.engine,
        charset: (options.charset ? ' DEFAULT CHARSET=' + options.charset : ''),
        collation: (options.collate ? ' COLLATE ' + options.collate : ''),
        initialAutoIncrement: (options.initialAutoIncrement ? ' AUTO_INCREMENT=' + options.initialAutoIncrement : '')
      }
      , pkString = primaryKeys.map(function(pk) { return this.quoteIdentifier(pk); }.bind(this)).join(', ');

      if (!!options.uniqueKeys) {
        Utils._.each(options.uniqueKeys, function(columns, indexName) {
          if (!columns.singleField) { // If it's a single field its handled in column def, not as an index
            if (!Utils._.isString(indexName)) {
              indexName = 'uniq_' + tableName + '_' + columns.fields.join('_');
            }
            values.attributes += ', UNIQUE ' + self.quoteIdentifier(indexName) + ' (' + Utils._.map(columns.fields, self.quoteIdentifier).join(', ') + ')';
          }
        });
      }

      if (pkString.length > 0) {
        values.attributes += ', PRIMARY KEY (' + pkString + ')';
      }

      for (var fkey in foreignKeys) {
        if (foreignKeys.hasOwnProperty(fkey)) {
          values.attributes += ', FOREIGN KEY (' + this.quoteIdentifier(fkey) + ') ' + foreignKeys[fkey];
        }
      }

      return Utils._.template(query)(values).trim() + ';';
    },

    showTablesQuery: function() {
      return 'SHOW TABLES;';
    },

    addColumnQuery: function(table, key, dataType) {
      var query = 'ALTER TABLE <%= table %> ADD <%= attribute %>;'
        , attribute = Utils._.template('<%= key %> <%= definition %>')({
          key: this.quoteIdentifier(key),
          definition: this.attributeToSQL(dataType, {
            context: 'addColumn'
          })
        });

      return Utils._.template(query)({
        table: this.quoteTable(table),
        attribute: attribute
      });
    },

    removeColumnQuery: function(tableName, attributeName) {
      var query = 'ALTER TABLE <%= tableName %> DROP <%= attributeName %>;';
      return Utils._.template(query)({
        tableName: this.quoteTable(tableName),
        attributeName: this.quoteIdentifier(attributeName)
      });
    },

    changeColumnQuery: function(tableName, attributes) {
      var query = 'ALTER TABLE <%= tableName %> CHANGE <%= attributes %>;';
      var attrString = [];

      for (var attrName in attributes) {
        var definition = attributes[attrName];

        attrString.push(Utils._.template('`<%= attrName %>` `<%= attrName %>` <%= definition %>')({
          attrName: attrName,
          definition: definition
        }));
      }

      return Utils._.template(query)({ tableName: this.quoteTable(tableName), attributes: attrString.join(', ') });
    },

    renameColumnQuery: function(tableName, attrBefore, attributes) {
      var query = 'ALTER TABLE <%= tableName %> CHANGE <%= attributes %>;';
      var attrString = [];

      for (var attrName in attributes) {
        var definition = attributes[attrName];

        attrString.push(Utils._.template('`<%= before %>` `<%= after %>` <%= definition %>')({
          before: attrBefore,
          after: attrName,
          definition: definition
        }));
      }

      return Utils._.template(query)({ tableName: this.quoteTable(tableName), attributes: attrString.join(', ') });
    },

    upsertQuery: function (tableName, insertValues, updateValues, where, rawAttributes, options) {
      options.onDuplicate = 'UPDATE ';

      options.onDuplicate += Object.keys(updateValues).map(function (key) {
        key = this.quoteIdentifier(key);
        return key + '=VALUES(' + key +')';
      }, this).join(', ');

      return this.insertQuery(tableName, insertValues, rawAttributes, options);
    },

    bulkInsertQuery: function(tableName, attrValueHashes, options) {
      var query = 'INSERT<%= ignoreDuplicates %> INTO <%= table %> (<%= attributes %>) VALUES <%= tuples %><%= onDuplicateKeyUpdate %>;'
        , tuples = []
        , allAttributes = []
        , onDuplicateKeyUpdate = '';

      Utils._.forEach(attrValueHashes, function(attrValueHash) {
        Utils._.forOwn(attrValueHash, function(value, key) {
          if (allAttributes.indexOf(key) === -1) allAttributes.push(key);
        });
      });

      Utils._.forEach(attrValueHashes, function(attrValueHash) {
        tuples.push('(' +
          allAttributes.map(function(key) {
            return this.escape(attrValueHash[key]);
          }.bind(this)).join(',') +
        ')');
      }.bind(this));

      if (options && options.updateOnDuplicate) {
        onDuplicateKeyUpdate += ' ON DUPLICATE KEY UPDATE ' + options.updateOnDuplicate.map(function(attr) {
          var key = this.quoteIdentifier(attr);
          return key + '=VALUES(' + key + ')';
        }.bind(this)).join(',');
      }

      var replacements = {
        ignoreDuplicates: options && options.ignoreDuplicates ? ' IGNORE' : '',
        table: this.quoteTable(tableName),
        attributes: allAttributes.map(function(attr) {
                      return this.quoteIdentifier(attr);
                    }.bind(this)).join(','),
        tuples: tuples,
        onDuplicateKeyUpdate: onDuplicateKeyUpdate
      };

      return Utils._.template(query)(replacements);
    },

    deleteQuery: function(tableName, where, options) {
      options = options || {};

      var table = this.quoteTable(tableName);
      if (options.truncate === true) {
        // Truncate does not allow LIMIT and WHERE
        return 'TRUNCATE ' + table;
      }

      where = this.getWhereConditions(where);
      var limit = '';

      if (Utils._.isUndefined(options.limit)) {
        options.limit = 1;
      }

      if (!!options.limit) {
        limit = ' LIMIT ' + this.escape(options.limit);
      }

      var query = 'DELETE FROM ' + table;
      if (where) query += ' WHERE ' + where;
      query += limit;

      return query;
    },

    showIndexesQuery: function(tableName, options) {
      var sql = 'SHOW INDEX FROM <%= tableName %><%= options %>';
      return Utils._.template(sql)({
        tableName: this.quoteTable(tableName),
        options: (options || {}).database ? ' FROM `' + options.database + '`' : ''
      });
    },

    removeIndexQuery: function(tableName, indexNameOrAttributes) {
      var sql = 'DROP INDEX <%= indexName %> ON <%= tableName %>'
        , indexName = indexNameOrAttributes;

      if (typeof indexName !== 'string') {
        indexName = Utils.inflection.underscore(tableName + '_' + indexNameOrAttributes.join('_'));
      }

      return Utils._.template(sql)({ tableName: this.quoteIdentifiers(tableName), indexName: indexName });
    },

    attributeToSQL: function(attribute) {
      if (!Utils._.isPlainObject(attribute)) {
        attribute = {
          type: attribute
        };
      }

      var template;

      if (attribute.type instanceof DataTypes.ENUM) {
        if (attribute.type.values && !attribute.values) attribute.values = attribute.type.values;
        template = 'ENUM(' + Utils._.map(attribute.values, function(value) {
          return this.escape(value);
        }.bind(this)).join(', ') + ')';
      } else {
        template = attribute.type.toString();
      }

      if (attribute.allowNull === false) {
        template += ' NOT NULL';
      }

      if (attribute.autoIncrement) {
        template += ' auto_increment';
      }

      // Blobs/texts cannot have a defaultValue
      if (attribute.type !== 'TEXT' && attribute.type._binary !== true && Utils.defaultValueSchemable(attribute.defaultValue)) {
        template += ' DEFAULT ' + this.escape(attribute.defaultValue);
      }

      if (attribute.unique === true) {
        template += ' UNIQUE';
      }

      if (attribute.primaryKey) {
        template += ' PRIMARY KEY';
      }

      if (attribute.references) {
        attribute = Utils.formatReferences(attribute);
        template += ' REFERENCES ' + this.quoteTable(attribute.references.model);

        if (attribute.references.key) {
          template += ' (' + this.quoteIdentifier(attribute.references.key) + ')';
        } else {
          template += ' (' + this.quoteIdentifier('id') + ')';
        }

        if (attribute.onDelete) {
          template += ' ON DELETE ' + attribute.onDelete.toUpperCase();
        }

        if (attribute.onUpdate) {
          template += ' ON UPDATE ' + attribute.onUpdate.toUpperCase();
        }
      }

      return template;
    },

    attributesToSQL: function(attributes, options) {
      var result = {}
        , key
        , attribute;

      for (key in attributes) {
        attribute = attributes[key];
        result[attribute.field || key] = this.attributeToSQL(attribute, options);
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
      return "SELECT CONSTRAINT_NAME as constraint_name FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE where TABLE_NAME = '" + tableName + /* jshint ignore: line */
        "' AND CONSTRAINT_NAME!='PRIMARY' AND CONSTRAINT_SCHEMA='" + schemaName + "' AND REFERENCED_TABLE_NAME IS NOT NULL;"; /* jshint ignore: line */
    },

    /**
     * Generates an SQL query that removes a foreign key from a table.
     *
     * @param  {String} tableName  The name of the table.
     * @param  {String} foreignKey The name of the foreign key constraint.
     * @return {String}            The generated sql query.
     */
    dropForeignKeyQuery: function(tableName, foreignKey) {
      return 'ALTER TABLE ' + this.quoteTable(tableName) + ' DROP FOREIGN KEY ' + this.quoteIdentifier(foreignKey) + ';';
    }
  };

  return Utils._.extend(Utils._.clone(require('../abstract/query-generator')), QueryGenerator);
})();
