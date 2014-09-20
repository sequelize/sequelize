'use strict';

var Utils = require('../../utils')
  , DataTypes = require('../../data-types')  
  , util = require('util');


//drop table Group

module.exports = (function() {
  var QueryGenerator = {
    dialect: 'mssql',

    quoteIdentifier: function(identifier, force) {
      if (identifier === '*') return identifier;
      return Utils.addTicks(identifier, '"');
    },

    showTablesQuery: function () {
      return 'SELECT name FROM sys.Tables';
    },

    dropTableQuery: function(tableName, options) {
      options = options || {};

      var query = "IF (EXISTS ("
        + "SELECT * FROM INFORMATION_SCHEMA.TABLES"
        + " WHERE TABLE_NAME='<%= tableName %>'))"
        + " BEGIN"
        + " DROP TABLE \"<%= tableName %>\""
        + " END";

      return Utils._.template(query)({
        tableName: tableName
      });
    },

    createTableQuery: function(tableName, attributes, options) {
      var attrStr     = []
        , self        = this
        , primaryKeys = Utils._.keys(Utils._.pick(attributes, function(dataType){
          return dataType.indexOf('PRIMARY KEY') >= 0;
        }));

      var query = "IF (NOT EXISTS ("
        + "SELECT * FROM INFORMATION_SCHEMA.TABLES"
        + " WHERE TABLE_NAME='<%= tableName %>'))"
        + " BEGIN"
        + " CREATE TABLE <%= tableName %> (<%= attributes%>)"
        + " END";

      for (var attr in attributes) {
        if (attributes.hasOwnProperty(attr)) {
          var dataType = attributes[attr];
          if (primaryKeys.length > 1){
            dataType = dataType.replace(/ PRIMARY KEY/, '');
          }
          attrStr.push(self.quote(attr) + " " + dataType);
        }
      }

      if (primaryKeys.length > 1) {
        attrStr.push('PRIMARY KEY(' + primaryKeys.map(function(column){
          return self.quote(column);
        }).join(', ') + ')');
      }

      var values = {
          unquotedTable: tableName,
          tableName: self.quote(tableName),
          attributes: attrStr.join(", ")
        };

      return Utils._.template(query)(values).trim() + ";";
    },

    getDataType: function(type){
      switch(type){
        case 'TINYINT(1)':
          return 'BIT';
        default:
          return type;
      }
    },

    showIndexQuery: function(tableName, options) {
      var sql = "SELECT"
        + " TableName = t.name,"
        + " IndexName = ind.name,"
        + " IndexId = ind.index_id,"
        + " ColumnId = ic.index_column_id,"
        + " ColumnName = col.name"
        + " FROM" 
        + " sys.indexes ind"
        + " INNER JOIN "
        + " sys.index_columns ic ON  ind.object_id = ic.object_id and ind.index_id = ic.index_id"
        + " INNER JOIN"
        + " sys.columns col ON ic.object_id = col.object_id and ic.column_id = col.column_id"
        + " INNER JOIN "
        + " sys.tables t ON ind.object_id = t.object_id"
        + " WHERE t.name = '<%= tableName %>'<%= options %>";
      return Utils._.template(sql)({
        tableName: tableName,
        options: (options || {}).database ? ' FROM `' + options.database + '`' : ''
      });
    },

    addIndexQuery: function(tableName, attributes, options, rawTablename) {
      options = options || {};

      var transformedAttributes = attributes.map(function(attribute) {
        if (typeof attribute === 'string') {
          return this.quoteIdentifier(attribute);
        } else {
          var result = '';

          if (!attribute.attribute) {
            throw new Error('The following index attribute has no attribute: ' + util.inspect(attribute));
          }

          result += this.quoteIdentifier(attribute.attribute);

          if (this._dialect.supports.index.collate && attribute.collate) {
            result += ' COLLATE ' + this.quoteIdentifier(attribute.collate);
          }

          if (this._dialect.supports.index.length && attribute.length) {
            result += '(' + attribute.length + ')';
          }

          if (attribute.order) {
            result += ' ' + attribute.order;
          }

          return result;
        }
      }.bind(this));

      var onlyAttributeNames = attributes.map(function(attribute) {
        return (typeof attribute === 'string') ? attribute : attribute.attribute;
      }.bind(this));

      options = Utils._.defaults(options, {
        type: '',
        indicesType: options.type || '',
        indexType: options.method || undefined,
        indexName: options.name || Utils.inflection.underscore(rawTablename + '_' + onlyAttributeNames.join('_')),
        parser: null
      });

      if (options.indicesType.toLowerCase() === 'unique') {
        options.unique = true;
        delete options.indicesType;
      }

      if (!this._dialect.supports.index.type) {
        delete options.indicesType;
      }

      return Utils._.compact([
        'CREATE',
        options.unique ? 'UNIQUE' : '',
        options.indicesType, 'INDEX',
        this._dialect.supports.index.concurrently && options.concurrently ? 'CONCURRENTLY' : undefined,
        this.quoteIdentifiers(options.indexName),
        this._dialect.supports.index.using === 1 && options.indexType ? 'USING ' + options.indexType : '',
        'ON', this.quoteIdentifiers(tableName),
        this._dialect.supports.index.using === 2 && options.indexType ? 'USING ' + options.indexType : '',
        '(' + transformedAttributes.join(', ') + ')',
        (this._dialect.supports.index.parser && options.parser ? 'WITH PARSER ' + options.parser : undefined)
      ]).join(' ');
    },

    attributesToSQL: function(attributes) {
      var result = {};

      for (var name in attributes) {
        var dataType = attributes[name];

        if (Utils._.isPlainObject(dataType)) {
          var template;

          if (dataType.type.toString() === DataTypes.ENUM.toString()) {
            if (Array.isArray(dataType.values) && (dataType.values.length > 0)) {
              template = 'ENUM(' + Utils._.map(dataType.values, function(value) {
                return this.escape(value);
              }.bind(this)).join(', ') + ')';
            } else {
              throw new Error('Values for ENUM haven\'t been defined.');
            }
          } else {
            template = this.getDataType(dataType.type.toString());
          }
          if (dataType.hasOwnProperty('allowNull') && (!dataType.allowNull)) {
            template += ' NOT NULL';
          }

          if (dataType.autoIncrement) {
            template += ' auto_increment';
          }

          // Blobs/texts cannot have a defaultValue
          if (dataType.type !== 'TEXT' && dataType.type._binary !== true && Utils.defaultValueSchemable(dataType.defaultValue)) {
            template += ' DEFAULT ' + this.escape(dataType.defaultValue);
          }

          if (dataType.unique === true) {
            template += ' UNIQUE';
          }

          if (dataType.primaryKey) {
            template += ' PRIMARY KEY';
          }

          if (dataType.comment && Utils._.isString(dataType.comment) && dataType.comment.length) {
            template += ' COMMENT ' + this.escape(dataType.comment);
          }

          if (dataType.references) {
            template += ' REFERENCES ' + this.quoteTable(dataType.references);

            if (dataType.referencesKey) {
              template += ' (' + this.quoteIdentifier(dataType.referencesKey) + ')';
            } else {
              template += ' (' + this.quoteIdentifier('id') + ')';
            }

            if (dataType.onDelete) {
              template += ' ON DELETE ' + dataType.onDelete.toUpperCase();
            }

            if (dataType.onUpdate) {
              template += ' ON UPDATE ' + dataType.onUpdate.toUpperCase();
            }

          }

          result[name] = template;
        } else {
          result[name] = dataType;
        }
      }
      console.log('results', result);
      return result;
    },

    /**
     * Generates an SQL query that returns all foreign keys of a table.
     *
     * @param  {String} tableName  The name of the table.
     * @param  {String} schemaName The name of the schema.
     * @return {String}            The generated sql query.
     */
    getForeignKeysQuery: function(tableName, schemaName) {
      return [
        "SELECT",
          "K_Table = FK.TABLE_NAME, FK_Column = CU.COLUMN_NAME, PK_Table = PK.TABLE_NAME, PK_Column = PT.COLUMN_NAME, Constraint_Name = C.CONSTRAINT_NAME",
        "FROM",
          "INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS C",
        "INNER JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS FK ON C.CONSTRAINT_NAME = FK.CONSTRAINT_NAME",
        "INNER JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS PK ON C.UNIQUE_CONSTRAINT_NAME = PK.CONSTRAINT_NAME",
        "INNER JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE CU ON C.CONSTRAINT_NAME = CU.CONSTRAINT_NAME",
        "INNER JOIN (",
          "SELECT",
              "i1.TABLE_NAME,",
              "i2.COLUMN_NAME",
          "FROM",
              "INFORMATION_SCHEMA.TABLE_CONSTRAINTS i1",
          "INNER JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE i2",
              "ON i1.CONSTRAINT_NAME = i2.CONSTRAINT_NAME",
          "WHERE",
              "i1.CONSTRAINT_TYPE = 'PRIMARY KEY'",
        ") PT ON PT.TABLE_NAME = PK.TABLE_NAME"
      ].join(" ");
    }
  };

  return Utils._.extend(Utils._.clone(require('../mysql/query-generator')), QueryGenerator);
})();
