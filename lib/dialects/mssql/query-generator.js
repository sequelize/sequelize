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
      return SqlGenerator.insertSql(table,valueHash,modelAttributes, options);
    },

    /*
      Returns an insert into command for multiple values.
      Parameters: table name + list of hashes of attribute-value-pairs.
    */
    /* istanbul ignore next */
    bulkInsertQuery: function(tableName, attrValueHashes) {
      throwMethodUndefined('bulkInsertQuery');
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
      throwMethodUndefined('updateQuery');
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
      throwMethodUndefined('deleteQuery');
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
      throwMethodUndefined('quoteIdentifiers');
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
        options.tableAs = mainTableAs = this.quoteTable(model.name);
      }
      options.table = table = !Array.isArray(tableName) ? this.quoteTable(tableName) : tableName.map(function(t) {
        if (Array.isArray(t)) {
          return this.quoteTable(t[0], t[1]);
        }
        return this.quoteTable(t, true);
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
          return attr.toString(self);
        }

        if (Array.isArray(attr) && attr.length === 2) {
          if (attr[0]._isSequelizeMethod) {
            attr[0] = attr[0].toString(self);
            addTable = false;
          } else {
            if (attr[0].indexOf('(') === -1 && attr[0].indexOf(')') === -1) {
              attr[0] = self.quoteIdentifier(attr[0]);
            }
          }
          attr = [attr[0], self.quoteIdentifier(attr[1])].join(' AS ');
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
                  return $attr._isSequelizeMethod ? $attr.toString(self) : $attr;
                });

                attrAs = attr[1];
                attr = attr[0];
              } else if (attr instanceof Utils.literal) {
                return attr.toString(self); // We trust the user to rename the field correctly
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
                prefix = self.quoteIdentifier(as) + '.' + self.quoteIdentifier(attr);
              }
              return prefix + ' AS ' + self.quoteIdentifier(as + '.' + attrAs);
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
                return self.quoteIdentifier(throughAs) + '.' + self.quoteIdentifier(attr) + ' AS ' + self.quoteIdentifier(throughAs + '.' + attr);
              })
              , primaryKeysSource = association.source.primaryKeyAttributes
              , tableSource = parentTable
              , identSource = association.identifier
              , attrSource = primaryKeysSource[0]
              , where

              , primaryKeysTarget = association.target.primaryKeyAttributes
              , tableTarget = as
              , identTarget = association.foreignIdentifier
              , attrTarget = primaryKeysTarget[0]

              , sourceJoinOn
              , targetJoinOn
              , targetWhere;

            if (options.includeIgnoreAttributes !== false) {
              // Through includes are always hasMany, so we need to add the attributes to the mainAttributes no matter what (Real join will never be executed in subquery)
              mainAttributes = mainAttributes.concat(throughAttributes);
            }

            // Filter statement for left side of through
            // Used by both join and subquery where
            sourceJoinOn = self.quoteTable(tableSource) + '.' + self.quoteIdentifier(attrSource) + ' = ';
            sourceJoinOn += self.quoteIdentifier(throughAs) + '.' + self.quoteIdentifier(identSource);

            // Filter statement for right side of through
            // Used by both join and subquery where
            targetJoinOn = self.quoteIdentifier(tableTarget) + '.' + self.quoteIdentifier(attrTarget) + ' = ';
            targetJoinOn += self.quoteIdentifier(throughAs) + '.' + self.quoteIdentifier(identTarget);

            if (self._dialect.supports.joinTableDependent) {
              // Generate a wrapped join so that the through table join can be dependent on the target join
              joinQueryItem += joinType + '(';
              joinQueryItem += self.quoteTable(throughTable, throughAs);
              joinQueryItem += joinType + self.quoteTable(table, as) + ' ON ';
              joinQueryItem += targetJoinOn;
              joinQueryItem += ') ON '+sourceJoinOn;
            } else {
              // Generate join SQL for left side of through
              joinQueryItem += joinType + self.quoteTable(throughTable, throughAs)  + ' ON ';
              joinQueryItem += sourceJoinOn;

              // Generate join SQL for right side of through
              joinQueryItem += joinType + self.quoteTable(table, as) + ' ON ';
              joinQueryItem += targetJoinOn;
            }

            if (include.where) {
              targetWhere = self.getWhereConditions(include.where, self.sequelize.literal(self.quoteIdentifier(as)), include.model, whereOptions);
              joinQueryItem += ' AND ' + targetWhere;
              if (subQuery && include.required) {
                if (!options.where) options.where = {};

                // Creating the as-is where for the subQuery, checks that the required association exists
                options.where['__' + throughAs] = self.sequelize.asIs(['(',

                  'SELECT ' + self.quoteIdentifier(throughAs) + '.' + self.quoteIdentifier(identSource) + ' FROM ' + self.quoteTable(throughTable, throughAs),
                  ! include.required && joinType + self.quoteTable(association.source.tableName, tableSource) + ' ON ' + sourceJoinOn || '',
                  joinType + self.quoteTable(table, as) + ' ON ' + targetJoinOn,
                  'WHERE ' + (! include.required && targetWhere || sourceJoinOn + ' AND ' + targetWhere),
                  'LIMIT 1',

                ')', 'IS NOT NULL'].join(' '));
              }
            }
          } else {
            var left = association.associationType === 'BelongsTo' ? association.target : association.source
              , primaryKeysLeft = left.primaryKeyAttributes
              , tableLeft = association.associationType === 'BelongsTo' ? as : parentTable
              , attrLeft = primaryKeysLeft[0]
              , tableRight = association.associationType === 'BelongsTo' ? parentTable : as
              , attrRight = association.identifier
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
                (subQuery && !include.subQuery && include.parent.subQuery && !(include.hasParentRequired && include.hasParentWhere)) && self.quoteIdentifier(tableLeft + '.' + attrLeft) ||
                self.quoteTable(tableLeft) + '.' + self.quoteIdentifier(attrLeft)
              )

              + ' = ' +

              // Right side
              (
                (subQuery && !include.subQuery && include.parent.subQuery && (include.hasParentRequired && include.hasParentWhere)) && self.quoteIdentifier(tableRight + '.' + attrRight) ||
                self.quoteTable(tableRight) + '.' + self.quoteIdentifier(attrRight)
              );

            if (include.where) {
              joinOn += ' AND ' + self.getWhereConditions(include.where, self.sequelize.literal(self.quoteIdentifier(as)), include.model, whereOptions);

              // If its a multi association we need to add a where query to the main where (executed in the subquery)
              if (subQuery && association.isMultiAssociation && include.required) {
                if (!options.where) options.where = {};

                // Creating the as-is where for the subQuery, checks that the required association exists
                options.where['__' + as] = self.sequelize.asIs(['(',

                  'SELECT ' + self.quoteIdentifier(attrRight),
                  'FROM ' + self.quoteTable(table, as),
                  'WHERE ' + joinOn,
                  'LIMIT 1',

                ')', 'IS NOT NULL'].join(' '));
              }
            }

            // Generate join SQL
            joinQueryItem += joinType + self.quoteTable(table, as) + ' ON ' + joinOn;

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
        subQueryItems.push('SELECT ' + subQueryAttributes.join(', ') + ' FROM ' + options.table);
        if (mainTableAs) {
          subQueryItems.push(' AS ' + mainTableAs);
        }
        subQueryItems.push(subJoinQueries.join(''));

      // Else do it the reguar way
      } else {
        mainQueryItems.push('SELECT ' + mainAttributes.join(', ') + ' FROM ' + options.table);
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

      var limitOrder = this.addLimitAndOffset(options, query);

      // Add LIMIT, OFFSET to sub or main query
      if (limitOrder) {
        if (subQuery) {
          subQueryItems.push(limitOrder);
        } else {
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
      return '';
      //return 'SET SESSION TRANSACTION ISOLATION LEVEL ' + value + ';';
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
        return 'SAVEPOINT ' + this.quoteIdentifier(transaction.name) + ';';
      }
      return '';
      //return 'BEGIN TRY\nBEGIN TRANSACTION';
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

      return 'COMMIT;';
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
        return 'ROLLBACK TO SAVEPOINT ' + this.quoteIdentifier(transaction.name) + ';';
      }

      return 'ROLLBACK;';
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
    getWhereConditions: function(smth, tableName, factory, options, prepend) {      
      throwMethodUndefined('getWhereConditions');
    },

    prependTableNameToHash: function(tableName, hash) {
      throwMethodUndefined('prependTableNameToHash');
    },

    findAssociation: function(attribute, dao) {
      throwMethodUndefined('findAssociation');
    },

    getAssociationFilterDAO: function(filterStr, dao) {
      throwMethodUndefined('getAssociationFilterDAO');
    },

    isAssociationFilter: function(filterStr, dao, options) {
      throwMethodUndefined('isAssociationFilter');
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
      throwMethodUndefined('hashToWhereConditions');
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
