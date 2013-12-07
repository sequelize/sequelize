var Utils = require("../../utils")
  , SqlString = require("../../sql-string")

module.exports = (function() {
  var QueryGenerator = {
    addSchema: function(opts) {
      throwMethodUndefined('addSchema')
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
    createTableQuery: function(tableName, attributes, options) {
      throwMethodUndefined('createTableQuery')
    },

    /*
      Returns a query for dropping a table.
    */
    dropTableQuery: function(tableName, options) {
      throwMethodUndefined('dropTableQuery')
    },

    /*
      Returns a rename table query.
      Parameters:
        - originalTableName: Name of the table before execution.
        - futureTableName: Name of the table after execution.
    */
    renameTableQuery: function(originalTableName, futureTableName) {
      throwMethodUndefined('renameTableQuery')
    },

    /*
      Returns a query, which gets all available table names in the database.
    */
    showTablesQuery: function() {
      throwMethodUndefined('showTablesQuery')
    },

    /*
      Returns a query, which adds an attribute to an existing table.
      Parameters:
        - tableName: Name of the existing table.
        - attributes: A hash with attribute-attributeOptions-pairs.
          - key: attributeName
          - value: A hash with attribute specific options:
            - type: DataType
            - defaultValue: A String with the default value
            - allowNull: Boolean
    */
    addColumnQuery: function(tableName, attributes) {
      throwMethodUndefined('addColumnQuery')
    },

    /*
      Returns a query, which removes an attribute from an existing table.
      Parameters:
        - tableName: Name of the existing table
        - attributeName: Name of the obsolete attribute.
    */
    removeColumnQuery: function(tableName, attributeName) {
      throwMethodUndefined('removeColumnQuery')
    },

    /*
      Returns a query, which modifies an existing attribute from a table.
      Parameters:
        - tableName: Name of the existing table.
        - attributes: A hash with attribute-attributeOptions-pairs.
          - key: attributeName
          - value: A hash with attribute specific options:
            - type: DataType
            - defaultValue: A String with the default value
            - allowNull: Boolean
    */
    changeColumnQuery: function(tableName, attributes) {
      throwMethodUndefined('changeColumnQuery')
    },

    /*
      Returns a query, which renames an existing attribute.
      Parameters:
        - tableName: Name of an existing table.
        - attrNameBefore: The name of the attribute, which shall be renamed.
        - attrNameAfter: The name of the attribute, after renaming.
    */
    renameColumnQuery: function(tableName, attrNameBefore, attrNameAfter) {
      throwMethodUndefined('renameColumnQuery')
    },

    /*
      Returns an insert into command. Parameters: table name + hash of attribute-value-pairs.
    */
    insertQuery: function(tableName, attrValueHash) {
      throwMethodUndefined('insertQuery')
    },

    /*
      Returns an insert into command for multiple values.
      Parameters: table name + list of hashes of attribute-value-pairs.
    */
    bulkInsertQuery: function(tableName, attrValueHashes) {
      throwMethodUndefined('bulkInsertQuery')
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
    updateQuery: function(tableName, values, where) {
      throwMethodUndefined('updateQuery')
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
    deleteQuery: function(tableName, where, options) {
      throwMethodUndefined('deleteQuery')
    },

    /*
      Returns a bulk deletion query.
      Parameters:
        - tableName -> Name of the table
        - where -> A hash with conditions (e.g. {name: 'foo'})
                   OR an ID as integer
                   OR a string with conditions (e.g. 'name="foo"').
                   If you use a string, you have to escape it on your own.
    */
    bulkDeleteQuery: function(tableName, where, options) {
      throwMethodUndefined('bulkDeleteQuery')
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
    incrementQuery: function(tableName, values, where) {
      throwMethodUndefined('incrementQuery')
    },

    /*
      Returns an add index query.
      Parameters:
        - tableName -> Name of an existing table.
        - attributes:
            An array of attributes as string or as hash.
            If the attribute is a hash, it must have the following content:
              - attribute: The name of the attribute/column
              - length: An integer. Optional
              - order: 'ASC' or 'DESC'. Optional
        - options:
          - indicesType: UNIQUE|FULLTEXT|SPATIAL
          - indexName: The name of the index. Default is <tableName>_<attrName1>_<attrName2>
          - parser
    */
    addIndexQuery: function(tableName, attributes, options) {
      throwMethodUndefined('addIndexQuery')
    },

    /*
      Returns an show index query.
      Parameters:
        - tableName: Name of an existing table.
        - options:
          - database: Name of the database.
    */
    showIndexQuery: function(tableName, options) {
      throwMethodUndefined('showIndexQuery')
    },

    /*
      Returns a remove index query.
      Parameters:
        - tableName: Name of an existing table.
        - indexNameOrAttributes: The name of the index as string or an array of attribute names.
    */
    removeIndexQuery: function(tableName, indexNameOrAttributes) {
      throwMethodUndefined('removeIndexQuery')
    },

    /*
      This method transforms an array of attribute hashes into equivalent
      sql attribute definition.
    */
    attributesToSQL: function(attributes) {
      throwMethodUndefined('attributesToSQL')
    },

    /*
      Returns all auto increment fields of a factory.
    */
    findAutoIncrementField: function(factory) {
      throwMethodUndefined('findAutoIncrementField')
    },

    /*
      Quote an object based on its type. This is a more general version of quoteIdentifiers
      Strings: should proxy to quoteIdentifiers
      Arrays: First argument should be qouted, second argument should be append without quoting
      Objects:
        * If raw is set, that value should be returned verbatim, without quoting
        * If fn is set, the string should start with the value of fn, starting paren, followed by
          the values of cols (which is assumed to be an array), quoted and joined with ', ',
          unless they are themselves objects
        * If direction is set, should be prepended

      Currently this function is only used for ordering / grouping columns, but it could
      potentially also be used for other places where we want to be able to call SQL functions (e.g. as default values)
    */
    quote: function(obj, force) {
      if (Utils._.isString(obj)) {
        return this.quoteIdentifiers(obj, force)
      } else if (Array.isArray(obj)) {
        return this.quote(obj[0], force) + ' ' + obj[1]
      } else if (obj instanceof Utils.fn || obj instanceof Utils.col || obj instanceof Utils.literal || obj instanceof Utils.cast) {
        return obj.toString(this)
      } else if (Utils._.isObject(obj) && 'raw' in obj) {
        return obj.raw
      } else {
        throw new Error('Unknown structure passed to order / group: ' + JSON.stringify(obj))
      }
    },

    /*
     Create a trigger
     */
    createTrigger: function(tableName, triggerName, timingType, fireOnArray, functionName, functionParams,
        optionsArray) {
      throwMethodUndefined('createTrigger')
    },

    /*
     Drop a trigger
     */
    dropTrigger: function(tableName, triggerName) {
      throwMethodUndefined('dropTrigger')
    },

    /*
     Rename a trigger
     */
    renameTrigger: function(tableName, oldTriggerName, newTriggerName) {
      throwMethodUndefined('renameTrigger')
    },

    /*
     Create a function
     */
    createFunction: function(functionName, params, returnType, language, body, options) {
      throwMethodUndefined('createFunction')
    },

    /*
     Drop a function
     */
    dropFunction: function(functionName, params) {
      throwMethodUndefined('dropFunction')
    },

    /*
     Rename a function
     */
    renameFunction: function(oldFunctionName, params, newFunctionName) {
      throwMethodUndefined('renameFunction')
    },

    /*
      Escape an identifier (e.g. a table or attribute name)
    */
    quoteIdentifier: function(identifier, force) {
      throwMethodUndefined('quoteIdentifier')
    },

    /*
      Split an identifier into .-separated tokens and quote each part
    */
    quoteIdentifiers: function(identifiers, force) {
      throwMethodUndefined('quoteIdentifiers')
    },

    /*
      Escape a value (e.g. a string, number or date)
    */
    escape: function(value, field) {
      if (value instanceof Utils.fn || value instanceof Utils.col || value instanceof Utils.literal || value instanceof Utils.cast) {
        return value.toString(this)
      } else {
        return SqlString.escape(value, false, null, this.dialect, field)
      }
    },

    /**
     * Generates an SQL query that returns all foreign keys of a table.
     *
     * @param  {String} tableName  The name of the table.
     * @param  {String} schemaName The name of the schema.
     * @return {String}            The generated sql query.
     */
    getForeignKeysQuery: function(tableName, schemaName) {
      throwMethodUndefined('getForeignKeysQuery')
    },

    /**
     * Generates an SQL query that removes a foreign key from a table.
     *
     * @param  {String} tableName  The name of the table.
     * @param  {String} foreignKey The name of the foreign key constraint.
     * @return {String}            The generated sql query.
     */
    dropForeignKeyQuery: function(tableName, foreignKey) {
      throwMethodUndefined('dropForeignKeyQuery')
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
    selectQuery: function(tableName, options, factory) {
      var table = null,
          joinQuery = ""

      options            = options || {}
      options.table      = table = Array.isArray(tableName) ? tableName.map(function(t) { return this.quoteIdentifiers(t) }.bind(this)).join(", ") : this.quoteIdentifiers(tableName)
      options.attributes = options.attributes && options.attributes.map(function(attr){
        if(Array.isArray(attr) && attr.length == 2) {
          return [attr[0], this.quoteIdentifier(attr[1])].join(' as ')
        } else {
          return attr.indexOf(Utils.TICK_CHAR) < 0 && attr.indexOf('"') < 0 ? this.quoteIdentifiers(attr) : attr
        }
      }.bind(this)).join(", ")
      options.attributes = options.attributes || '*'

      if (options.include) {
        var optAttributes = options.attributes === '*' ? [options.table + '.*'] : [options.attributes]

        options.include.forEach(function(include) {
          var attributes = include.attributes.map(function(attr) {
            return this.quoteIdentifier(include.as) + "." + this.quoteIdentifier(attr) + " AS " + this.quoteIdentifier(include.as + "." + attr)
          }.bind(this))

          optAttributes = optAttributes.concat(attributes)

          var table = include.daoFactory.tableName
            , as    = include.as

          if (!include.association.connectorDAO) {
            var primaryKeysLeft = ((include.association.associationType === 'BelongsTo') ? Object.keys(include.association.target.primaryKeys) : Object.keys(include.association.source.primaryKeys))
              , tableLeft       = ((include.association.associationType === 'BelongsTo') ? include.as : tableName)
              , attrLeft        = ((primaryKeysLeft.length !== 1) ? 'id' : primaryKeysLeft[0])
              , tableRight      = ((include.association.associationType === 'BelongsTo') ? tableName : include.as)
              , attrRight       = include.association.identifier

            joinQuery += " LEFT OUTER JOIN " + this.quoteIdentifier(table) + " AS " + this.quoteIdentifier(as) + " ON " + this.quoteIdentifier(tableLeft) + "." + this.quoteIdentifier(attrLeft) + " = " + this.quoteIdentifier(tableRight) + "." + this.quoteIdentifier(attrRight)
          } else {
            var primaryKeysSource = Object.keys(include.association.source.primaryKeys)
              , tableSource       = tableName
              , identSource       = include.association.identifier
              , attrSource        = ((!include.association.source.hasPrimaryKeys || primaryKeysSource.length !== 1) ? 'id' : primaryKeysSource[0])

            var primaryKeysTarget = Object.keys(include.association.target.primaryKeys)
              , tableTarget       = include.as
              , identTarget       = include.association.foreignIdentifier
              , attrTarget        = ((!include.association.target.hasPrimaryKeys || primaryKeysTarget.length !== 1) ? 'id' : primaryKeysTarget[0])

            var tableJunction     = include.association.connectorDAO.tableName
            joinQuery += " LEFT OUTER JOIN " + this.quoteIdentifier(tableJunction) + " ON " + this.quoteIdentifier(tableSource) + "." + this.quoteIdentifier(attrSource) + " = " + this.quoteIdentifier(tableJunction) + "." + this.quoteIdentifier(identSource)
            joinQuery += " LEFT OUTER JOIN " + this.quoteIdentifier(table) + " AS " + this.quoteIdentifier(as) + " ON " + this.quoteIdentifier(tableTarget) + "." + this.quoteIdentifier(attrTarget) + " = " + this.quoteIdentifier(tableJunction) + "." + this.quoteIdentifier(identTarget)
          }
        }.bind(this))

        options.attributes = optAttributes.join(', ')
      }

      var conditionalJoins = this.getConditionalJoins(options, factory),
        query;

      if (conditionalJoins) {
        query = "SELECT " + options.attributes + " FROM ( "
          + "SELECT " + options.table + ".* FROM " + options.table + this.getConditionalJoins(options, factory)
      } else {
        query = "SELECT " + options.attributes + " FROM " + options.table
        query += joinQuery
      }

      if (options.hasOwnProperty('where')) {
        options.where = this.getWhereConditions(options.where, tableName, factory)
        query += " WHERE " + options.where
      }

      if (options.group) {
        options.group = Array.isArray(options.group) ? options.group.map(function (t) { return this.quote(t) }.bind(this)).join(', ') : options.group
        query += " GROUP BY " + options.group
      }

      if (options.order) {
        options.order = Array.isArray(options.order) ? options.order.map(function (t) { return this.quote(t) }.bind(this)).join(', ') : options.order
        query += " ORDER BY " + options.order
      }

      query = this.addLimitAndOffset(options, query)

      if (conditionalJoins) {
        query += ") AS " + options.table
        query += joinQuery
      }

      query += ";"

      return query
    },

    /**
     * Returns a query that starts a transaction.
     *
     * @param  {Boolean} value A boolean that states whether autocommit shall be done or not.
     * @return {String}        The generated sql query.
     */
    setAutocommitQuery: function(value) {
      throwMethodUndefined('setAutocommitQuery')
    },

    setIsolationLevelQuery: function(value) {
      throwMethodUndefined('setIsolationLevelQuery')
    },

    /**
     * Returns a query that starts a transaction.
     *
     * @param  {Object} options An object with options.
     * @return {String}         The generated sql query.
     */
    startTransactionQuery: function(options) {
      throwMethodUndefined('startTransactionQuery')
    },

    /**
     * Returns a query that commits a transaction.
     *
     * @param  {Object} options An object with options.
     * @return {String}         The generated sql query.
     */
    commitTransactionQuery: function(options) {
      throwMethodUndefined('commitTransactionQuery')
    },

    /**
     * Returns a query that rollbacks a transaction.
     *
     * @param  {Object} options An object with options.
     * @return {String}         The generated sql query.
     */
    rollbackTransactionQuery: function(options) {
      throwMethodUndefined('rollbackTransactionQuery')
    },

    addLimitAndOffset: function(options, query){
      if (options.offset && !options.limit) {
        query += " LIMIT " + options.offset + ", " + 10000000000000;
      } else if (options.limit && !(options.include && (options.limit === 1))) {
        if (options.offset) {
          query += " LIMIT " + options.offset + ", " + options.limit
        } else {
          query += " LIMIT " + options.limit
        }
      }
      return query;
    },

    /*
      Takes something and transforms it into values of a where condition.
    */
    getWhereConditions: function(smth, tableName, factory) {
      var result = null
        , where = {}

      if (Utils.isHash(smth)) {
        smth   = Utils.prependTableNameToHash(tableName, smth)
        result = this.hashToWhereConditions(smth, factory)
      } else if (typeof smth === 'number') {
        var primaryKeys = !!factory ? Object.keys(factory.primaryKeys) : []
        if (primaryKeys.length > 0) {
          // Since we're just a number, assume only the first key
          primaryKeys = primaryKeys[0]
        } else {
          primaryKeys = 'id'
        }

        where[primaryKeys] = smth
        smth   = Utils.prependTableNameToHash(tableName, where)
        result = this.hashToWhereConditions(smth)
      } else if (typeof smth === "string") {
        result = smth
      } else if (Array.isArray(smth)) {
        result = Utils.format(smth, this.dialect)
      }

      return result ? result : '1=1'
    },

    findAssociation: function(attribute, dao){
      var associationToReturn;

      Object.keys(dao.associations).forEach(function(key){
        if(!dao.associations[key]) return;


        var association = dao.associations[key]
          , associationName

        if (association.associationType === 'BelongsTo') {
          associationName = Utils.singularize(association.associationAccessor[0].toLowerCase() + association.associationAccessor.slice(1));
        } else {
          associationName = association.accessors.get.replace('get', '')
          associationName = associationName[0].toLowerCase() + associationName.slice(1);
        }

        if(associationName === attribute){
          associationToReturn = association;
        }
      });

      return associationToReturn;
    },

    getAssociationFilterDAO: function(filterStr, dao){
      var associationParts = filterStr.split('.')
        , self = this

      associationParts.pop()

      associationParts.forEach(function (attribute) {
        dao = self.findAssociation(attribute, dao).target;
      });

      return dao;
    },

    isAssociationFilter: function(filterStr, dao){
      if(!dao){
        return false;
      }

      var pattern = /^[a-z][a-zA-Z0-9]+(\.[a-z][a-zA-Z0-9]+)+$/;
      if (!pattern.test(filterStr)) return false;

      var associationParts = filterStr.split('.')
        , attributePart = associationParts.pop()
        , self = this


      return associationParts.every(function (attribute) {
        var association = self.findAssociation(attribute, dao);
        if (!association) return false;
        dao = association.target;
        return !!dao;
      }) && dao.rawAttributes.hasOwnProperty(attributePart);
    },

    getAssociationFilterColumn: function(filterStr, dao){
      var associationParts = filterStr.split('.')
        , attributePart = associationParts.pop()
        , self = this

      associationParts.forEach(function (attribute) {
        dao = self.findAssociation(attribute, dao).target;
      })

      return dao.tableName + '.' +  attributePart;
    },

    getConditionalJoins: function(options, originalDao){
      var joins = ''
        , self = this
        , joinedTables = {}

      if (Utils.isHash(options.where)) {
        Object.keys(options.where).forEach(function(filterStr){
          var associationParts = filterStr.split('.')
            , attributePart = associationParts.pop()
            , dao = originalDao

          if (self.isAssociationFilter(filterStr, dao)) {
            associationParts.forEach(function (attribute) {
              var association = self.findAssociation(attribute, dao);

              if(!joinedTables[association.target.tableName]){
                joinedTables[association.target.tableName] = true;

                if(association.associationType === 'BelongsTo'){
                  joins += ' LEFT JOIN ' + self.quoteIdentifiers(association.target.tableName)
                  joins += ' ON ' + self.quoteIdentifiers(association.source.tableName + '.' + association.identifier)
                  joins += ' = ' + self.quoteIdentifiers(association.target.tableName + '.' + association.target.autoIncrementField)
                } else if (association.connectorDAO){
                  joinedTables[association.connectorDAO.tableName] = true;
                  joins += ' LEFT JOIN ' + self.quoteIdentifiers(association.connectorDAO.tableName)
                  joins += ' ON ' + self.quoteIdentifiers(association.source.tableName + '.' + association.source.autoIncrementField)
                  joins += ' = ' + self.quoteIdentifiers(association.connectorDAO.tableName + '.' + association.identifier)

                  joins += ' LEFT JOIN ' + self.quoteIdentifiers(association.target.tableName)
                  joins += ' ON ' + self.quoteIdentifiers(association.connectorDAO.tableName + '.' + association.foreignIdentifier)
                  joins += ' = ' + self.quoteIdentifiers(association.target.tableName + '.' + association.target.autoIncrementField)
                } else {
                  joins += ' LEFT JOIN ' + self.quoteIdentifiers(association.target.tableName)
                  joins += ' ON ' + self.quoteIdentifiers(association.source.tableName + '.' + association.source.autoIncrementField)
                  joins += ' = ' + self.quoteIdentifiers(association.target.tableName + '.' + association.identifier)
                }
              }
              dao = association.target;
            });
          }
        });
      }

      return joins;
    },

    arrayValue: function(value, key, _key){
        var _value = null;

        if (value.length === 0) { value = [null] }
        _value = "(" + value.map(function(v) { return this.escape(v) }.bind(this)).join(',') + ")"
        return [_key, _value].join(" IN ")
    },

    /*
      Takes a hash and transforms it into a mysql where condition: {key: value, key2: value2} ==> key=value AND key2=value2
      The values are transformed by the relevant datatype.
    */
    hashToWhereConditions: function(hash, dao) {
      var result = []

      for (var key in hash) {
        var value = hash[key]

        if(this.isAssociationFilter(key, dao)){
          key = this.getAssociationFilterColumn(key, dao);
        }

         //handle qualified key names
        var _key   = this.quoteIdentifiers(key)
          , _value = null

        if (Array.isArray(value)) {
          result.push(this.arrayValue(value, key, _key, dao))
        } else if ((value) && (typeof value == 'object') && !(value instanceof Date)) {
          if (!!value.join) {
            //using as sentinel for join column => value
            _value = this.quoteIdentifiers(value.join)
            result.push([_key, _value].join("="))
          } else {
            for (var logic in value) {
              var logicResult = Utils.getWhereLogic(logic, hash[key][logic]);
              if (logic === "IN" || logic === "NOT IN") {
                var values = Array.isArray(where[i][ii]) ? where[i][ii] : [where[i][ii]]
                _where[_where.length] = i + ' ' + logic + ' (' + values.map(function(){ return '?' }).join(',') + ')'
                _whereArgs = _whereArgs.concat(values)
              }
              else if (logicResult === "BETWEEN" || logicResult === "NOT BETWEEN") {
                _value = this.escape(value[logic][0])
                var _value2 = this.escape(value[logic][1])

                result.push(' (' + _key + ' ' + logicResult + ' ' + _value + ' AND ' + _value2 + ') ')
              } else {
                _value = this.escape(value[logic])
                result.push([_key, _value].join(' ' + logicResult + ' '))
              }
            }
          }
        } else {
          if (typeof value === 'boolean') {
            _value = this.booleanValue(value);
          } else {
            _value = this.escape(value)
          }
          result.push((_value == 'NULL') ? _key + " IS NULL" : [_key, _value].join("="))
        }
      }

      return result.join(" AND ")
    },

    booleanValue: function(value){
      return value;
    }
  }

  var throwMethodUndefined = function(methodName) {
    throw new Error('The method "' + methodName + '" is not defined! Please add it to your sql dialect.')
  }

  return QueryGenerator
})()

