'use strict';

var Utils = require('../../utils')
  , SqlString = require('../../sql-string')
  , DataTypes = require('./data-types')
  , _ = require('lodash')
  , _options
  , _dialect = 'mssql'
  , _sequelize;

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

function fieldsToSql(fields, singleQuote){
  var fieldStr = [];
  for (var key in fields) {
    if (fields.hasOwnProperty(key)) {
      if(singleQuote){
        fieldStr.push(wrapSingleQuote(key));
      }else{
        fieldStr.push(quoteIdentifier(key));
      }
    }
  }
  if(fieldStr){
    if(fieldStr.length > 0){
      return fieldStr.join(',');
    }
  }
  return '';
}

function processValue(val, modelAttribute){
  var sql;
  if(val instanceof Utils.cast){
    sql = 'CAST(';
    if(val.val._isSequelizeMethod){
      sql += processValue(val.val, modelAttribute) + ' AS ' + val.type.toUpperCase();
    }else{
      sql += escape(val.val) + ' AS ' + val.type.toUpperCase();
    }
    return sql + ')';
  } else if(val instanceof Utils.literal){
    return val.val;
  } else if (val instanceof Utils.fn) {
    sql = val.fn + '(' + val.args.map(function(arg) {
      if (arg._isSequelizeMethod) {
        return processValue(arg, modelAttribute);
      } else{
        return escape(arg);
      }
    }).join(', ') + ')';
    return sql;
  } else if (val === true || val === false){
    return wrapSingleQuote(val.toString());
  } else if (val instanceof Utils.col) {
    if (Array.isArray(val.col)) {
      if (!modelAttribute) {
        throw new Error('Cannot call Sequelize.col() with array outside of order / group clause');
      }
    } else if (val.col.indexOf('*') === 0) {
      return '*';
    }
    return quoteIdentifier(val.col);
  } else{
    return escape(val, modelAttribute);
  }
}
function valuesToSql(fields, modelAttributeMap, isUpdate){
  var values = [];
  for (var key in fields) {
    if (fields.hasOwnProperty(key)) {
      if(isUpdate){
        values.push(quoteIdentifier(key) + '=' + processValue(fields[key], (modelAttributeMap && modelAttributeMap[key]) || undefined));
      } else {
        values.push(processValue(fields[key], (modelAttributeMap && modelAttributeMap[key]) || undefined));
      }
    }
  }
  if(values){
    if(values.length > 0){
      return values.join(',');
    }
  }
  return '';
}
function loadColumn(attributes){
  var attrStr = [];
  for (var attr in attributes) {
    var dataType = attributes[attr];
    attrStr.push(quoteIdentifier(dataType));
  }
  return attrStr;
}

function addTableExistsWrapper(query, exists){
  return [
    "IF (",
      (exists ? "" : "NOT"), " EXISTS (",
      "SELECT * FROM INFORMATION_SCHEMA.TABLES",
      "WHERE TABLE_NAME='<%= unquotedTable %>'))",
    "BEGIN",
      query,
    "END"
  ].join(" ");
}

//select stuff
function loadFields(attributes){
  var attrStr = [];
  for (var attr in attributes) {
    attrStr.push(quoteIdentifier(attr));
  }
  return attrStr;
}
function processField(attribute, tableName){
  var sql = '';
  if(tableName){
    sql += quoteIdentifier(tableName) + '.';
  }
  if(attribute[0] !== attribute[1]){
    return sql + quoteIdentifier(attribute[0]) + ' AS ' + quoteIdentifier(attribute[1]);
   }else{
    return sql + quoteIdentifier(attribute[0]);
  }
}
function loadFieldsWithName(attributes, tableName){
  var attrStr = [];
  if(Array.isArray(attributes[0])){
    for (var i = 0; i < attributes.length; i++) {
      attrStr.push(processField(attributes[i], tableName));
    }
  }else{  
    for (var attr in attributes) {
      if(tableName){
        attrStr.push(quoteIdentifier(tableName) + "." + quoteIdentifier(attr));
      }else{
        attrStr.push(quoteIdentifier(attr));
      }
    }
  }
  return attrStr.join(',');
}
function joinFields(attributes, tableName){
  var attrStr = [];
  if(tableName){
    for (var attr in attributes) {
      attrStr.push(quoteIdentifier(tableName)
        + "."
        + quoteIdentifier(attr)
        + " AS " + quoteIdentifier(tableName + "." + attr));
    }
  }
  return attrStr.join(',');
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
    //console.log(val);
    return quoteIdentifier(val);
  },
  quoteIdentifiers: function(val, force){
    return quoteIdentifiers(val, force);
  },
  escape: function(value, field) {
    return escape(value,field);
  },
  showTableSql: function(){
    return 'SELECT name FROM sys.Tables;';
  },
  processValue: function(val, modelAttribute){
    return processValue(val, modelAttribute);
  },
  quoteTable: function(param, as) {
    var table = '';

    if (as === true) {
      as = param.as || param.name || param;
    }

    if (_.isObject(param)) {
      if (param.schema) {
        table += param.schema + '.';
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
  getCreateSchemaSql: function(schema){
    return [
      'IF NOT EXISTS (SELECT schema_name',
      'FROM information_schema.schemata',
      'WHERE schema_name = ', wrapSingleQuote(schema), ')',
      'BEGIN',
        'EXEC sp_executesql N\'CREATE SCHEMA', quoteIdentifier(schema),';\'',
      "END;"].join(' ');
  },
  getCreateTableSql: function(tableName, attributes, options) {
    var query = "CREATE TABLE <%= tableName %> (<%= attributes%>)";
    var attrStr     = []
      , self        = this
      , primaryKeys = Utils._.keys(Utils._.pick(attributes, function(dataType){
        return dataType.indexOf('PRIMARY KEY') >= 0;
      }));

    for (var attr in attributes) {
      var dataType = attributes[attr];
      attrStr.push(quoteIdentifier(attr) + " " + dataType);
    }
    var values = {
      unquotedTable: tableName,
      tableName: quoteIdentifier(tableName.toString()),
      attributes: attrStr.join(", ")
    };
    query = addTableExistsWrapper(query);
    return Utils._.template(query)(values).trim() + ";";
  },
  alterTableSql: function(tableName){
    var query = 'ALTER TABLE <%= tableName %>';
    var value = {
      tableName : quoteIdentifier(tableName)
    };
    return Utils._.template(query)(value);
  },
  dropTableSql: function(tableName, options){
    var query = "DROP TABLE <%= tableName %>";
    var values ={};
    values = {
      unquotedTable: tableName,
      tableName: quoteIdentifier(tableName.toString())
    };    
    
    query = addTableExistsWrapper(query, true);
    return Utils._.template(query)(values).trim() + ";";
  },
  bulkInsertSql: function(tableName, attributeKeys, attributes,options) {
    var query = 'INSERT<%= ignoreDuplicates %> INTO <%= table %> (<%= attributes %>) VALUES <%= tuples %>;'
      , emptyQuery = 'INSERT INTO <%= table %> DEFAULT VALUES'
      , tuples = [];

    Utils._.forEach(attributes, function(attrValueHash, i) {
      tuples.push('(' +
        attributeKeys.map(function(key) {
          if(typeof attrValueHash[key] === 'boolean'){
            return "'" + attrValueHash[key] + "'";
          }
          return escape(attrValueHash[key]);
        }.bind(this)).join(',') +
      ')');
    }.bind(this));

    var replacements = {
      ignoreDuplicates: options && options.ignoreDuplicates ? ' IGNORE' : '',
      table: quoteIdentifier(tableName.toString()),
      attributes: attributeKeys.map(function(attr) {
        return quoteIdentifier(attr);
      }.bind(this)).join(','),
      tuples: tuples
    };

    return Utils._.template(query)(replacements);
  },
  insertSql: function(tableName, valueHash, modelAttributeMap) {
    var query
      , valueQuery = 'INSERT INTO <%= tableName %> (<%= attributes %>)'
      , emptyQuery = 'INSERT INTO <%= tableName %>';

    valueQuery += ' OUTPUT <%= selFields %>  VALUES (<%= values %>)';
    if(modelAttributeMap){
      emptyQuery += ' OUTPUT <%= selFields %>';
    }
    emptyQuery += ' DEFAULT VALUES';

    valueHash = Utils.removeNullValuesFromHash(valueHash, _options.omitNull);

    var selFields = [];
    var insertKey = false;
    for (var key in modelAttributeMap) {
      selFields.push('INSERTED.' + quoteIdentifier(key));
      if(modelAttributeMap[key].autoIncrement
        && (valueHash[key] === 'DEFAULT'
          || valueHash[key] === null)){
        delete valueHash[key];
      }else if(valueHash[key] 
        && modelAttributeMap[key].autoIncrement){
        insertKey = true;
      }
    }

    var replacements = {
      tableName: quoteIdentifier(tableName.toString()),
      attributes: fieldsToSql(valueHash, false),
      selFields: selFields.join(','),
      values: valuesToSql(valueHash, modelAttributeMap)
    };

    query = (replacements.attributes.length ? valueQuery : emptyQuery) + ';';

    if(insertKey){
      query = this.identityInsertWrapper(query, tableName);
    }
    return Utils._.template(query)(replacements);
  },
  updateSql: function(tableName, valueHash, where, options, attributes){
    options = options || {};

    valueHash = Utils.removeNullValuesFromHash(valueHash, this.options.omitNull, options);

    var query
      , selFields = []
      , values = [];

    query = 'UPDATE <%= tableName %> SET <%= values %> OUTPUT <%= selFields %>';
    
    var parsedValues = valuesToSql(valueHash, attributes, true);
    for (var key in valueHash) {
      var value = valueHash[key];
      selFields.push('INSERTED.' + quoteIdentifier(key));
    }
    var replacements = {
      tableName: quoteIdentifier(tableName.toString()),
      attributes: fieldsToSql(valueHash, false),
      selFields: selFields.join(','),
      values: parsedValues,
    };

    return Utils._.template(query)(replacements);
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

  showIndexSql: function(tableName, options){
    var sql = ["SELECT",
      "TableName = t.name,",
        "name = ind.name,",
        "IndexId = ind.index_id,",
        "ColumnId = ic.index_column_id,",
        "ColumnName = col.name",
      "FROM",
        "sys.indexes ind",
      "INNER JOIN",
        "sys.index_columns ic ON  ind.object_id = ic.object_id and ind.index_id = ic.index_id",
      "INNER JOIN",
        "sys.columns col ON ic.object_id = col.object_id and ic.column_id = col.column_id",
      "INNER JOIN",
        "sys.tables t ON ind.object_id = t.object_id",
      "WHERE t.name = '<%= tableName %>'<%= options %>"
    ].join(" ");
    return Utils._.template(sql)({
      tableName: tableName,
      options: (options || {}).database ? ' FROM \'' + options.database + '\'' : ''
    });
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

  describeTableSql: function(tableName, schema, schemaDelimiter){
    var table = tableName;
    if(schema){
      table = schema + '.' + tableName;
    }
    var qry = [
      "SELECT c.COLUMN_NAME AS 'Name', c.DATA_TYPE AS 'Type',",
      "c.IS_NULLABLE as 'IsNull' , COLUMN_DEFAULT AS 'Default'",
      "FROM INFORMATION_SCHEMA.TABLES t ",
      "INNER JOIN INFORMATION_SCHEMA.COLUMNS c ON t.TABLE_NAME = c.TABLE_NAME",
      "where t.TABLE_NAME =",
        wrapSingleQuote(table),
      ";"
    ].join(" ");

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
  getTopClause: function(limit){
    return "TOP(" + limit + ")";
  },
  getCountClause: function(alias, columnName){
    return [
      "SELECT COUNT(",
      columnName,
      ") AS", quoteIdentifier(alias)
    ].join(' ');
  },
  getSelectorClause: function(model, options){
    var query = ['SELECT'];
    //we have joins
    if(options.limit && !options.offset){
      query.push(this.getTopClause(options.limit));
    }
    //add join table
    if(options.include){
      query.push(loadFieldsWithName(options.attributes, model.name));
      for(var i = 0; i < options.include.length; i++){
        if(options.include[i].as) {
          query.push(',' + joinFields(options.include[i].model.rawAttributes
            , options.include[i].as));
        }
      }
    }else{
      query.push(loadFieldsWithName(options.attributes));
      //query.push(loadFieldsWithName(model.rawAttributes));
    }
    return query.join(' ');
  },
  getFromClause: function(tableName, asValue){
    var query = ["FROM",
        quoteIdentifier(tableName)];
    if(asValue){
      query.push("AS");
      query.push(quoteIdentifier(asValue));
    }
    return query.join(' ');
  },
  getJoinClause: function(model, include){
    //console.log(include.through);
    var query = [];
    var primaryKey = quoteIdentifier(model.primaryKeyAttribute);
    var joinType = include.required ? 'INNER JOIN' : 'LEFT OUTER JOIN';
    var joinTable = include.as ? include.as : include.model.name;
    var manyJoinTable = joinTable;
    joinTable = quoteIdentifier(joinTable);
    var tableName = quoteIdentifier(model.name);
    var hasManyToMany = false;

    query.push(joinType);
    if(include.through){
      hasManyToMany = true;
    }
    //this logic handles the join types
    var associationType = include.association.associationType;
    var rootKey,joinKey;
    if(associationType === 'BelongsTo'){
      rootKey = quoteIdentifier(include.association.foreignKey);
      joinKey = primaryKey;
    }else if (associationType === 'HasMany'){
      rootKey = primaryKey;
      joinKey = quoteIdentifier(include.association.identifier);
      if(hasManyToMany){
        //indicates many to many
        manyJoinTable = quoteIdentifier(joinTable + '.' + include.through.as);
        //console.log(include.through);
        query = query.concat([
          "(",
          quoteIdentifier(include.through.model.name)
          , "AS", manyJoinTable,
          joinType,
          joinTable, "AS", joinTable,
          "ON", joinTable + '.' + quoteIdentifier(include.model.primaryKeyAttribute),
          "=", manyJoinTable + '.' + quoteIdentifier(include.through.model.primaryKeyAttribute),
          ")"
        ]);
      }
    }else{
      rootKey = primaryKey;
      //console.log('dang mang',associationType);
      joinKey = quoteIdentifier(include.association.foreignKey);
      //console.log('asdfdsaf', rootKey);
    }

    if(!hasManyToMany){
      query.push(quoteIdentifier(include.model.tableName));
      query.push('AS');
      query.push(joinTable);
    }
    query = query.concat([
      'ON', tableName + '.' + rootKey,
      '=', manyJoinTable + '.' + joinKey
    ]);
    if(include.where){
      query.push('AND');
      query.push(this.formatWhereCondition(include.where, joinTable));
    }
    return query.join(' ');
  },
  formatWhereCondition: function(where, tableName){
    var query = [];
    for(var key in where){
      var val = where[key];
      var operator = '=';

      if (!val) {
        operator = 'IS';
      }
      if(tableName){
        query.push(quoteIdentifier(tableName) + '.' + quoteIdentifier(key));
      } else {
        query.push(quoteIdentifier(key));
      }
      query.push(operator);
      if(!val){
        query.push('NULL');
      }else if(typeof val === 'number'){
        query.push(val);
      }else{
        query.push(wrapSingleQuote(val));
      }
    }
    return query.join(' ');
  },
  getWhereClause: function(where, tableName){
    return [
      'WHERE',
      this.formatWhereCondition(where, tableName)
    ].join(' ');
  }};













