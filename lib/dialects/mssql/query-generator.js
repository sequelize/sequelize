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
          return self.quoteTable(this);
        }
      };
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
      return SqlGenerator.getCreateTableSql(tableName, attributes, options);
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
    bulkInsertQuery: function(tableName, attrValueHashes,options) {
      var allAttributes = [],
        ignoreKeys = options.fields;
      Utils._.forEach(attrValueHashes, function(attrValueHash, i) {
        Utils._.forOwn(attrValueHash, function(value, key, hash) {
          if (allAttributes.indexOf(key) === -1) allAttributes.push(key);
          if (value !== null && ignoreKeys.indexOf(key) > 0)
            ignoreKeys.splice(ignoreKeys.indexOf(key),1);
        });
      });
      for(var i = 0; i < ignoreKeys.length; i++){
        allAttributes.splice(allAttributes.indexOf(ignoreKeys[i]), 1);
      }
      return SqlGenerator.bulkInsertSql(tableName, allAttributes, attrValueHashes,options);
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
      // if(where){
      //   throw new Error();
      // }
      //console.log('here', where);
      var query = [
        SqlGenerator.updateSql(tableName, attrValueHash, attributes),
        'WHERE',
        this.getWhereConditions(where)
      ].join(' ') + ';';
      console.log(query);
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
          console.log('where:', where);

      var query = SqlGenerator.deleteSql(tableName, where);

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
    incrementQuery: function(tableName, attrValueHash, where, options) {
      throwMethodUndefined('incrementQuery');
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

      for (key in attributes) {
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
      throwMethodUndefined('quoteTable');
    },

    quote: function(obj, parent, force) {
      throwMethodUndefined('quote');
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
      throwMethodUndefined('quoteIdentifier');
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

      throwMethodUndefined('escape');
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
      //console.log('tablename', tableName);
      //console.log('options', options);
      //console.log('model', model.name);
      //console.log(options.where);
      options = options || {};
      var query = [
        SqlGenerator.getSelectorClause(model,options),
        SqlGenerator.getFromClause(model.tableName, model.name)
      ];

      if(options.include){
        for(var i = 0; i < options.include.length; i ++){
          query.push(SqlGenerator.getJoinClause(model, options.include[i]));
        }
      }
      if(options.hasOwnProperty('where')){
        query.push('WHERE');
        query.push(this.getWhereConditions(options.where, model.name, model, options));
      }
      //console.log(query.join(' ') + ';');
      return query.join(' ') + ';';
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

      return 'SET TRANSACTION ISOLATION LEVEL ' + value + ';';
    },
    /**
     * Returns a query that starts a transaction.
     *
     * @param  {Transaction} transaction
     * @param  {Object} options An object with options.
     * @return {String}         The generated sql query.
     */
    startTransactionQuery: function(transaction, options) {
      if (options.parent) {
        return '';
        //return 'SAVE TRANSACTION ' + SqlGenerator.quoteIdentifier(transaction.name) + ';';
      }

      return 'BEGIN TRANSACTION';
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
        return 'ROLLBACK TRANSACTION ' + this.quoteIdentifier(transaction.name) + ';';
      }

      return 'ROLLBACK TRANSACTION';
    },

    addLimitAndOffset: function(options, query) {
      query = query || '';

      if (options.offset && !options.limit) {
        query += ' LIMIT ' + options.offset + ', ' + 10000000000000;
      } else if (options.limit) {
        if (options.offset) {
          query += ' LIMIT ' + options.offset + ', ' + options.limit;
        } else {
          query += ' LIMIT ' + options.limit;
        }
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
        result = this.escape(smth);
      } else if (Array.isArray(smth)) {
        if (Utils.canTreatArrayAsAnd(smth)) {
          var _smth = self.sequelize.and.apply(null, smth);
          result = self.getWhereConditions(_smth, tableName, factory, options, prepend);
        } else {
          result = Utils.format(smth, this.dialect);
        }
      } else if (smth === null) {
        result = '1=1';
      }

      return result ? result : '1=1';
    },
    // getWhereConditions: function(where, tableName, model, options, prepend) {
    //   //console.log('where:', model);

    //   console.log('logic', where);
    //   //console.log('options', options);

    //   if(where){
    //     return SqlGenerator.getWhereClause(where, tableName);
    //   }else{
    //     return '';
    //   }
    // },

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
          key = this.quoteTable(smth.attribute.Model.name) + '.' + this.quoteIdentifier(smth.attribute.fieldName);
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
              _result.push([key, this.escape(value[logic])].join(' ' + Utils.getWhereLogic(logic, value[logic]) + ' '));
            }

            result = _result.join(' AND ');
          }
        } else {
          if (typeof value === 'boolean') {
            value = this.booleanValue(value);
          } else {
            value = this.escape(value);
          }

          result = (value === 'NULL') ? key + ' IS NULL' : [key, value].join(' ' + smth.comparator + ' ');
        }
      } else if (smth instanceof Utils.literal) {
        result = smth.val;
      } else if (smth instanceof Utils.cast) {
        if (smth.val._isSequelizeMethod) {
          result = this.handleSequelizeMethod(smth.val, tableName, factory, options, prepend);
        } else {
          result = this.escape(smth.val);
        }

        result = 'CAST(' + result + ' AS ' + smth.type.toUpperCase() + ')';
      } else if (smth instanceof Utils.fn) {
        result = smth.fn + '(' + smth.args.map(function(arg) {
          if (arg._isSequelizeMethod) {
            return self.handleSequelizeMethod(arg, tableName, factory, options, prepend);
          } else {
            return self.escape(arg);
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
            _hash[this.quoteIdentifiers(key)] = hash[key];
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
      throwMethodUndefined('arrayValue');
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
            _key = this.quoteIdentifiers(key);
          }
        }

        if (Array.isArray(value)) {
          result.push(this.arrayValue(value, key, _key, dao, 'IN'));
        } else if ((value) && (typeof value === 'object') && !(value instanceof Date) && !Buffer.isBuffer(value)) {
          if (!!value.join) {
            //using as sentinel for join column => value
            _value = this.quoteIdentifiers(value.join);
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
          if (typeof value === 'boolean') {
            _value = this.booleanValue(value);
          } else {
            _value = SqlGenerator.escape(value);
          }

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
