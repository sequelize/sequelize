var Utils       = require("../../utils")
  , util        = require("util")
  , DataTypes   = require("../../data-types")
  , SqlString   = require('../../sql-string')
  , Transaction = require("../../transaction")
  , tables      = {}
  , primaryKeys = {}


module.exports = (function() {
  var processAndEscapeValue = function(value) {
    var processedValue = value

    if (value instanceof Date) {
      return Utils.addTicks(SqlString.dateToString(value, 'local'), "'")
    } else if (typeof value === 'boolean') {
      processedValue = value ? 1 : 0
    } else if (value === null) {
      return "NULL"
    }

    console.log(this.escape(processedValue), processedValue)
    return QueryGenerator.addQuotes(this.escape(processedValue), "'")
  }

  var QueryGenerator = {
    options: {},

    addSchema: function(opts) {
      var tableName         = undefined
      var schema            = (!!opts.options && !!opts.options.schema ? opts.options.schema : undefined)
      var schemaDelimiter   = (!!opts.options && !!opts.options.schemaDelimiter ? opts.options.schemaDelimiter : undefined)

      if (!!opts.tableName) {
        tableName = opts.tableName
      }
      else if (typeof opts === "string") {
        tableName = opts
      }

      if (!schema || schema.toString().trim() === "") {
        return tableName
      }

      return QueryGenerator.addQuotes(schema) + '.' + QueryGenerator.addQuotes(tableName)
    },

    createSchema: function(schema) {
      var query = "CREATE SCHEMA <%= schema%>;"
      return Utils._.template(query)({schema: schema})
    },

    dropSchema: function(schema) {
      var query = "DROP SCHEMA <%= schema%>;"
      return Utils._.template(query)({schema: schema})
    },

    showSchemasQuery: function() {
      return "SELECT schema_name FROM information_schema.schemata WHERE schema_name <> 'INFORMATION_SCHEMA' AND schema_name != 'sys' AND schema_name LIKE 'db[_]%';"
    },

    createTableQuery: function(tableName, attributes, options) {
      var query   = "IF OBJECT_ID('<%= unquotedTable %>', N'U') IS NULL CREATE TABLE <%= table %> (<%= attributes%>)"
        , attrStr = []
        ,primaryKeys = Utils._.keys(Utils._.pick(attributes, function(dataType){
          return dataType.indexOf('PRIMARY KEY') >= 0
        }));

      for (var attr in attributes) {
        if (attributes.hasOwnProperty(attr)) {
          var dataType = attributes[attr]
          if(primaryKeys.length > 1){
            dataType = dataType.replace(/ PRIMARY KEY/, '')
          }
          attrStr.push(QueryGenerator.addQuotes(attr) + " " + dataType)
        }
      }

      if (primaryKeys.length > 1) {
        attrStr.push('PRIMARY KEY(' + primaryKeys.map(function(column){return QueryGenerator.addQuotes(column)}).join(', ') + ')')
      }

      var values = {
          unquotedTable: tableName,
          table: QueryGenerator.addQuotes(tableName),
          attributes: attrStr.join(", ")
        }

      return Utils._.template(query)(values).trim() + ";"
    },

    /*
     Returns a query for dropping a table.
     */
    dropTableQuery: function(tableName, options) {
      var query = "IF  OBJECT_ID('<%= unquotedTable %>') IS NOT NULL DROP TABLE <%= table %>;"

      return Utils._.template(query)({
        unquotedTable: tableName,
        table: QueryGenerator.addQuotes(tableName)
      })
    },

    /*
     Returns a rename table query.
     Parameters:
     - originalTableName: Name of the table before execution.
     - futureTableName: Name of the table after execution.
     */
    renameTableQuery: function(originalTableName, futureTableName) {
      throwMethodUndefined('renameTableQuery');
    },

    /*
     Returns a query, which gets all available table names in the database.
     */
    showTablesQuery: function() {
      return "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'";
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
      throwMethodUndefined('addColumnQuery');
    },

    /*
     Returns a query, which removes an attribute from an existing table.
     Parameters:
     - tableName: Name of the existing table
     - attributeName: Name of the obsolete attribute.
     */
    removeColumnQuery: function(tableName, attributeName) {
      throwMethodUndefined('removeColumnQuery');
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
      throwMethodUndefined('changeColumnQuery');
    },

    /*
     Returns a query, which renames an existing attribute.
     Parameters:
     - tableName: Name of an existing table.
     - attrNameBefore: The name of the attribute, which shall be renamed.
     - attrNameAfter: The name of the attribute, after renaming.
     */
    renameColumnQuery: function(tableName, attrNameBefore, attrNameAfter) {
      throwMethodUndefined('renameColumnQuery');
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
    selectQuery: function(tableName, options) {
      var query = "SELECT <%= attributes %> FROM <%= table %>"
        , table = null
        , outerwith = null

      options = options || {}

      if (Array.isArray(tableName)) {
        options.table = table = tableName.map(function(t){
          return QueryGenerator.addQuotes(t)
        }).join(", ")
        options.unquotedTable = tableName[0]
      } else {
        options.table = table = QueryGenerator.addQuotes(tableName)
        options.unquotedTable = tableName
      }

      options.attributes = options.attributes && options.attributes.map(function(attr) {
        if (Array.isArray(attr) && attr.length === 2) {
          return [
            attr[0],
            QueryGenerator.addQuotes(QueryGenerator.removeQuotes(attr[1], '"'))
          ].join(' as ')
        } else if (attr.indexOf('`') >= 0) {
          return attr.replace(/`/g, '"')
        } else {
          return QueryGenerator.addQuotes(attr)
        }
      })

      if (options.attributes && !options.include){
        options.attributes = options.attributes.join(", ")
      }

      options.attributes = options.attributes || '*'

      if (!(options.include && (options.limit === 1))) {
        if (options.limit){
          if(!options.offset){
            options.attributes = "TOP <%= limit %> " + options.attributes;
            options.attributes = Utils._.template(options.attributes)(options)
          }
          else {
            //if there is a slower way to do this i don't know it
            query = "SELECT <%= attributes %>, ROW_NUMBER() OVER(ORDER BY (SELECT TOP 1 c.[name] AS [Column Name] FROM syscolumns c inner join sysobjects t on c.id = t.id where t.[Name] = '<%= unquotedTable %>')) AS 'RowNumber' FROM <%= table %>"
            outerwith = "WITH QUERYWITHROWS AS ( <%= query %> ) SELECT <%= attributes %> FROM QUERYWITHROWS WHERE RowNumber BETWEEN <%= offset %> AND <%= offsetend %>"
            options.offsetend = options.offset + options.limit
          }
        }
      }

      if (options.include) {
        var optAttributes = options.attributes === '*' ? [options.table + '.*'] : [options.attributes.map(function(attr){
          return options.table + "." + attr + " AS " + QueryGenerator.addQuotes(attr)
        }).join(", ")]

        options.include.forEach(function(include) {
          var attributes = Object.keys(include.daoFactory.attributes).map(function(attr) {
            var template = Utils._.template('"<%= as %>"."<%= attr %>" AS "<%= as %>.<%= attr %>"')
            return template({ as: include.as, attr:  attr })
          })

          optAttributes = optAttributes.concat(attributes)

          var joinQuery = ' LEFT OUTER JOIN "<%= table %>" AS "<%= as %>" ON "<%= tableLeft %>"."<%= attrLeft %>" = "<%= tableRight %>"."<%= attrRight %>"'

          query += Utils._.template(joinQuery)({
            table:      include.daoFactory.tableName,
            as:         include.as,
            tableLeft:  ((include.association.associationType === 'BelongsTo') ? include.as : tableName),
            attrLeft:   ((include.association.associationType === 'BelongsTo') ? include.association.target.primaryKeyCols[0] : include.association.source.primaryKeyCols[0]),
            tableRight: ((include.association.associationType === 'BelongsTo') ? tableName : include.as),
            attrRight:  include.association.identifier
          })
        })

        options.attributes = optAttributes.join(', ')
      }

      if(options.hasOwnProperty('where')) {
        options.where = QueryGenerator.getWhereConditions(options.where, tableName)

        if(options.where){
          query += " WHERE <%= where %>"
        }
      }

      if(options.group) {
        if (Array.isArray(options.group)) {
          options.group = options.group.map(function(grp){
            return QueryGenerator.addQuotes(grp)
          }).join(', ')
        } else {
          options.group = QueryGenerator.addQuotes(options.group)
        }

        query += " GROUP BY <%= group %>"
      }

      if(options.order) {
        options.order = options.order.replace(/([^ ]+)(.*)/, function(m, g1, g2) {
          return QueryGenerator.addQuotes(g1) + g2
        })
        query += " ORDER BY <%= order %>"
      }

      if(outerwith){
        options.query = query
        query = Utils._.template(outerwith)(options)
      }

      query += ";"

      query = Utils._.template(query)(options)
      return query
    },

    /*
     Returns an insert into command. Parameters: table name + hash of attribute-value-pairs.
     */
    insertQuery: function(tableName, attrValueHash) {
      attrValueHash = Utils.removeNullValuesFromHash(attrValueHash, true, {
        transformUndefines: true
      })

      var table = QueryGenerator.addQuotes(tableName, '"')
        , ident = QueryGenerator.addQuotes(tableName, "'")

      var attributes = Object.keys(attrValueHash).map(function(attr){return QueryGenerator.addQuotes(attr)}).join(",")
      console.log(attrValueHash)
      var values = Utils._.values(attrValueHash).map(processAndEscapeValue).join(",")

      var query = "INSERT INTO " + table + " (" + attributes + ") OUTPUT INSERTED.*, IDENT_CURRENT(" + ident + ") AS insertId VALUES (" + values + ");"

      return query
    },

    /*
     Returns an insert into command for multiple values.
     Parameters: table name + list of hashes of attribute-value-pairs.
     */
    bulkInsertQuery: function(tableName, attrValueHashes) {
      var tuples = []

      Utils._.forEach(attrValueHashes, function(attrValueHash) {
        tuples.push("(" +
          Utils._.values(attrValueHash).map(processAndEscapeValue).join(",") +
          ")")
      })

      var table      = QueryGenerator.addQuotes(tableName)
      var attributes = Object.keys(attrValueHashes[0]).map(function(attr){return QueryGenerator.addQuotes(attr)}).join(",")

      var query  = "INSERT INTO " + table + " (" + attributes + ") VALUES " + tuples.join(",") + ";"

      return query
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
    updateQuery: function(tableName, attrValueHash, where) {
      attrValueHash = Utils.removeNullValuesFromHash(attrValueHash, this.options.omitNull)

      var values = []

      for (var key in attrValueHash) {
        var value  = attrValueHash[key]
          , _value = processAndEscapeValue(value)

        values.push(QueryGenerator.addQuotes(key) + "=" + _value)
      }

      var query = "UPDATE " + QueryGenerator.addQuotes(tableName) +
        " SET " + values.join(",") +
        " WHERE " + QueryGenerator.getWhereConditions(where)

      return query
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
     */
    deleteQuery: function(tableName, where, options) {
      options = options || {}

      var table = QueryGenerator.addQuotes(tableName)
      where = QueryGenerator.getWhereConditions(where)

      if(Utils._.isUndefined(options.limit)) {
        options.limit = 1;
      }

      var query;

      if(options.limit){
        query = "DELETE TOP(<%= limit %>) FROM " + table + " WHERE " + where
      }
      else{
        query = "DELETE FROM " + table + " WHERE " + where
      }

      return Utils._.template(query)(options);
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
      options = options || {}

      var table = QueryGenerator.addQuotes(tableName)
      where = QueryGenerator.getWhereConditions(where)

      var query = "DELETE FROM " + table + " WHERE " + where

      return query
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
    incrementQuery: function(tableName, attrValueHash, where) {
      attrValueHash = Utils.removeNullValuesFromHash(attrValueHash, this.options.omitNull)

      var values = []

      for (var key in attrValueHash) {
        if(attrValueHash.hasOwnProperty(key)){
          var value  = attrValueHash[key]
            , _value = processAndEscapeValue(value)

          values.push(QueryGenerator.addQuotes(key) + "=" + QueryGenerator.addQuotes(key) + " + " + _value)
        }
      }

      var table = QueryGenerator.addQuotes(tableName)
      values = values.join(",")
      where = QueryGenerator.getWhereConditions(where)

      var query = "UPDATE " + table + " SET " + values + " WHERE " + where

      return query
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
      throwMethodUndefined('addIndexQuery');
    },

    /*
     Returns an show index query.
     Parameters:
     - tableName: Name of an existing table.
     - options:
     - database: Name of the database.
     */
    showIndexQuery: function(tableName, options) {
      throwMethodUndefined('showIndexQuery');
    },

    /*
     Returns a remove index query.
     Parameters:
     - tableName: Name of an existing table.
     - indexNameOrAttributes: The name of the index as string or an array of attribute names.
     */
    removeIndexQuery: function(tableName, indexNameOrAttributes) {
      throwMethodUndefined('removeIndexQuery');
    },

    /*
     Takes something and transforms it into values of a where condition.
     */
    getWhereConditions: function(smth, tableName) {
      var result = null

      if (Utils.isHash(smth)) {
        smth = Utils.prependTableNameToHash(tableName, smth)
        result = QueryGenerator.hashToWhereConditions(smth)
      }
      else if (typeof smth === "number") {
        smth = Utils.prependTableNameToHash(tableName, { id: smth })
        result = QueryGenerator.hashToWhereConditions(smth)
      }
      else if (typeof smth === "string") {
        result = smth
      }
      else if (Array.isArray(smth)) {
        result = Utils.format(smth)
      }

      return result
    },

    /*
     Takes a hash and transforms it into a mysql where condition: {key: value, key2: value2} ==> key=value AND key2=value2
     The values are transformed by the relevant datatype.
     */
    hashToWhereConditions: function(hash) {
      var result = []

      for (var key in hash) {
        var value = hash[key]

        //handle qualified key names
        var _key   = key.split('.').map(function(col){return QueryGenerator.addQuotes(col)}).join(".")
          , _value = null

        if (Array.isArray(value)) {
          if (value.length === 0) { value = [null] }
          _value = "(" + value.map(function(subValue) {
            return processAndEscapeValue(subValue);
          }).join(',') + ")"

          result.push([_key, _value].join(" IN "))
        }
        else if ((value) && (typeof value === "object") && !(value instanceof Date)) {
          //using as sentinel for join column => value
          _value = value.join.split('.').map(function(col){return QueryGenerator.addQuotes(col)}).join(".")
          result.push([_key, _value].join("="))
        } else {
          _value = processAndEscapeValue(value)
          result.push((_value == 'NULL') ? _key + " IS NULL" : [_key, _value].join("="))
        }
      }

      return result.join(' AND ')
    },

    /*
     This method transforms an array of attribute hashes into equivalent
     sql attribute definition.
     */
    attributesToSQL: function(attributes) {
      var result = {}

      for (var name in attributes) {
        var dataType = attributes[name]

        if (Utils.isHash(dataType)) {
          var template


          if (dataType.type.toString() === DataTypes.ENUM.toString()) {
            throw new Error('MSSQL does not support the ENUM data type')
          } else {
            template = dataType.type.toString();
          }

          if(dataType.type.toString().indexOf('TINYINT(') >= 0){
            template = template.replace(/TINYINT\(.\)/, 'TINYINT')
          }

          if(dataType.hasOwnProperty('zeroFill') && dataType.zeroFill){
            throw new Error('MSSQL does not support ZEROFILL')
          }

          if(dataType.hasOwnProperty('unsigned') && dataType.unsigned){
            throw new Error('MSSQL does not support UNSIGNED')
          }

          if (dataType.hasOwnProperty('allowNull') && (!dataType.allowNull)) {
            template += " NOT NULL"
          }

          if (dataType.autoIncrement) {
            template += " IDENTITY"
          }

          if ((dataType.defaultValue !== undefined) && (dataType.defaultValue != DataTypes.NOW)) {
            template += " DEFAULT " + Utils.escape(dataType.defaultValue)
          }

          if (dataType.unique) {
            template += " UNIQUE"
          }


          if (dataType.primaryKey) {
            template += " PRIMARY KEY"
          }

          if(dataType.allowNull || (!(dataType.autoIncrement || dataType.defaultValue || dataType.unique || dataType.primaryKey) && dataType.allowNull === undefined)){
            template += " NULL"
          }

          if(dataType.references) {
            template += " REFERENCES " + QueryGenerator.addQuotes(dataType.references)


            if(dataType.referencesKey) {
              template += " (" + QueryGenerator.addQuotes(dataType.referencesKey) + ")"
            } else {
              template += " (" + QueryGenerator.addQuotes('id') + ")"
            }

            if(dataType.onDelete) {
              template += " ON DELETE " + dataType.onDelete.toUpperCase()
            }

            if(dataType.onUpdate) {
              template += " ON UPDATE " + dataType.onUpdate.toUpperCase()
            }

          }

          result[name] = template
        } else {
          result[name] = dataType
        }
      }

      return result
    },

    /*
     Returns all auto increment fields of a factory.
     */
    findAutoIncrementField: function(factory) {
      var fields = []

      for (var name in factory.attributes) {
        if (factory.attributes.hasOwnProperty(name)) {
          var definition = factory.attributes[name]

          if (definition && (definition.indexOf('IDENTITY') > -1)) {
            fields.push(name)
          }
        }
      }

      return fields
    },

    enableForeignKeyConstraintsQuery: function() {
      return "exec sp_msforeachtable @command1=\"print '?'\", @command2=\"ALTER TABLE ? WITH CHECK CHECK CONSTRAINT all\""
    },

    /*
     Globally disable foreign key constraints
     */
    disableForeignKeyConstraintsQuery: function() {
      return "EXEC sp_msforeachtable \"ALTER TABLE ? NOCHECK CONSTRAINT all\""
    },

    removeQuotes: function (s, quoteChar) {
      quoteChar = quoteChar || '"';
      return s.replace(new RegExp(quoteChar, 'g'), '');
    },

    addQuotes: function (s, quoteChar) {
      quoteChar = quoteChar || '"';
      return QueryGenerator.removeQuotes(s, quoteChar)
        .split('.')
        .map(function(e) { return quoteChar + String(e) + quoteChar })
        .join('.');
    },


    quoteIdentifier: function(identifier) {
      return Utils.addTicks(identifier, '"')
    },

    quoteIdentifiers: function(identifiers) {
      var self = this

      return identifiers.split('.').map(function(v) {
        return self.quoteIdentifier(v)
      }).join('.')
    },

    /**
     * Generates an SQL query that returns all foreign keys of a table.
     *
     * @param  {String} tableName  The name of the table.
     * @param  {String} schemaName The name of the schema.
     * @return {String}            The generated sql query.
     */
    getForeignKeysQuery: function(tableName, schemaName) {
      return "select CONSTRAINT_NAME as constraint_name from INFORMATION_SCHEMA.TABLE_CONSTRAINTS where CONSTRAINT_TYPE='FOREIGN KEY' and TABLE_NAME='" + tableName + "'"
    },


    /**
     * Generates an SQL query that removes a foreign key from a table.
     *
     * @param  {String} tableName  The name of the table.
     * @param  {String} foreignKey The name of the foreign key constraint.
     * @return {String}            The generated sql query.
     */
    dropForeignKeyQuery: function(tableName, foreignKey) {
      console.log(tableName, foreignKey)
      return 'ALTER TABLE ' + this.quoteIdentifier(tableName) + ' DROP ' + this.quoteIdentifier(foreignKey) + ';'
    },

    /**
     * Returns a query that starts a transaction.
     *
     * @param  {Object} options An object with options.
     * @return {String}         The generated sql query.
     */
    startTransactionQuery: function(options) {
      return "BEGIN TRANSACTION;"
    },

    setIsolationLevelQuery: function(value) {
      switch (value) {
        case Transaction.ISOLATION_LEVELS.REPEATABLE_READ:
          return "-- No support for the isolation level, yet."
        case Transaction.ISOLATION_LEVELS.READ_UNCOMMITTED:
          return "-- No support for the isolation level, yet."
        case Transaction.ISOLATION_LEVELS.READ_COMMITTED:
          return "-- No support for the isolation level, yet."
        case Transaction.ISOLATION_LEVELS.SERIALIZABLE:
          return "-- No support for the isolation level, yet."
        default:
          throw new Error('Unknown isolation level: ' + value)
      }
    },

    setAutocommitQuery: function(value) {
      return "-- No support for set autocommit, yet."
    }
  }

  var throwMethodUndefined = function(methodName) {
    throw new Error('The method "' + methodName + '" is not defined! Please add it to your sql dialect.');
  }


  return Utils._.extend(Utils._.clone(require("../abstract/query-generator")), QueryGenerator)
})()
