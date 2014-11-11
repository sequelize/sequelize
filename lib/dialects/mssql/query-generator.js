'use strict';

var Utils = require('../../utils')
  , DataTypes = require('./data-types')
  , SqlGenerator = require('./sql-generator')
  , Model = require('../../model')
  , _ = require('lodash')
  , util = require('util');



module.exports = (function() {
  var QueryGenerator = {
    get options(){
      return SqlGenerator.options;
    },
    set options (opt) {
      SqlGenerator.options = opt;
    },
    get dialect(){
      return SqlGenerator.dialect;
    },
    set dialect(dial) {
      SqlGenerator.dialect = dial;
    },
    get sequelize(){
      return SqlGenerator.sequelize;
    },
    set sequelize(seq) {
      SqlGenerator.sequelize = seq;
    },

    addSchema: function(param) {
      var self = this
        , schema = (param.options && param.options.schema ? param.options.schema : undefined)
        , schemaDelimiter = (param.options && param.options.schemaDelimiter ? param.options.schemaDelimiter : undefined);

      if (!schema) return param.tableName || param;

      return {
        tableName: param.tableName || param,
        table: param.tableName || param,
        name: param.name || param,
        schema: schema,
        delimiter: schemaDelimiter || '.',
        toString: function() {
          return this.schema + this.delimiter + this.tableName;
        }
      };
    },

    createSchema: function(schema){
      return SqlGenerator.getCreateSchemaSql(schema);
    },
    showSchemasQuery: function(){
      return 'SELECT name FROM sys.Tables;';
    },
    /*
      Returns a query for creating a table.
      Parameters:
        - tableName: Name of the new table.
        - attributes: An object with containing attribute-attributeType-pairs.
                      Attributes should have the format:
                      {attributeName: type, attr2: type2}
                      --> e.g. {title: 'VARCHAR(255)'}
        - options: An object with options.
                   Defaults: { engine: 'InnoDB', charset: null }
    */
    /* istanbul ignore next */
    createTableQuery: function(tableName, attributes, options) {
      var query = SqlGenerator.getCreateTableSql(tableName, attributes, options);
      return query;
    },


    renameTableQuery: function(before, after) {
      throwMethodUndefined('renameTableQuery');
    },

    showTablesQuery: function () {
      return SqlGenerator.showTableSql();
    },

    /*
      Returns a rename table query.
      Parameters:
        - originalTableName: Name of the table before execution.
        - futureTableName: Name of the table after execution.
    */

    dropTableQuery: function(tableName, options) {
      return SqlGenerator.dropTableSql(tableName,options);
    },

    addColumnQuery: function(tableName, key, dataType) {
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

    /*
      Returns an insert into command. Parameters: table name + hash of attribute-value-pairs.
    */
    insertQuery: function(table, valueHash, modelAttributes, options) {
      var modelAttributeMap = {};
      if (modelAttributes) {
        Utils._.each(modelAttributes, function(attribute, key) {
          modelAttributeMap[key] = attribute;
          if (attribute.field) {
            modelAttributeMap[attribute.field] = attribute;
          }
        });
      }
      return SqlGenerator.insertSql(table,valueHash,modelAttributeMap);
    },

    /*
      Returns an insert into command for multiple values.
      Parameters: table name + list of hashes of attribute-value-pairs.
    */
    /* istanbul ignore next */
    bulkInsertQuery: function(tableName, attrValueHashes,options, attributes) {
      var query = '',
        allAttributes = [],
        insertKey = false,
        isEmpty = true,
        ignoreKeys = [];

      for(var key in attributes){
        var aliasKey = attributes[key].field || key;
        if(ignoreKeys.indexOf(aliasKey) < 0){
          ignoreKeys.push(aliasKey);
        }
        if(attributes[key].autoIncrement){
          for(var i = 0; i < attrValueHashes.length; i++){
            if(aliasKey in attrValueHashes[i]){
              delete attrValueHashes[i][aliasKey];
            }
          }
        }
      }
      Utils._.forEach(attrValueHashes, function(attrValueHash, i) {
        Utils._.forOwn(attrValueHash, function(value, key, hash) {
          if (allAttributes.indexOf(key) === -1) allAttributes.push(key);
          var aliasKey = attributes[key].field || key;
          if (value !== null && ignoreKeys.indexOf(key) > -1){

            ignoreKeys.splice(ignoreKeys.indexOf(key),1);
          }else if(value !== null && attributes[key].autoIncrement){
            insertKey = true;
          }
          if(value !== null){
            isEmpty = false;
          }
        });
      });

      if(!isEmpty){
        for(var j = 0; j < ignoreKeys.length; j++){
          if(allAttributes.indexOf(ignoreKeys[j]) > -1){
            allAttributes.splice(allAttributes.indexOf(ignoreKeys[j]), 1);
          }
        }
        query = SqlGenerator.bulkInsertSql(tableName, allAttributes, attrValueHashes,options);
        if(insertKey){
          query = SqlGenerator.identityInsertWrapper(query, tableName);
        }
      }else{
        for(var k = 0; k < attrValueHashes.length; k++){
          query += SqlGenerator.insertSql(tableName);
        }
      }
      return query;
    },
    /*
      Returns an update query.
      Parameters:
        - tableName -> Name of the table
        - values -> A hash with attribute-value-pairs
        - where -> A hash with conditions (e.g. {name: 'foo'})
                   OR an ID as integer
                   OR a string with conditions (e.g. 'name="foo"').
                   If you use a string, you have to escape it on your own.
    */
    updateQuery: function(tableName, attrValueHash, where, options, attributes) {
      var query;
      attrValueHash = Utils.removeNullValuesFromHash(attrValueHash, false, options);

      //very unique case for cascades, i generally don't approve
      if(Object.keys(attrValueHash).length === 1 && attributes[Object.keys(attrValueHash)[0]].primaryKey){
        console.warn('Updating a Primary Key is not supported in MSSQL, please restructure your query');
      }else{
        for(var key in attributes){
          var aliasKey = attributes[key].field || key;
          if(attributes[key].primaryKey && attrValueHash[aliasKey]){
            delete attrValueHash[aliasKey];
          }
          if(attrValueHash[aliasKey] && attrValueHash[aliasKey].fn){

          }
        }
        if(!Object.keys(attrValueHash).length){
          return '';
          //return ['SELECT * FROM ', tableName, 'WHERE', this.getWhereConditions(where) + ';'].join(' ');
        }
        query = [
          SqlGenerator.updateSql(tableName, attrValueHash, attributes),
          'WHERE',
          this.getWhereConditions(where)
        ].join(' ') + ';';
      }

      return query;
    },
    /*
      Returns a deletion query.
      Parameters:
        - tableName -> Name of the table
        - where -> A hash with conditions (e.g. {name: 'foo'})
                   OR an ID as integer
                   OR a string with conditions (e.g. 'name="foo"').
                   If you use a string, you have to escape it on your own.
      Options:
        - limit -> Maximaum count of lines to delete
        - truncate -> boolean - whether to use an 'optimized' mechanism (i.e. TRUNCATE) if available,
                                note that this should not be the default behaviour because TRUNCATE does not
                                always play nicely (e.g. InnoDB tables with FK constraints)
                                (@see http://dev.mysql.com/doc/refman/5.6/en/truncate-table.html).
                                Note that truncate must ignore limit and where
    */
    /* istanbul ignore next */
    deleteQuery: function(tableName, where, options) {
      var query = [
        SqlGenerator.deleteSql(tableName),
        "WHERE",
        this.getWhereConditions(where),
        ";SELECT @@ROWCOUNT AS AFFECTEDROWS;"].join(' ');

      return query;
    },

    /*
      Returns an update query.
      Parameters:
        - tableName -> Name of the table
        - values -> A hash with attribute-value-pairs
        - where -> A hash with conditions (e.g. {name: 'foo'})
                   OR an ID as integer
                   OR a string with conditions (e.g. 'name="foo"').
                   If you use a string, you have to escape it on your own.
    */
    incrementQuery: function(tableName, attrValueHash, where, options, attributes) {
      attrValueHash = Utils.removeNullValuesFromHash(attrValueHash, false, options);

      for(var key in attributes){
        if(attributes[key].primaryKey && attrValueHash[key]){
          delete attrValueHash[key];
        }
        attrValueHash[key] += 1;
      }
      for(key in options){
        if(key === 'allowNull'){
          delete options[key];
        }
      }
      if(!Object.keys(attrValueHash).length){
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

    nameIndexes: function (indexes, rawTablename) {
      return Utils._.map(indexes, function (index) {
        if (!index.hasOwnProperty('name')) {
          var onlyAttributeNames = index.fields.map(function(attribute) {
            return (typeof attribute === 'string') ? attribute : attribute.attribute;
          }.bind(this));

          index.name = Utils.inflection.underscore(rawTablename + '_' + onlyAttributeNames.join('_'));
        }

        return index;
      });
    },

    addIndexQuery: function(tableName, attributes, options, rawTablename) {
      return SqlGenerator.addIndexSql(tableName, attributes, options, rawTablename);
    },

    showIndexQuery: function(tableName, options) {
      return SqlGenerator.showIndexSql(tableName, options);
    },

    removeIndexQuery: function(tableName, indexNameOrAttributes) {
      return SqlGenerator.removeIndexSql(tableName, indexNameOrAttributes);
    },

    attributesToSQL: function(attributes, options) {
      var result = {}
        , key
        , attribute;

      //detect multiple cascades associated with the same id
      var cascadeCheck = [];
      for(key in attributes){
        attribute = attributes[key];
        if(attribute.onDelete || attribute.onUpdate){
          //handles self referencial keys, first it doesnt make sense, second, what?
          if(attribute.Model && attribute.Model.tableName === attribute.references){
            console.warn('MSSQL does not support self referencial constraints, '
              + 'we will remove it but we recommend restructuring your query');
            attribute.onDelete = '';
            attribute.onUpdate = '';
          }else{
            cascadeCheck.push(key);
          }
        }
      }
      for(var i = 0; i < cascadeCheck.length-1; i++){
        var casKey = cascadeCheck[i];
        for(var j = i+1; j < cascadeCheck.length; j++){
          var casKey2 = cascadeCheck[j];
          if(attributes[casKey].referencesKey === attributes[casKey2].referencesKey){
            console.warn('MSSQL does not support multiple cascade keys on the same reference, '
              + 'we will remove them to make this work but we recommend restructuring your query.');
            attributes[casKey].onDelete = '';
            attributes[casKey].onUpdate = '';
            attributes[casKey2].onDelete = '';
            attributes[casKey2].onUpdate = '';
          }
        }
      }

      for(key in attributes) {
        attribute = attributes[key];
        if(key && !attribute.field)
          attribute.field = key;
        result[attribute.field || key] = SqlGenerator.attributeToSQL(attribute, options);
      }

      return result;
    },

    /*
      Returns all auto increment fields of a factory.
    */
    /* istanbul ignore next */
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
    quoteTable: function(param, as) {
      return SqlGenerator.quoteTable(param, as);
    },

    quote: function(obj, parent, force) {
      if (Utils._.isString(obj)) {
        return SqlGenerator.quoteIdentifiers(obj, force);
      } else if (Array.isArray(obj)) {
        // loop through array, adding table names of models to quoted
        // (checking associations to see if names should be singularised or not)
        var tableNames = []
          , parentAssociation
          , len = obj.length;
        for (var i = 0; i < len - 1; i++) {
          var item = obj[i];
          if (item._modelAttribute || Utils._.isString(item) || item._isSequelizeMethod || 'raw' in item) {
            break;
          }

          var model, as;
          if (item instanceof Model) {
            model = item;
          } else {
            model = item.model;
            as = item.as;
          }

          // check if model provided is through table
          var association;
          if (!as && parentAssociation && parentAssociation.through.model === model) {
            association = {as: Utils.singularize(model.tableName, model.options.language)};
          } else {
            // find applicable association for linking parent to this model
            association = parent.getAssociation(model, as);
          }

          if (association) {
            tableNames[i] = association.as;
            parent = model;
            parentAssociation = association;
          } else {
            tableNames[i] = model.tableName;
            throw new Error('\'' + tableNames.join('.') + '\' in order / group clause is not valid association');
          }
        }

        // add 1st string as quoted, 2nd as unquoted raw
        var sql = (i > 0 ? SqlGenerator.quoteIdentifier(tableNames.join('.')) + '.' : '')
          + this.quote(obj[i], parent, force);
        if (i < len - 1) {
          sql += ' ' + obj[i + 1];
        }
        return sql;
      } else if (obj._modelAttribute) {
        return SqlGenerator.quoteIdentifier(obj.Model.name) + '.' + obj.fieldName;
      } else if (obj._isSequelizeMethod) {
        return this.handleSequelizeMethod(obj);
      } else if (Utils._.isObject(obj) && 'raw' in obj) {
        return obj.raw;
      } else {
        throw new Error('Unknown structure passed to order / group: ' + JSON.stringify(obj));
      }
    },


    /*
     Create a trigger
     */
    /* istanbul ignore next */
    createTrigger: function(tableName, triggerName, timingType, fireOnArray, functionName, functionParams,
        optionsArray) {
      throwMethodUndefined('createTrigger');
    },

    /*
     Drop a trigger
     */
    /* istanbul ignore next */
    dropTrigger: function(tableName, triggerName) {
      throwMethodUndefined('dropTrigger');
    },

    /*
     Rename a trigger
    */
    /* istanbul ignore next */
    renameTrigger: function(tableName, oldTriggerName, newTriggerName) {
      throwMethodUndefined('renameTrigger');
    },

    /*
     Create a function
     */
    /* istanbul ignore next */
    createFunction: function(functionName, params, returnType, language, body, options) {
      throwMethodUndefined('createFunction');
    },

    describeTableQuery: function(tableName, schema, schemaDelimiter) {
      return SqlGenerator.describeTableSql(tableName, schema, schemaDelimiter);
    },


    /*
     Drop a function
     */
    /* istanbul ignore next */
    dropFunction: function(functionName, params) {
      throwMethodUndefined('dropFunction');
    },

    /*
     Rename a function
     */
    /* istanbul ignore next */
    renameFunction: function(oldFunctionName, params, newFunctionName) {
      throwMethodUndefined('renameFunction');
    },

    /*
      Escape an identifier (e.g. a table or attribute name)
    */
    /* istanbul ignore next */
    quoteIdentifier: function(identifier, force) {
      return SqlGenerator.quoteIdentifier(identifier, force);
    },

    /*
      Split an identifier into .-separated tokens and quote each part
    */
    quoteIdentifiers: function(identifiers, force) {
      if (identifiers.indexOf('.') !== -1) {
        identifiers = identifiers.split('.');
        return SqlGenerator.quoteIdentifier(
          identifiers.slice(0, identifiers.length - 1).join('.'))
          + '.' + SqlGenerator.quoteIdentifier(identifiers[identifiers.length - 1]);
      } else {
        return SqlGenerator.quoteIdentifier(identifiers);
      }
    },

    /*
      Escape a value (e.g. a string, number or date)
    */
    escape: function(value, field) {
      return SqlGenerator.escape(value,field);
    },

    /**
     * Generates an SQL query that returns all foreign keys of a table.
     *
     * @param  {String} tableName  The name of the table.
     * @param  {String} schemaName The name of the schema.
     * @return {String}            The generated sql query.
     */
    getForeignKeysQuery: function(tableName, schemaName) {
      return SqlGenerator.getForeignKeysSql(tableName);
    },
    /**
     * Generates an SQL query that removes a foreign key from a table.
     *
     * @param  {String} tableName  The name of the table.
     * @param  {String} foreignKey The name of the foreign key constraint.
     * @return {String}            The generated sql query.
     */
    dropForeignKeyQuery: function(tableName, foreignKey) {
      return [
        SqlGenerator.alterTableSql(tableName),
        SqlGenerator.dropSql(foreignKey)
      ].join(' ') + ';';
    },
      /*
      Returns a query for selecting elements in the table <tableName>.
      Options:
        - attributes -> An array of attributes (e.g. ['name', 'birthday']). Default: *
        - where -> A hash with conditions (e.g. {name: 'foo'})
                   OR an ID as integer
                   OR a string with conditions (e.g. 'name="foo"').
                   If you use a string, you have to escape it on your own.
        - order -> e.g. 'id DESC'
        - group
        - limit -> The maximum count you want to get.
        - offset -> An offset value to start from. Only useable with limit!
    */

    selectQuery: function(tableName, options, model) {
      // Enter and change at your own peril -- Mick Hansen
      options = options || {};

      var table = null
        , self = this
        , query
        , limit = options.limit
        , mainQueryItems = []
        , mainAttributes = options.attributes && options.attributes.slice(0)
        , mainJoinQueries = []
        // We'll use a subquery if we have hasMany associations and a limit and a filtered/required association
        , subQuery = limit && (options.hasIncludeWhere || options.hasIncludeRequired || options.hasMultiAssociation) && options.subQuery !== false
        , subQueryItems = []
        , subQueryAttributes = null
        , subJoinQueries = []
        , mainTableAs = null;

      if (!Array.isArray(tableName) && model) {
        options.tableAs = mainTableAs = SqlGenerator.quoteIdentifier(model.name);
      }
      options.table = table = !Array.isArray(tableName) ? SqlGenerator.quoteTable(tableName) : tableName.map(function(t) {
        if (Array.isArray(t)) {
          return SqlGenerator.quoteTable(t[0], t[1]);
        }
        return SqlGenerator.quoteTable(t, true);
      }.bind(this)).join(', ');

      if (subQuery && mainAttributes) {
        model.primaryKeyAttributes.forEach(function(keyAtt) {
          // Check if mainAttributes contain the primary key of the model either as a field or an aliased field
          if (!_.find(mainAttributes, function (attr) {
            return keyAtt === attr || keyAtt === attr[0] || keyAtt === attr[1];
          })) {
            mainAttributes.push(model.rawAttributes[keyAtt].field ? [keyAtt, model.rawAttributes[keyAtt].field] : keyAtt);
          }
        });
      }


      // Escape attributes
      mainAttributes = mainAttributes && mainAttributes.map(function(attr) {
        var addTable = true;

        if (attr._isSequelizeMethod) {
          return self.handleSequelizeMethod(attr);
        }

        if (Array.isArray(attr) && attr.length === 2) {
          if (attr[0]._isSequelizeMethod) {
            attr[0] = self.handleSequelizeMethod(attr[0]);
            addTable = false;
          } else {
            if (attr[0].indexOf('(') === -1 && attr[0].indexOf(')') === -1) {
              attr[0] = SqlGenerator.quoteIdentifier(attr[0]);
            }
          }
          attr = [attr[0], SqlGenerator.quoteIdentifier(attr[1])].join(' AS ');
        } else {
          attr = attr.indexOf(Utils.TICK_CHAR) < 0 && attr.indexOf('"') < 0 ? self.quoteIdentifiers(attr) : attr;
        }

        if (options.include && attr.indexOf('.') === -1 && addTable) {
          attr = mainTableAs + '.' + attr;
        }
        return attr;
      });

      // If no attributes specified, use *
      mainAttributes = mainAttributes || (options.include ? [mainTableAs + '.*'] : ['*']);

      // If subquery, we ad the mainAttributes to the subQuery and set the mainAttributes to select * from subquery
      if (subQuery) {
        // We need primary keys
        subQueryAttributes = mainAttributes;
        mainAttributes = [mainTableAs + '.*'];
      }

      var topSql = this.getTop(options, query);

      if (options.include) {
        var generateJoinQueries = function(include, parentTable) {
          var table = include.model.getTableName()
            , as = include.as
            , joinQueryItem = ''
            , joinQueries = {
              mainQuery: [],
              subQuery: []
            }
            , attributes
            , association = include.association
            , through = include.through
            , joinType = include.required ? ' INNER JOIN ' : ' LEFT OUTER JOIN '
            , includeWhere = {}
            , whereOptions = Utils._.clone(options);

          whereOptions.keysEscaped = true;

          if (tableName !== parentTable && mainTableAs !== parentTable) {
            as = parentTable + '.' + include.as;
          }

          // includeIgnoreAttributes is used by aggregate functions
          if (options.includeIgnoreAttributes !== false) {

            attributes = include.attributes.map(function(attr) {
              var attrAs = attr,
                  verbatim = false;


              if (Array.isArray(attr) && attr.length === 2) {
                if (attr[0]._isSequelizeMethod) {
                  if (attr[0] instanceof Utils.literal ||
                    attr[0] instanceof Utils.cast ||
                    attr[0] instanceof Utils.fn
                  ) {
                    verbatim = true;
                  }
                }

                attr = attr.map(function($attr) {
                  return $attr._isSequelizeMethod ? self.handleSequelizeMethod($attr) : $attr;
                });

                attrAs = attr[1];
                attr = attr[0];
              } else if (attr instanceof Utils.literal) {
                return attr.val; // We trust the user to rename the field correctly
              } else if (attr instanceof Utils.cast ||
                attr instanceof Utils.fn
              ) {
                throw new Error("Tried to select attributes using Sequelize.cast or Sequelize.fn without specifying an alias for the result, during eager loading. " +
                  "This means the attribute will not be added to the returned instance");
              }

              var prefix;
              if (verbatim === true) {
                prefix = attr;
              } else {
                prefix = SqlGenerator.quoteIdentifier(as) + '.' + SqlGenerator.quoteIdentifier(attr);
              }

              return prefix + ' AS ' + SqlGenerator.quoteIdentifier(as + '.' + attrAs);
            });
            if (include.subQuery && subQuery) {
              subQueryAttributes = subQueryAttributes.concat(attributes);
            } else {
              mainAttributes = mainAttributes.concat(attributes);
            }
          }

          if (through) {
            var throughTable = through.model.getTableName()
              , throughAs = as + '.' + through.as
              , throughAttributes = through.attributes.map(function(attr) {
                return SqlGenerator.quoteIdentifier(throughAs) + '.' + SqlGenerator.quoteIdentifier(Array.isArray(attr) ? attr[0] : attr) +
                       ' AS ' +
                       SqlGenerator.quoteIdentifier(throughAs + '.' + (Array.isArray(attr) ? attr[1] : attr));
              })
              , primaryKeysSource = association.source.primaryKeyAttributes
              , tableSource = parentTable
              , identSource = association.identifierField
              , attrSource = association.source.rawAttributes[primaryKeysSource[0]].field || primaryKeysSource[0]
              , where

              , primaryKeysTarget = association.target.primaryKeyAttributes
              , tableTarget = as
              , identTarget = association.foreignIdentifierField
              , attrTarget = association.target.rawAttributes[primaryKeysTarget[0]].field || primaryKeysTarget[0]

              , sourceJoinOn
              , targetJoinOn
              , targetWhere;
            if (options.includeIgnoreAttributes !== false) {
              // Through includes are always hasMany, so we need to add the attributes to the mainAttributes no matter what (Real join will never be executed in subquery)
              mainAttributes = mainAttributes.concat(throughAttributes);
            }

            // Filter statement for left side of through
            // Used by both join and subquery where
            sourceJoinOn = SqlGenerator.quoteIdentifier(tableSource) + '.' + SqlGenerator.quoteIdentifier(attrSource) + ' = ';
            sourceJoinOn += SqlGenerator.quoteIdentifier(throughAs) + '.' + SqlGenerator.quoteIdentifier(identSource);

            // Filter statement for right side of through
            // Used by both join and subquery where
            targetJoinOn = SqlGenerator.quoteIdentifier(tableTarget) + '.' + SqlGenerator.quoteIdentifier(attrTarget) + ' = ';
            targetJoinOn += SqlGenerator.quoteIdentifier(throughAs) + '.' + SqlGenerator.quoteIdentifier(identTarget);

            if (self._dialect.supports.joinTableDependent) {
              // Generate a wrapped join so that the through table join can be dependent on the target join
              joinQueryItem += joinType + '(';
              joinQueryItem += SqlGenerator.quoteTable(throughTable, throughAs);
              joinQueryItem += joinType + SqlGenerator.quoteTable(table, as) + ' ON ';
              joinQueryItem += targetJoinOn;
              joinQueryItem += ') ON '+sourceJoinOn;
            } else {
              // Generate join SQL for left side of through
              joinQueryItem += joinType + SqlGenerator.quoteTable(throughTable, throughAs)  + ' ON ';
              joinQueryItem += sourceJoinOn;

              // Generate join SQL for right side of through
              joinQueryItem += joinType + SqlGenerator.quoteTable(table, as) + ' ON ';
              joinQueryItem += targetJoinOn;
            }

            if (include.where) {
              targetWhere = self.getWhereConditions(include.where, self.sequelize.literal(SqlGenerator.quoteIdentifier(as)), include.model, whereOptions);
              joinQueryItem += ' AND ' + targetWhere;
              if (subQuery && include.required) {
                if (!options.where) options.where = {};

                // Creating the as-is where for the subQuery, checks that the required association exists
                options.where['__' + throughAs] = self.sequelize.asIs(['(',

                  'SELECT TOP(1)' + SqlGenerator.quoteIdentifier(throughAs) + '.' + SqlGenerator.quoteIdentifier(identSource) + ' FROM ' + SqlGenerator.quoteTable(throughTable, throughAs),
                  ! include.required && joinType + SqlGenerator.quoteTable(association.source.tableName, tableSource) + ' ON ' + sourceJoinOn || '',
                  joinType + SqlGenerator.quoteTable(table, as) + ' ON ' + targetJoinOn,
                  'WHERE ' + (! include.required && targetWhere || sourceJoinOn + ' AND ' + targetWhere),
                ')', 'IS NOT NULL'].join(' '));
              }
            }
          } else {
            var left = association.associationType === 'BelongsTo' ? association.target : association.source
              , primaryKeysLeft = left.primaryKeyAttributes
              , tableLeft = association.associationType === 'BelongsTo' ? as : parentTable
              , attrLeft = primaryKeysLeft[0]
              , tableRight = association.associationType === 'BelongsTo' ? parentTable : as
              , attrRight = association.identifierField || association.identifier
              , joinOn;

            // Alias the left attribute if the left attribute is not from a subqueried main table
            // When doing a query like SELECT aliasedKey FROM (SELECT primaryKey FROM primaryTable) only aliasedKey is available to the join, this is not the case when doing a regular select where you can't used the aliased attribute
            if (!subQuery || parentTable !== mainTableAs || tableLeft !== parentTable) {
              if (left.rawAttributes[attrLeft].field) {
                attrLeft = left.rawAttributes[attrLeft].field;
              }
            }

            // Filter statement
            // Used by both join and subquery where
            joinOn =
              // Left side
              (
                (subQuery && !include.subQuery && include.parent.subQuery && !(include.hasParentRequired && include.hasParentWhere)) && SqlGenerator.quoteIdentifier(tableLeft + '.' + attrLeft) ||
                SqlGenerator.quoteIdentifier(tableLeft) + '.' + SqlGenerator.quoteIdentifier(attrLeft)
              )

              + ' = ' +

              // Right side
              (
                (subQuery && !include.subQuery && include.parent.subQuery && (include.hasParentRequired && include.hasParentWhere)) && SqlGenerator.quoteIdentifier(tableRight + '.' + attrRight) ||
                SqlGenerator.quoteIdentifier(tableRight) + '.' + SqlGenerator.quoteIdentifier(attrRight)
              );

            if (include.where) {
              joinOn += ' AND ' + self.getWhereConditions(include.where, self.sequelize.literal(SqlGenerator.quoteIdentifier(as)), include.model, whereOptions);

              // If its a multi association we need to add a where query to the main where (executed in the subquery)
              if (subQuery && association.isMultiAssociation && include.required) {
                if (!options.where) options.where = {};

                // Creating the as-is where for the subQuery, checks that the required association exists
                options.where['__' + as] = self.sequelize.asIs(['(',

                  'SELECT TOP(1)' + SqlGenerator.quoteIdentifier(attrRight),
                  'FROM ' + SqlGenerator.quoteTable(table, as),
                  'WHERE ' + joinOn,
                ')', 'IS NOT NULL'].join(' '));
              }
            }
            // Generate join SQL
            joinQueryItem += joinType + SqlGenerator.quoteTable(table,as) + ' ON ' + joinOn;


          }
          if (include.subQuery && subQuery) {
            joinQueries.subQuery.push(joinQueryItem);
          } else {
            joinQueries.mainQuery.push(joinQueryItem);
          }

          if (include.include) {
            include.include.forEach(function(childInclude) {
              if (childInclude._pseudo) return;
              var childJoinQueries = generateJoinQueries(childInclude, as);

              if (childInclude.subQuery && subQuery) {
                joinQueries.subQuery = joinQueries.subQuery.concat(childJoinQueries.subQuery);
              }
              if (childJoinQueries.mainQuery) {
                joinQueries.mainQuery = joinQueries.mainQuery.concat(childJoinQueries.mainQuery);
              }

            }.bind(this));
          }

          return joinQueries;
        };

        // Loop through includes and generate subqueries
        options.include.forEach(function(include) {
          var joinQueries = generateJoinQueries(include, options.tableAs);

          subJoinQueries = subJoinQueries.concat(joinQueries.subQuery);
          mainJoinQueries = mainJoinQueries.concat(joinQueries.mainQuery);

        }.bind(this));
      }

      // If using subQuery select defined subQuery attributes and join subJoinQueries
      if (subQuery) {
        subQueryItems.push('SELECT '  + topSql + subQueryAttributes.join(', ') + ' FROM ' + options.table);
        if (mainTableAs) {
          subQueryItems.push(' AS ' + mainTableAs);
        }
        subQueryItems.push(subJoinQueries.join(''));

      // Else do it the reguar way
      } else {
        mainQueryItems.push('SELECT ' + topSql + mainAttributes.join(', ') + ' FROM ' + options.table);
        if (mainTableAs) {
          mainQueryItems.push(' AS ' + mainTableAs);
        }
        mainQueryItems.push(mainJoinQueries.join(''));
      }

      // Add WHERE to sub or main query
      if (options.hasOwnProperty('where')) {
        options.where = this.getWhereConditions(options.where, mainTableAs || tableName, model, options);
        if (options.where) {
          if (subQuery) {
            subQueryItems.push(' WHERE ' + options.where);
          } else {
            mainQueryItems.push(' WHERE ' + options.where);
          }
        }
      }

      // Add GROUP BY to sub or main query
      if (options.group) {
        options.group = Array.isArray(options.group) ? options.group.map(function(t) { return this.quote(t, model); }.bind(this)).join(', ') : options.group;
        if (subQuery) {
          subQueryItems.push(' GROUP BY ' + options.group);
        } else {
          mainQueryItems.push(' GROUP BY ' + options.group);
        }
      }

      // Add HAVING to sub or main query
      if (options.hasOwnProperty('having')) {
        options.having = this.getWhereConditions(options.having, tableName, model, options, false);
        if (subQuery) {
          subQueryItems.push(' HAVING ' + options.having);
        } else {
          mainQueryItems.push(' HAVING ' + options.having);
        }
      }
      // Add ORDER to sub or main query
      if (options.order) {
        var mainQueryOrder = [];
        var subQueryOrder = [];

        if (Array.isArray(options.order)) {
          options.order.forEach(function(t) {
            if (subQuery && !(t[0] instanceof Model) && !(t[0].model instanceof Model)) {
              subQueryOrder.push(this.quote(t, model));
            }

            mainQueryOrder.push(this.quote(t, model));
          }.bind(this));
        } else {
          mainQueryOrder.push(options.order);
        }

        if (mainQueryOrder.length) {
          mainQueryItems.push(' ORDER BY ' + mainQueryOrder.join(', '));
        }
        if (subQueryOrder.length) {
          subQueryItems.push(' ORDER BY ' + subQueryOrder.join(', '));
        }
      }

      //var limitOrder = this.addLimitAndOffset(options, query);

      // Add LIMIT, OFFSET to sub or main query
      if (options.offset) {
        //needs an order column for this to work
        //default to id
        var limitOrder = this.getLimitAndOffset(options,query);
        if (subQuery) {
          if(!options.order){
            subQueryItems.push(' ORDER BY ' + SqlGenerator.quoteIdentifier(model.primaryKeyAttribute));
          }
          subQueryItems.push(limitOrder);
        } else {
          if(!options.order){
            mainQueryItems.push(' ORDER BY ' + SqlGenerator.quoteIdentifier(model.primaryKeyAttribute));
          }
          mainQueryItems.push(limitOrder);
        }
      }

      // If using subQuery, select attributes from wrapped subQuery and join out join tables
      if (subQuery) {
        query = 'SELECT ' + mainAttributes.join(', ') + ' FROM (';
        query += subQueryItems.join('');
        query += ') AS ' + options.tableAs;
        query += mainJoinQueries.join('');
        query += mainQueryItems.join('');
      } else {
        query = mainQueryItems.join('');
      }

      if (options.lock && this._dialect.supports.lock) {
        if (options.lock === 'SHARE') {
          query += ' ' + this._dialect.supports.forShare;
        } else {
          query += ' FOR UPDATE';
        }
      }

      query += ';';
      //console.log(query);
      return query;
    },
    /**
     * Returns a query that starts a transaction.
     *
     * @param  {Boolean} value A boolean that states whether autocommit shall be done or not.
     * @return {String}        The generated sql query.
     */
    setAutocommitQuery: function(value) {
      return '';
      //return 'SET autocommit = ' + (!!value ? 1 : 0) + ';';
    },
    /**
     * Returns a query that sets the transaction isolation level.
     *
     * @param  {String} value   The isolation level.
     * @param  {Object} options An object with options.
     * @return {String}         The generated sql query.
     */
    setIsolationLevelQuery: function(value, options) {
      if (options.parent) {
        return;
      }
      return;
      //return 'SET TRANSACTION ISOLATION LEVEL ' + value + ';';
    },
    /**
     * Returns a query that starts a transaction.
     *
     * @param  {Transaction} transaction g
     * @param  {Object} options An object with options.
     * @return {String}         The generated sql query.
     */
    startTransactionQuery: function(transaction, options) {
      if (options.parent) {
        return '';
        //return 'SAVE TRANSACTION ' + SqlGenerator.quoteIdentifier(transaction.name) + ';';
      }
      return 'BEGIN TRANSACTION';
      //return '';
    },
        /**
     * Returns a query that commits a transaction.
     *
     * @param  {Object} options An object with options.
     * @return {String}         The generated sql query.
     */
    commitTransactionQuery: function(options) {
      if (options.parent) {
        return;
      }

      return 'COMMIT TRANSACTION;';
      // return '';
    },

    /**
     * Returns a query that rollbacks a transaction.
     *
     * @param  {Transaction} transaction
     * @param  {Object} options An object with options.
     * @return {String}         The generated sql query.
     */
    rollbackTransactionQuery: function(transaction, options) {
      if (options.parent) {
        return 'ROLLBACK TRANSACTION ' + SqlGenerator.quoteIdentifier(transaction.name) + ';';
      }

      return 'ROLLBACK TRANSACTION;';
      // return '';
    },
    getTop: function(options){
      var query = '';
      if(options.limit && !options.offset){
        query += ' TOP(' + options.limit + ') ';
      }
      return query;
    },
    getLimitAndOffset: function(options, query) {
      query = query || '';

      if(options.limit){
        if(options.offset){
          query += ' OFFSET ' + options.offset + ' ROWS'
            + ' FETCH NEXT ' + options.limit + ' ROWS ONLY';
        }
      }else if(options.offset){
        query += ' OFFSET ' + options.offset + ' ROWS';
      }
      return query;
    },
    /*
      Takes something and transforms it into values of a where condition.
    */
        /*
      Takes something and transforms it into values of a where condition.
    */

        /*
      Takes something and transforms it into values of a where condition.
    */
    getWhereConditions: function(smth, tableName, factory, options, prepend) {
      var result = null
        , where = {}
        , self = this;

      if (Array.isArray(tableName)) {
        tableName = tableName[0];
        if (Array.isArray(tableName)) {
          tableName = tableName[1];
        }
      }


      options = options || {};

      if (typeof prepend === 'undefined') {
        prepend = true;
      }

      if (smth && smth._isSequelizeMethod === true) { // Checking a property is cheaper than a lot of instanceof calls
        result = this.handleSequelizeMethod(smth, tableName, factory, options, prepend);
      } else if (Utils._.isPlainObject(smth)) {
        if (prepend) {
          if (tableName) options.keysEscaped = true;
          smth = this.prependTableNameToHash(tableName, smth);
        }
        result = this.hashToWhereConditions(smth, factory, options);
      } else if (typeof smth === 'number') {
        var primaryKeys = !!factory ? Object.keys(factory.primaryKeys) : [];

        if (primaryKeys.length > 0) {
          // Since we're just a number, assume only the first key
          primaryKeys = primaryKeys[0];
        } else {
          primaryKeys = 'id';
        }

        where[primaryKeys] = smth;

        if (tableName) options.keysEscaped = true;
        smth = this.prependTableNameToHash(tableName, where);
        result = this.hashToWhereConditions(smth);
      } else if (typeof smth === 'string') {
        result = smth;
      } else if (Buffer.isBuffer(smth)) {
        result = SqlGenerator.escape(smth);
      } else if (Array.isArray(smth)) {
        if (Utils.canTreatArrayAsAnd(smth)) {
          var _smth = self.sequelize.and.apply(null, smth);
          result = self.getWhereConditions(_smth, tableName, factory, options, prepend);
        } else {
          result = Utils.format(smth, this.dialect);
        }
      } else if (smth === null) {
        result = "1=1";
      }
      return result ? result : '1=1';
    },

    handleSequelizeMethod: function (smth, tableName, factory, options, prepend) {
      var self = this
        , result;

      if ((smth instanceof Utils.and) || (smth instanceof Utils.or)) {
        var connector = (smth instanceof Utils.and) ? ' AND ' : ' OR ';

        result = smth.args.filter(function(arg) {
          return arg !== undefined;
        }).map(function(arg) {
          return self.getWhereConditions(arg, tableName, factory, options, prepend);
        }).join(connector);

        result = result.length && '(' + result + ')' || undefined;
      } else if (smth instanceof Utils.where) {
        var value = smth.logic
          , key
          , logic
          , _result = []
          , _value;

        if (smth.attribute._isSequelizeMethod) {
          key = this.getWhereConditions(smth.attribute, tableName, factory, options, prepend);
        } else {
          key = SqlGenerator.quoteIdentifier(smth.attribute.Model.name) + '.' + SqlGenerator.quoteIdentifier(smth.attribute.field);
        }

        if (value._isSequelizeMethod) {
          value = this.getWhereConditions(value, tableName, factory, options, prepend);

          result = (value === 'NULL') ? key + ' IS NULL' : [key, value].join(smth.comparator);
        } else if (_.isObject(value)) {
          if (value.join) {
            //using as sentinel for join column => value
            result = [key, value.join].join('=');
          } else {
            for (logic in value) {
              _result.push([key, SqlGenerator.escape(value[logic])].join(' ' + Utils.getWhereLogic(logic, value[logic]) + ' '));
            }

            result = _result.join(' AND ');
          }
        } else {
          if (typeof value === 'boolean') {
            value = this.booleanValue(value);
          } else {
            value = SqlGenerator.escape(value);
          }

          result = (value === 'NULL') ? key + ' IS NULL' : [key, value].join(' ' + smth.comparator + ' ');
        }
      } else if (smth instanceof Utils.literal) {
        result = smth.val;
      } else if (smth instanceof Utils.cast) {
        if (smth.val._isSequelizeMethod) {
          result = this.handleSequelizeMethod(smth.val, tableName, factory, options, prepend);
        } else {
          result = SqlGenerator.escape(smth.val);
        }

        result = 'CAST(' + result + ' AS ' + smth.type.toUpperCase() + ')';
      } else if (smth instanceof Utils.fn) {
        result = smth.fn + '(' + smth.args.map(function(arg) {
          if (arg._isSequelizeMethod) {
            return self.handleSequelizeMethod(arg, tableName, factory, options, prepend);
          } else {
            return SqlGenerator.escape(arg);
          }
        }).join(', ') + ')';
      } else if (smth instanceof Utils.col) {
        if (Array.isArray(smth.col)) {
          if (!factory) {
            throw new Error('Cannot call Sequelize.col() with array outside of order / group clause');
          }
        } else if (smth.col.indexOf('*') === 0) {
          return '*';
        }
        return this.quote(smth.col, factory);
      } else {
        result = smth.toString(this, factory);
      }

      return result;
    },

    prependTableNameToHash: function(tableName, hash) {
      if (tableName) {
        var _hash = {};

        for (var key in hash) {
          if (key.indexOf('.') === -1) {
            if (tableName instanceof Utils.literal) {
              _hash[tableName.val + '.' + SqlGenerator.quoteIdentifier(key)] = hash[key];
            } else {
              _hash[SqlGenerator.quoteIdentifier(tableName) + '.' + SqlGenerator.quoteIdentifier(key)] = hash[key];
            }
          } else {
            _hash[SqlGenerator.quoteIdentifiers(key)] = hash[key];
          }
        }

        return _hash;
      } else {
        return hash;
      }
    },

    findAssociation: function(attribute, dao) {
      throwMethodUndefined('findAssociation');
    },

    getAssociationFilterDAO: function(filterStr, dao) {
      throwMethodUndefined('getAssociationFilterDAO');
    },

    isAssociationFilter: function(filterStr, dao, options) {
      if (!dao) {
        return false;
      }

      var pattern = /^[a-z][a-zA-Z0-9]+(\.[a-z][a-zA-Z0-9]+)+$/;
      if (!pattern.test(filterStr)) return false;

      var associationParts = filterStr.split('.')
        , attributePart = associationParts.pop()
        , self = this;

      return associationParts.every(function(attribute) {
        var association = self.findAssociation(attribute, dao);
        if (!association) return false;
        dao = association.target;
        return !!dao;
      }) && dao.rawAttributes.hasOwnProperty(attributePart);
    },

    getAssociationFilterColumn: function(filterStr, dao, options) {
      throwMethodUndefined('getAssociationFilterColumn');
    },

    getConditionalJoins: function(options, originalDao) {
      throwMethodUndefined('getConditionalJoins');
    },

    arrayValue: function(value, key, _key, factory, logicResult) {
      var _value = null;

      if (value.length === 0) { value = [null]; }
      _value = '(' + value.map(function(v) { return SqlGenerator.escape(v); }.bind(this)).join(',') + ')';
      return [_key, _value].join(' ' + logicResult + ' ');
    },

    /*
      Takes a hash and transforms it into a mysql where condition: {key: value, key2: value2} ==> key=value AND key2=value2
      The values are transformed by the relevant datatype.
    */
    hashToWhereConditions: function(hash, dao, options) {
      var result = [];

      options = options || {};
      // Closures are nice
      Utils._.each(hash, function(value, key) {
        var _key
          , _value = null;

        if (value && value._isSequelizeMethod === true && (value instanceof Utils.literal)) {
          result.push(value.val);
          return;
        }

        if (options.keysEscaped) {
          _key = key;
        } else {
          if (this.isAssociationFilter(key, dao, options)) {
            _key = key = this.getAssociationFilterColumn(key, dao, options);
          } else {
            _key = SqlGenerator.quoteIdentifiers(key);
          }
        }

        if (Array.isArray(value)) {
          result.push(this.arrayValue(value, key, _key, dao, 'IN'));
        } else if ((value) && (typeof value === 'object') && !(value instanceof Date) && !Buffer.isBuffer(value)) {
          if (!!value.join) {
            //using as sentinel for join column => value
            _value = SqlGenerator.quoteIdentifiers(value.join);
            result.push([_key, _value].join('='));
          } else {
            for (var logic in value) {
              var logicResult = Utils.getWhereLogic(logic, hash[key][logic]);
              if (logicResult === 'IN' || logicResult === 'NOT IN') {
                var values = Array.isArray(value[logic]) ? value[logic] : [value[logic]];
                result.push(this.arrayValue(values, key, _key, dao, logicResult));
              }
              else if (logicResult === 'BETWEEN' || logicResult === 'NOT BETWEEN') {
                _value = SqlGenerator.escape(value[logic][0]);
                var _value2 = SqlGenerator.escape(value[logic][1]);

                result.push(' (' + _key + ' ' + logicResult + ' ' + _value + ' AND ' + _value2 + ') ');
              } else {
                _value = SqlGenerator.escape(value[logic]);
                result.push([_key, _value].join(' ' + logicResult + ' '));
              }
            }
          }
        } else {
          _value = SqlGenerator.escape(value);
          result.push((_value === 'NULL') ? _key + ' IS NULL' : [_key, _value].join('='));
        }
      }.bind(this));
      return result.join(' AND ');
    },

    booleanValue: function(value) {
      return value;
    }
  };

  /* istanbul ignore next */
  var throwMethodUndefined = function(methodName) {
    throw new Error('The method "' + methodName + '" is not defined! Please add it to your sql dialect.');
  };

  return QueryGenerator;
})();
