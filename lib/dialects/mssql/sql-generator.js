'use strict';

var Utils = require('../../utils')
  , SqlString = require('../../sql-string')
  , DataTypes = require('./data-types');

/*
  Escape a value (e.g. a string, number or date)
*/
var dialect = 'mssql';
//mssql doesnt support time zone
function escape(value, field) {
  if (value && value._isSequelizeMethod) {
    return value.toString();
  } else {
    return SqlString.escape(value, false, null, dialect, field);
  }
}
function quoteIdentifier(identifier, force) {
  if (identifier === '*') return identifier;
  return Utils.addTicks(identifier, '"');
}
/*
  Split an identifier into .-separated tokens and quote each part
*/
function quoteIdentifiers(identifiers, force) {
  if (identifiers.indexOf('.') !== -1) {
    identifiers = identifiers.split('.');
    return quoteIdentifier(identifiers.slice(0, identifiers.length - 1).join('.'))
      + '.' + quoteIdentifier(identifiers[identifiers.length - 1]);
  } else {
    return quoteIdentifier(identifiers);
  }
}
function wrapSingleQuote(identifier){      
  return Utils.addTicks(identifier, "'");
}
function nameIndexes(indexes, rawTablename) {
  return Utils._.map(indexes, function (index) {
    if (!index.hasOwnProperty('name')) {
      var onlyAttributeNames = index.fields.map(function(attribute) {
        return (typeof attribute === 'string') ? attribute : attribute.attribute;
      }.bind(this));

      index.name = Utils.inflection.underscore(rawTablename + '_' + onlyAttributeNames.join('_'));
    }

    return index;
  });
}

function loadColumn(attributes){
  var attrStr = [];
  for (var attr in attributes) {
    var dataType = attributes[attr];
    attrStr.push(quoteIdentifier(dataType));
  }
  return attrStr;
}
function loadColumnWithTypes(attributes){
  var attrStr = [];
  for (var attr in attributes) {
    var dataType = attributes[attr];
    attrStr.push(quoteIdentifier(attr) + " " + dataType);
  }
  return attrStr;
}
function addTableExistsWrapper(tableName, query){
  return [
    "IF (NOT EXISTS (",
      "SELECT * FROM INFORMATION_SCHEMA.TABLES",
      "WHERE TABLE_NAME='<%= unquotedTable %>'))",
    "BEGIN",
      query,
    "END"
  ].join(" ");
}


module.exports = {
  getCreateTableSql: function(tableName, attributes, options) {
    var query = "CREATE TABLE <%= tableName %> (<%= attributes%>)";
    var attrStr     = []
      , self        = this
      , primaryKeys = Utils._.keys(Utils._.pick(attributes, function(dataType){
        return dataType.indexOf('PRIMARY KEY') >= 0;
      }));

    attrStr = loadColumnWithTypes(attributes);

    var values = {
      unquotedTable: tableName,
      tableName: quoteIdentifier(tableName),
      attributes: attrStr.join(", ")
    };
    query = addTableExistsWrapper(tableName, query);
    return Utils._.template(query)(values).trim() + ";";
  },
  insertSql: function(table, valueHash, modelAttributes, options) {
    options = options || {};
    var query
      , valueQuery = 'INSERT INTO <%= table %> (<%= attributes %>)'
      , emptyQuery = 'INSERT INTO <%= table %>'
      , fields = []
      , selFields = []
      , values = []
      , key
      , value
      , modelAttributeMap = {};

    if (this._dialect.supports['RETURNING'] && options.returning) {
      valueQuery += ' OUTPUT <%= selFields %>  VALUES (<%= values %>)';
      emptyQuery += ' OUTPUT <%= selFields %>  VALUES ()';
    }else{
      valueQuery += ' VALUES (<%= values %>)';
    }

    valueHash = Utils.removeNullValuesFromHash(valueHash, this.options.omitNull);

    for (key in valueHash) {
      if (valueHash.hasOwnProperty(key)) {
        value = valueHash[key];
        // SERIALS' can't be NULL in postgresql, use DEFAULT where supported
        if(modelAttributeMap && modelAttributeMap[key] && modelAttributeMap[key].autoIncrement && value){
          fields.push(quoteIdentifier(key));
          selFields.push(wrapSingleQuote(key));
          valueQuery = 'SET IDENTITY_INSERT <%= table %> ON;' 
            + valueQuery
            + '; SET IDENTITY_INSERT <%= table %> OFF';
          values.push(escape(value, (modelAttributeMap && modelAttributeMap[key]) || undefined));
        }else if(value) {
          fields.push(quoteIdentifier(key));
          selFields.push(wrapSingleQuote(key));
          values.push(escape(value, (modelAttributeMap && modelAttributeMap[key]) || undefined));
        }
      }
    }

    var replacements = {
      table: this.quoteTable(table),
      attributes: fields.join(','),
      selFields: selFields.join(','),
      values: values.join(',')
    };

    query = (replacements.attributes.length ? valueQuery : emptyQuery) + ';';

    return Utils._.template(query)(replacements);
  },
  addIndexSql: function(tableName, attributes, options, rawTablename){
    if (!options.name) {
      // Mostly for cases where addIndex is called directly by the user without an options object (for example in migrations)
      // All calls that go through sequelize should already have a name
      options.fields = options.fields || attributes;
      options = nameIndexes([options], rawTablename)[0];
    }
    options = Utils._.defaults(options, {
      type: '',
      indicesType: options.type || '',
      indexType: options.method || undefined,
      indexName: options.name,
      parser: null
    });
    var attrStr = loadColumn(attributes);
    return Utils._.compact([
      'CREATE',
      options.unique ? 'UNIQUE' : '',
      options.indicesType, 'INDEX',
      quoteIdentifiers(options.indexName),
      'ON', quoteIdentifiers(tableName),
      '(' + attrStr.join(', ') + ')'
    ]).join(' ');
  },
  removeIndexSql: function(tableName, indexNameOrAttributes){
    var sql = 'DROP INDEX <%= indexName %> ON <%= tableName %>'
      , indexName = indexNameOrAttributes;

    if (typeof indexName !== 'string') {
      indexName = Utils.inflection.underscore(tableName + '_' + indexNameOrAttributes.join('_'));
    }
    var values = {
      tableName: quoteIdentifiers(tableName),
      indexName: indexName
    };
    return Utils._.template(sql)(values);
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
        + attribute.field + '" IN('
        + Utils._.map(attribute.values, function(value) {
        return escape(value);
      }.bind(this)).join(', ') + '))';
    } else {
      template = attribute.type.toString();
    }

    template += ' ';
    if (attribute.allowNull === false && !isEnum && !attribute.primaryKey) {
      template += this.attributeMap.notNull;
    }else if(!isEnum && !attribute.primaryKey){
      template += this.attributeMap.isNull;
    }else if(!isEnum) {
      template += 'PRIMARY KEY';
    }

    if (attribute.autoIncrement) {
      template += ' ' + this.attributeMap.autoIncrement;
    }

    // Blobs/texts cannot have a defaultValue
    if (attribute.type !== 'TEXT'
      && attribute.type._binary !== true 
      && Utils.defaultValueSchemable(attribute.defaultValue)) {
      if(options){
        if(escape(attribute.defaultValue) !== 'NULL'){
          template += ' DEFAULT ' + wrapSingleQuote(attribute.defaultValue);
        }
      }
    }

    if (attribute.unique === true) {
      template += ' UNIQUE';
    }

    

    if (attribute.references) {
      template += ' REFERENCES ' + quoteIdentifier(attribute.references);

      if (attribute.referencesKey) {
        template += ' (' + quoteIdentifier(attribute.referencesKey) + ')';
      } else {
        template += ' (' + quoteIdentifier('id') + ')';
      }

      if (attribute.onDelete) {
        if(attribute.onDelete.toUpperCase() !== 'RESTRICT'){
          template += ' ON DELETE ' + attribute.onDelete.toUpperCase();
        }
      }

      if (attribute.onUpdate) {
        template += ' ON UPDATE ' + attribute.onUpdate.toUpperCase();
      }
    }

    return template;
  },

  describeTableSql: function(tableName, schema, schemaDelimiter){
    var qry = ["SELECT c.Name, t.Name AS 'Type', c.IS_NULLABLE as IsNull",
      ", object_definition(c.default_object_id) AS 'Default'",
      "FROM sys.Columns c",
      "INNER JOIN sys.types t",
      "ON t.system_type_id = c.system_type_id",
      "WHERE object_id = object_id(",
      wrapSingleQuote(tableName),
      ");"].join(" ");

    return qry;
  },

  getForeignKeysSql: function(tableName){
    return [
      "SELECT",
        "constraint_name = C.CONSTRAINT_NAME",
      "FROM",
        "INFORMATION_SCHEMA.TABLE_CONSTRAINTS C",
      "WHERE C.CONSTRAINT_TYPE != 'PRIMARY KEY'",
      "AND C.TABLE_NAME = ", wrapSingleQuote(tableName) 
    ].join(" ");
  },
  dropForeignKeySql: function(tableName, foreignKey){
    return ['ALTER TABLE',
      quoteIdentifier(tableName),
      'DROP',
      quoteIdentifier(foreignKey),
      ';'].join(' ');
  }
};













