'use strict';

var Utils = require('../../utils')
  , DataTypes = require('./data-types')
  , SqlGenerator = require('./sql-generator')
  , Model = require('../../model')
  , _ = require('lodash')
  , util = require('util')
  , AbstractQueryGenerator = require('../abstract/query-generator');

module.exports = (function() {
  var QueryGenerator = {
    options: {},
    dialect: 'mssql',

    createSchema: function(schema) {
      return [
        'IF NOT EXISTS (SELECT schema_name',
        'FROM information_schema.schemata',
        'WHERE schema_name =', wrapSingleQuote(schema), ')',
        'BEGIN',
          'EXEC sp_executesql N\'CREATE SCHEMA', this.quoteIdentifier(schema),';\'',
        "END;"].join(' ');
    },

    showSchemasQuery: function() {
      return ['SELECT "name" as "schema_name" FROM sys.schemas as s',
              'WHERE "s"."name" NOT IN (',
              "'INFORMATION_SCHEMA', 'dbo', 'guest', 'sys', 'archive'",
              ")", "AND", '"s"."name" NOT LIKE', "'db_%'"].join(' ');
    },

    createTableQuery: function(tableName, attributes, options) {
      var query = "IF OBJECT_ID('[<%= escapedTable %>]', 'U') IS NULL CREATE TABLE <%= table %> (<%= attributes%>)";
      var attrStr     = []
        , self        = this
        , primaryKeys = Utils._.keys(Utils._.pick(attributes, function(dataType){
          return dataType.indexOf('PRIMARY KEY') >= 0;
        }));

      for (var attr in attributes) {
        var dataType = mssqlDataTypeMapping(tableName, attr, attributes[attr]);
        attrStr.push(this.quoteIdentifier(attr) + " " + dataType);
      }

      var values = {
        escapedTable: this.quoteTable(tableName).replace(/"/g, ''),
        table: this.quoteTable(tableName),
        attributes: attrStr.join(", ")
      };

      return Utils._.template(query)(values).trim() + ";";
    },

    describeTableQuery: function(tableName, schema, schemaDelimiter) {
      var table = tableName;
      if (schema) {
        table = schema + '.' + tableName;
      }

      return [
        "SELECT c.COLUMN_NAME AS 'Name', c.DATA_TYPE AS 'Type',",
        "c.IS_NULLABLE as 'IsNull' , COLUMN_DEFAULT AS 'Default'",
        "FROM INFORMATION_SCHEMA.TABLES t ",
        "INNER JOIN INFORMATION_SCHEMA.COLUMNS c ON t.TABLE_NAME = c.TABLE_NAME",
        "where t.TABLE_NAME =",
          wrapSingleQuote(table),
        ";"
      ].join(" ");
    },

    renameTableQuery: function(before, after) {
      var query = 'EXEC sp_rename <%= before %>, <%= after %>;';
      return Utils._.template(query)({
        before: this.quoteTable(before),
        after: this.quoteTable(after)
      });
    },

    showTablesQuery: function () {
      return 'SELECT name FROM sys.tables;';
    },

    dropTableQuery: function(tableName, options) {
      var query = "IF OBJECT_ID('[<%= escapedTable %>]', 'U') IS NOT NULL DROP TABLE <%= table %>";
      var values = {
        escapedTable: this.quoteTable(tableName).replace(/"/g, ''),
        table: this.quoteTable(tableName)
      };

      return Utils._.template(query)(values).trim() + ";";
    },

    addColumnQuery: function(tableName, key, dataType) {
      // FIXME: attributeToSQL SHOULD be using attributes in addColumnSql
      //        but instead we need to pass the key along as the field here
      dataType.field = key;

      var query = [
        SqlGenerator.alterTableSql(tableName),
        SqlGenerator.addColumnSql(key, dataType)
      ].join(' ') + ';';

      return query;
    },

    removeColumnQuery: function(tableName, attributeName) {
      var query = [
        SqlGenerator.alterTableSql(tableName),
        SqlGenerator.dropSql(attributeName)
      ].join(' ') + ';';
      return query;
    },

    changeColumnQuery: function(tableName, attributes) {
      var query = [
        SqlGenerator.alterTableSql(tableName),
        SqlGenerator.alterColumnSql(),
        SqlGenerator.alterAttributesSql(attributes)
      ].join(' ') + ';';

      return query;
    },

    renameColumnQuery: function(tableName, attrBefore, attributes) {
      var newColumnName;
      for (var attrName in attributes) {
        newColumnName = attrName;
      }

      var query = [
        SqlGenerator.renameColumnSql(tableName, attrBefore, newColumnName),
        this.changeColumnQuery(tableName, attributes)
      ].join(' ');
      return query;
    },

    bulkInsertQuery: function(tableName, attrValueHashes, options, attributes) {
      var query = 'INSERT<%= ignoreDuplicates %> INTO <%= table %> (<%= attributes %>) VALUES <%= tuples %>;'
        , emptyQuery = 'INSERT INTO <%= table %> DEFAULT VALUES'
        , tuples = []
        , allAttributes = []
        , needIdentityInsertWrapper = false
        , allQueries = [];

      Utils._.forEach(attrValueHashes, function(attrValueHash, i) {
        // special case for empty objects with primary keys
        var fields = Object.keys(attrValueHash);
        if (fields.length === 1 && attributes[fields[0]].autoIncrement && attrValueHash[fields[0]] === null) {
          allQueries.push(emptyQuery);
          return;
        }

        // normal case
        Utils._.forOwn(attrValueHash, function(value, key, hash) {
          if (value !== null && attributes[key].autoIncrement) {
            needIdentityInsertWrapper = true;
          }

          if (allAttributes.indexOf(key) === -1) {
            if (value === null && attributes[key].autoIncrement)
              return;

            allAttributes.push(key);
          }
        });
      });

      if (allAttributes.length > 0) {
        Utils._.forEach(attrValueHashes, function(attrValueHash, i) {
          tuples.push('(' +
            allAttributes.map(function(key) {
              return this.escape(attrValueHash[key]);
            }.bind(this)).join(',') +
          ')');
        }.bind(this));

        allQueries.push(query);
      }

      var replacements = {
        ignoreDuplicates: options && options.ignoreDuplicates ? ' IGNORE' : '',
        table: this.quoteTable(tableName),
        attributes: allAttributes.map(function(attr) {
                      return this.quoteIdentifier(attr);
                    }.bind(this)).join(','),
        tuples: tuples
      };

      var generatedQuery = Utils._.template(allQueries.join(';'))(replacements);
      if (needIdentityInsertWrapper)
        return SqlGenerator.identityInsertWrapper(generatedQuery, tableName);
      return generatedQuery;
    },

    deleteQuery: function(tableName, where, options) {
      var query = [
        SqlGenerator.deleteSql(tableName),
        "WHERE",
        this.getWhereConditions(where),
        ";SELECT @@ROWCOUNT AS AFFECTEDROWS;"].join(' ');

      return query;
    },

    incrementQuery: function(tableName, attrValueHash, where, options, attributes) {
      attrValueHash = Utils.removeNullValuesFromHash(attrValueHash, false, options);

      for (var key in attributes) {
        if (attributes[key].primaryKey && attrValueHash[key]) {
          delete attrValueHash[key];
        }

        attrValueHash[key] += 1;
      }

      for (key in options) {
        if (key === 'allowNull') {
          delete options[key];
        }
      }

      if (!Object.keys(attrValueHash).length) {
        return '';
        //return ['SELECT * FROM ', tableName, 'WHERE', this.getWhereConditions(where) + ';'].join(' ');
      }

      var query = [
        SqlGenerator.incrementSql(tableName, attrValueHash, options),
        'WHERE',
        this.getWhereConditions(where)
      ].join(' ') + ';';
      return query;
    },

    showIndexQuery: function(tableName, options) {
      // FIXME: temporary until I implement proper schema support
      var dequotedTableName = tableName.toString().replace(/['"]+/g, '');
      var sql = "EXEC sys.sp_helpindex @objname = N'[<%= tableName %>]';";
      return Utils._.template(sql)({
        tableName: dequotedTableName
      });
    },

    removeIndexQuery: function(tableName, indexNameOrAttributes) {
      var sql = 'DROP INDEX <%= indexName %> ON <%= tableName %>'
        , indexName = indexNameOrAttributes;

      if (typeof indexName !== 'string') {
        indexName = Utils.inflection.underscore(tableName + '_' + indexNameOrAttributes.join('_'));
      }

      var values = {
        tableName: this.quoteIdentifiers(tableName),
        indexName: indexName
      };

      return Utils._.template(sql)(values);
    },

    attributesToSQL: function(attributes, options) {
      var result = {}
        , key
        , attribute;

      //detect multiple cascades associated with the same id
      var cascadeCheck = [];
      for (key in attributes) {
        attribute = attributes[key];
        if (attribute.onDelete || attribute.onUpdate) {
          //handles self referencial keys, first it doesnt make sense, second, what?
          if (attribute.Model && attribute.Model.tableName === attribute.references) {
            this.sequelize.log('MSSQL does not support self referencial constraints, '
              + 'we will remove it but we recommend restructuring your query');
            attribute.onDelete = '';
            attribute.onUpdate = '';
          } else {
            cascadeCheck.push(key);
          }
        }
      }

      for (var i = 0; i < cascadeCheck.length-1; i++) {
        var casKey = cascadeCheck[i];
        for (var j = i+1; j < cascadeCheck.length; j++) {
          var casKey2 = cascadeCheck[j];
          if (attributes[casKey].referencesKey === attributes[casKey2].referencesKey) {
            this.sequelize.log('MSSQL does not support multiple cascade keys on the same reference, '
              + 'we will remove them to make this work but we recommend restructuring your query.');
            attributes[casKey].onDelete = '';
            attributes[casKey].onUpdate = '';
            attributes[casKey2].onDelete = '';
            attributes[casKey2].onUpdate = '';
          }
        }
      }

      for (key in attributes) {
        attribute = attributes[key];
        if (key && !attribute.field) attribute.field = key;
        result[attribute.field || key] = SqlGenerator.attributeToSQL(attribute, options);
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

    createTrigger: function(tableName, triggerName, timingType, fireOnArray, functionName, functionParams,
        optionsArray) {
      throwMethodUndefined('createTrigger');
    },

    dropTrigger: function(tableName, triggerName) {
      throwMethodUndefined('dropTrigger');
    },

    renameTrigger: function(tableName, oldTriggerName, newTriggerName) {
      throwMethodUndefined('renameTrigger');
    },

    createFunction: function(functionName, params, returnType, language, body, options) {
      throwMethodUndefined('createFunction');
    },

    dropFunction: function(functionName, params) {
      throwMethodUndefined('dropFunction');
    },

    renameFunction: function(oldFunctionName, params, newFunctionName) {
      throwMethodUndefined('renameFunction');
    },

    quoteIdentifier: function(identifier, force) {
        if (identifier === '*') return identifier;
        return Utils.addTicks(identifier, '"');
    },

    getForeignKeysQuery: function(tableName, schemaName) {
      return [
        'SELECT',
          'constraint_name = C.CONSTRAINT_NAME',
        'FROM',
          'INFORMATION_SCHEMA.TABLE_CONSTRAINTS C',
        "WHERE C.CONSTRAINT_TYPE != 'PRIMARY KEY'",
        'AND C.TABLE_NAME = ', wrapSingleQuote(tableName)
      ].join(" ");
    },

    dropForeignKeyQuery: function(tableName, foreignKey) {
      return [
        SqlGenerator.alterTableSql(tableName),
        SqlGenerator.dropSql(foreignKey)
      ].join(' ') + ';';
    },

    setAutocommitQuery: function(value) {
      return '';
      // return 'SET IMPLICIT_TRANSACTIONS ' + (!!value ? 'OFF' : 'ON') + ';';
    },

    setIsolationLevelQuery: function(value, options) {
      if (options.parent) {
        return;
      }

      return 'SET TRANSACTION ISOLATION LEVEL ' + value + ';';
    },

    startTransactionQuery: function(transaction, options) {
      if (options.parent) {
        return 'SAVE TRANSACTION ' + SqlGenerator.quoteIdentifier(transaction.name) + ';';
      }

      return 'BEGIN TRANSACTION;';
    },

    commitTransactionQuery: function(options) {
      if (options.parent) {
        return;
      }

      return 'COMMIT TRANSACTION;';
    },

    rollbackTransactionQuery: function(transaction, options) {
      if (options.parent) {
        return 'ROLLBACK TRANSACTION ' + this.quoteIdentifier(transaction.name) + ';';
      }

      return 'ROLLBACK TRANSACTION;';
    },

    addLimitAndOffset: function(options, model) {
      var fragment = '';
      var offset = options.offset || 0
        , isSubQuery = options.hasIncludeWhere || options.hasIncludeRequired || options.hasMultiAssociation;

      // FIXME: This is ripped from selectQuery to determine whether there is already
      //        an ORDER BY added for a subquery. Should be refactored so we dont' need
      //        the duplication. Also consider moving this logic inside the options.order
      //        check, so that we aren't compiling this twice for every invocation.
      var mainQueryOrder = [];
      var subQueryOrder = [];
      if (options.order) {
        if (Array.isArray(options.order)) {
          options.order.forEach(function(t) {
            if (!Array.isArray(t)) {
              if (isSubQuery && !(t instanceof Model) && !(t.model instanceof Model)) {
                subQueryOrder.push(this.quote(t, model));
              }
            } else {
              if (isSubQuery && !(t[0] instanceof Model) && !(t[0].model instanceof Model)) {
                subQueryOrder.push(this.quote(t, model));
              }
              mainQueryOrder.push(this.quote(t, model));
            }
          }.bind(this));
        } else {
          mainQueryOrder.push(options.order);
        }
      }

      if (options.limit || options.offset) {
        if (!options.order || (options.include && !subQueryOrder.length)) {
          fragment += ' ORDER BY ' + this.quoteIdentifier(model.primaryKeyAttribute);
        }

        if (options.offset || options.limit) {
          fragment += ' OFFSET ' + offset + ' ROWS';
        }

        if (options.limit) {
          fragment += ' FETCH NEXT ' + options.limit + ' ROWS ONLY';
        }
      }

      return fragment;
    },

    findAssociation: function(attribute, dao) {
      throwMethodUndefined('findAssociation');
    },

    getAssociationFilterDAO: function(filterStr, dao) {
      throwMethodUndefined('getAssociationFilterDAO');
    },

    getAssociationFilterColumn: function(filterStr, dao, options) {
      throwMethodUndefined('getAssociationFilterColumn');
    },

    getConditionalJoins: function(options, originalDao) {
      throwMethodUndefined('getConditionalJoins');
    },

    booleanValue: function(value) {
      return !!value ? 1 : 0;
    },

    uniqueConstraintMapping: {
      code: 'EREQUEST',
      map: function(str) {
        var match = str.match(/Violation of UNIQUE KEY constraint '(.*)'. Cannot insert duplicate key in object '?(.*?)$/);
        match = match || str.match(/Cannot insert duplicate key row in object .* with unique index '(.*)'/);
        if (match === null || match.length < 2) {
          return false;
        }

        return {
          indexName: match[1],
          fields: match[1].split('_')
        };
      }
    },
  };

  // private methods
  function wrapSingleQuote(identifier){
    return Utils.addTicks(identifier, "'");
  }

  function mssqlDataTypeMapping(tableName, attr, dataType) {
    if (Utils._.includes(dataType, 'DATETIME')) {
      dataType = dataType.replace(/DATETIME/, 'DATETIME2');
    }

    return dataType;
  }

  /* istanbul ignore next */
  var throwMethodUndefined = function(methodName) {
    throw new Error('The method "' + methodName + '" is not defined! Please add it to your sql dialect.');
  };

  // TODO: get rid of this
  SqlGenerator.options = QueryGenerator.options;
  return Utils._.extend(Utils._.clone(AbstractQueryGenerator), QueryGenerator);
})();
