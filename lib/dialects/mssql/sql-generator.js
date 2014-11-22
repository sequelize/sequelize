'use strict';

var Utils = require('../../utils')
  , SqlString = require('../../sql-string')
  , DataTypes = require('./data-types')
  , _ = require('lodash')
  , _dialect = 'mssql'
  , _sequelize
  , _options;

/*
  Escape a value (e.g. a string, number or date)
*/
var attributeMap = {
  notNull:"NOT NULL",
  allowNull:"NULL",
  autoIncrement:"IDENTITY(1,1)",
  defaultValue:"DEFAULT",
  unique:"UNIQUE",
  primaryKey:"PRIMARY KEY",
  foreignKey:"FOREIGN KEY",
  comment:"COMMENT",
  references:"REFERENCES",
  onDelete:"ON DELETE",
  onUpdate:"ON UPDATE",
  default:"DEFAULT"
};

function escape(value, field) {
  if (value && value._isSequelizeMethod) {
    return value.toString();
  } else {
    return SqlString.escape(value, false, _options.timezone, _dialect, field);
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

module.exports = {
  get options(){
    return _options;
  },

  set options(opt) {
    _options = opt;
  },

  get dialect(){
    return _dialect;
  },

  set dialect(dial) {
    _dialect = dial;
  },

  get sequelize(){
    return _sequelize;
  },

  set sequelize(seq) {
    _sequelize = seq;
  },

  quoteIdentifier: function(val){
    return quoteIdentifier(val);
  },

  quoteIdentifiers: function(val, force){
    return quoteIdentifiers(val, force);
  },

  escape: function(value, field) {
    return escape(value,field);
  },

  quoteTable: function(param, as) {
    var table = '';
    if (as === true) {
      as = param.as || param.name || param;
    }

    if (_.isObject(param)) {
      if (param.schema) {
        table += param.schema + (param.delimiter || '.');
      }
      table += param.tableName;
      table = quoteIdentifier(table);
    } else {
      table = quoteIdentifier(param);
    }

    if (as) {
      table += ' AS ' + quoteIdentifier(as);
    }
    return table;
  },

  identityInsertWrapper: function(query, table){
    return[
      'SET IDENTITY_INSERT', quoteIdentifier(table), 'ON;',
      query,
      'SET IDENTITY_INSERT', quoteIdentifier(table), 'OFF;',
    ].join(' ');
  },

  alterTableSql: function(tableName){
    var query = 'ALTER TABLE <%= tableName %>';
    var value = {
      tableName : quoteIdentifier(tableName)
    };
    return Utils._.template(query)(value);
  },

  incrementSql: function(tableName, attrValueHash, options) {
    attrValueHash = Utils.removeNullValuesFromHash(attrValueHash, this.options.omitNull);

    var query
      , key
      , value
      , selFields = []
      , values = [];

    query = 'UPDATE <%= table %> SET <%= values %> OUTPUT <%= selFields %>';

    for (key in attrValueHash) {
      value = attrValueHash[key];
      values.push(quoteIdentifier(key) + '=' + quoteIdentifier(key) + ' + ' + escape(value));
      selFields.push('INSERTED.' + quoteIdentifier(key));
    }

    options = options || {};
    for (key in options) {
      value = options[key];
      values.push(quoteIdentifier(key) + '=' + escape(value));
    }

    var replacements = {
      table: quoteIdentifiers(tableName),
      values: values.join(','),
      selFields: selFields.join(',')
    };

    return Utils._.template(query)(replacements);
  },

  deleteSql: function(tableName) {
    var query = "DELETE FROM <%= table %>";
    var replacements = {
      table: quoteIdentifier(tableName.toString())
    };

    return Utils._.template(query)(replacements);
  },

  addColumnSql: function(key, dataType){
    var attribute = Utils._.template('<%= key %> <%= definition %>')({
      key: quoteIdentifier(key),
      definition: this.attributeToSQL(dataType, {
        context: 'addColumn'
      })
    });
    return 'ADD ' + attribute;
  },

  alterColumnSql: function(){
    return 'ALTER COLUMN';
  },

  renameColumnSql: function(tableName, attrBefore, newColumnName){
    var query = 'EXEC SP_RENAME \'<%= tableName %>.<%= before %>\', \'<%= after %>\';';
    var attrString = [];

    var values = {
       tableName: tableName
      , before: attrBefore
      , after: newColumnName
    };
    return Utils._.template(query)(values);
  },

  attributeToSQL: function(attribute, options) {
    if (!Utils._.isPlainObject(attribute)) {
      attribute = {
        type: attribute
      };
    }
    var template = [];
    //special enum query
    if (attribute.type.toString() === DataTypes.ENUM.toString()) {
      template.push('VARCHAR(10)');
      if(attribute.allowNull === false){
        template.push(attributeMap.notNull);
      //not nullable
      }else{
        template.push(attributeMap.allowNull);
      }
      template.push('CHECK ("'
        + attribute.field + '" IN('
        + Utils._.map(attribute.values, function(value) {
        return escape(value);
      }.bind(this)).join(', ') + '))');
    } else {
      //the everything else
      if (attribute.type === 'TINYINT(1)') {
        attribute.type = DataTypes.BOOLEAN;
      }else if(attribute.type === 'DATETIME'){
        attribute.type = DataTypes.DATE;
      }else if(attribute.type.toString() === 'BLOB'){
        attribute.type = DataTypes.BLOB;
      }
      template.push(attribute.type.toString());
      //a primary key
      if(attribute.primaryKey){
        if (!attribute.references) {
          template.push(attributeMap.primaryKey);
        }else{
          template.push(attributeMap.foreignKey);
        }
      //allow null
      }else if(attribute.allowNull === false){
        template.push(attributeMap.notNull);
      //not nullable
      }else{
        template.push(attributeMap.allowNull);
      }
    }

    //auto increment
    if (attribute.autoIncrement) {
      template.push(attributeMap.autoIncrement);
    }

    // Blobs/texts cannot have a defaultValue
    if (attribute.type !== 'TEXT'
      && attribute.type._binary === false
      && Utils.defaultValueSchemable(attribute.defaultValue)) {
      if(options && escape(attribute.defaultValue)){
          template.push(attributeMap.default + wrapSingleQuote(attribute.defaultValue));
      }
    }

    if (!attribute.primaryKey && attribute.unique) {
      template.push(attributeMap.unique);
    }

    if (attribute.references) {
      template.push(attributeMap.references);
      template.push(this.quoteTable(attribute.references));
      if (attribute.referencesKey) {
        template.push('(' + quoteIdentifier(attribute.referencesKey) + ')');
      } else {
        template.push('(' + quoteIdentifier('id') + ')');
      }

      //PROBLEM WITH THIS IS MSSQL DOES NOT ALLOW MULTIPLE PER KEY
      if (attribute.onDelete) {
        if(attribute.onDelete.toUpperCase() !== 'RESTRICT'){
          template.push(attributeMap.onDelete);
          template.push(attribute.onDelete.toUpperCase());
        }
      }

      if (attribute.onUpdate && !attribute.onDelete) {
        template.push(attributeMap.onUpdate);
        template.push(attribute.onUpdate.toUpperCase());
      }
    }

    return template.join(' ');
  },

  dropSql: function(val){
    return [
      'DROP',
      quoteIdentifier(val)
    ].join(' ');
  },

  alterAttributesSql: function(attributes){
    var attrString = [];
    for (var attrName in attributes) {
      var definition = attributes[attrName];

      attrString.push(Utils._.template('"<%= attrName %>" <%= definition %>')({
        attrName: attrName,
        definition: definition
      }));
    }
    return attrString.join(', ');
  },

};
