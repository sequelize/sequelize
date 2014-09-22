'use strict';

var Utils = require('../../utils')
  , DataTypes = require('../../data-types')  
  , util = require('util');


//drop table Group
DataTypes.BOOLEAN = 'BIT';

module.exports = (function() {
  var QueryGenerator = {
    dialect: 'mssql',

    quoteIdentifier: function(identifier, force) {
      if (identifier === '*') return identifier;
      return Utils.addTicks(identifier, '"');
    },

    wrapSingleQuote: function(identifier){      
      return '\'' + identifier + '\'';
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


    showIndexQuery: function(tableName, options) {
      var sql = "SELECT"
        + " TableName = t.name,"
        + " name = ind.name,"
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
        options: (options || {}).database ? ' FROM \'' + options.database + '\'' : ''
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


    attributeMap:{
      notNull:"NOT NULL",
      isNull:"NULL",
      autoIncrement:"IDENTITY(1,1)",
      defaultValue:"DEFAULT",
      unique:"UNIQUE",
      primaryKey:"PRIMARY KEY",
      comment:"COMMENT",
      references:"REFERENCES",
      onDelete:"ON DELETE",
      onUpdate:"ON UPDATE"
    },
    attributeToSQL: function(attribute, options) {
      if (!Utils._.isPlainObject(attribute)) {
        attribute = {
          type: attribute
        };
      }

      var template;
      var isEnum = false;
      if (attribute.type.toString() === DataTypes.ENUM.toString()) {
        isEnum = true;
        template = 'VARCHAR(10) NOT NULL CHECK ("'
          + attribute.fieldName + '" IN('
          + Utils._.map(attribute.values, function(value) {
          return this.escape(value);
        }.bind(this)).join(', ') + '))';
      } else {
        template = this.dataTypeMapping(null, null, attribute.type.toString());
      }

      template += ' ';
      if (attribute.allowNull === false && !isEnum) {
        template += this.attributeMap.notNull;
      }else if(!isEnum){
        template += this.attributeMap.isNull;
      }

      if (attribute.autoIncrement) {
        template += ' ' + this.attributeMap.autoIncrement;
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
        template += ' REFERENCES ' + this.quoteTable(attribute.references);

        if (attribute.referencesKey) {
          template += ' (' + this.quoteIdentifier(attribute.referencesKey) + ')';
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

    describeTableQuery: function(tableName, schema, schemaDelimiter) {
      var qry = "SELECT c.Name, t.Name AS 'Type', c.IS_NULLABLE as IsNull"
        + ", object_definition(c.default_object_id) AS 'Default'"
        + " FROM sys.Columns c"
        + " INNER JOIN sys.types t"
        + " ON t.system_type_id = c.system_type_id"
        + " WHERE object_id = object_id(" 
        + this.wrapSingleQuote(tableName) + ");";

      return qry;
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
          "constraint_name = C.CONSTRAINT_NAME",
        "FROM",
          "INFORMATION_SCHEMA.TABLE_CONSTRAINTS C",
        "WHERE C.CONSTRAINT_TYPE != 'PRIMARY KEY'",
        "AND C.TABLE_NAME = ", this.wrapSingleQuote(tableName) 
      ].join(" ");
    },
    /**
     * Generates an SQL query that removes a foreign key from a table.
     *
     * @param  {String} tableName  The name of the table.
     * @param  {String} foreignKey The name of the foreign key constraint.
     * @return {String}            The generated sql query.
     */
    dropForeignKeyQuery: function(tableName, foreignKey) {
      return 'ALTER TABLE ' + this.quoteTable(tableName) + ' DROP ' + this.quoteIdentifier(foreignKey) + ';';
    },
  };

  return Utils._.extend(Utils._.clone(require('../mysql/query-generator')), QueryGenerator);
})();
