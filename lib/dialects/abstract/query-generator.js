var Utils = require("../../utils")
  , SqlString = require("../../sql-string")
  , daoFactory = require("../../dao-factory")

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
    renameTableQuery: function(before, after) {
      var query = "ALTER TABLE <%= before %> RENAME TO <%= after %>;"
      return Utils._.template(query)({
        before: this.quoteTable(before),
        after: this.quoteTable(after)
      })
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
    insertQuery: function(table, valueHash, modelAttributes) {
      var query
        , valueQuery          = "INSERT INTO <%= table %> (<%= attributes %>) VALUES (<%= values %>)"
        , emptyQuery          = "INSERT INTO <%= table %>"
        , fields              = []
        , values              = []
        , key
        , value

      if (this._dialect.supports['DEFAULT VALUES']) {
        emptyQuery += " DEFAULT VALUES"
      } else if (this._dialect.supports['VALUES ()']) {
        emptyQuery += " VALUES ()"
      }

      if (this._dialect.supports['RETURNING']) {
        valueQuery += " RETURNING *"
        emptyQuery += " RETURNING *"
      }

      valueHash = Utils.removeNullValuesFromHash(valueHash, this.options.omitNull)

      for (key in valueHash) {
        if (valueHash.hasOwnProperty(key)) {
          value = valueHash[key]
          fields.push(this.quoteIdentifier(key))

          // SERIALS' can't be NULL in postgresql, use DEFAULT where supported
          if (modelAttributes && modelAttributes[key] && modelAttributes[key].autoIncrement === true && !value) {
            if (this._dialect.supports['DEFAULT']) {
              values.push('DEFAULT')
            } else {
              values.push(this.escape(null))
            }
          } else {
            values.push(this.escape(value, (modelAttributes && modelAttributes[key]) || undefined))
          }
        }
      }

      var replacements  = {
        table:      this.quoteTable(table),
        attributes: fields.join(","),
        values:     values.join(",")
      }

      query = (replacements.attributes.length ? valueQuery : emptyQuery) + ";"

      return Utils._.template(query)(replacements)
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
    updateQuery: function(tableName, attrValueHash, where, options, attributes) {
      options = options || {}

      attrValueHash = Utils.removeNullValuesFromHash(attrValueHash, this.options.omitNull, options)

      var query
        , values = []

      query = "UPDATE <%= table %> SET <%= values %> WHERE <%= where %>"
      if (this._dialect.supports['RETURNING'] && (options.returning || options.returning === undefined)) {
        query += " RETURNING *"
      }

      for (var key in attrValueHash) {
        var value = attrValueHash[key]
        values.push(this.quoteIdentifier(key) + "=" + this.escape(value, (!!attributes && !!attributes[key] ? attributes[key] : undefined)))
      }

      var replacements = {
        table:  this.quoteTable(tableName),
        values: values.join(","),
        where:  this.getWhereConditions(where)
      }

      return Utils._.template(query)(replacements)
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
    incrementQuery: function(tableName, attrValueHash, where, options) {
      attrValueHash = Utils.removeNullValuesFromHash(attrValueHash, this.options.omitNull)

      var query
        , values = []

      query = "UPDATE <%= table %> SET <%= values %> WHERE <%= where %>"
      if (this._dialect.supports['RETURNING']) {
        query += " RETURNING *"
      }

      for (var key in attrValueHash) {
        var value = attrValueHash[key]
        values.push(this.quoteIdentifier(key) + "=" + this.quoteIdentifier(key) + " + " + this.escape(value))
      }

      options = options || {}
      for (var key in options) {
        var value = options[key];
        values.push(this.quoteIdentifier(key) + "=" + this.escape(value))
      }

      var replacements = {
        table:  this.quoteIdentifiers(tableName),
        values: values.join(","),
        where:  this.getWhereConditions(where)
      }

      return Utils._.template(query)(replacements)
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
      Arrays:
        * Expects array in the form: [<model> (optional), <model> (optional),... String, String (optional)]
          Each <model> can be a daoFactory or an object {model: DaoFactory, as: String}, matching include
        * Zero or more models can be included in the array and are used to trace a path through the tree of
          included nested associations. This produces the correct table name for the ORDER BY/GROUP BY SQL
          and quotes it.
        * If a single string is appended to end of array, it is quoted.
          If two strings appended, the 1st string is quoted, the 2nd string unquoted.
      Objects:
        * If raw is set, that value should be returned verbatim, without quoting
        * If fn is set, the string should start with the value of fn, starting paren, followed by
          the values of cols (which is assumed to be an array), quoted and joined with ', ',
          unless they are themselves objects
        * If direction is set, should be prepended

      Currently this function is only used for ordering / grouping columns and Sequelize.col(), but it could
      potentially also be used for other places where we want to be able to call SQL functions (e.g. as default values)
    */
    quote: function(obj, parent, force) {
      if (Utils._.isString(obj)) {
        return this.quoteIdentifiers(obj, force)
      } else if (Array.isArray(obj)) {
        // loop through array, adding table names of models to quoted
        // (checking associations to see if names should be singularised or not)
        var tableNames = []
          , parentAssociation
          , len = obj.length
        for (var i = 0; i < len - 1; i++) {
          var item = obj[i]
          if (Utils._.isString(item) || item instanceof Utils.fn || item instanceof Utils.col || item instanceof Utils.literal || item instanceof Utils.cast || 'raw' in item) {
            break
          }

          var model, as
          if (item instanceof daoFactory) {
            model = item
          } else {
            model = item.model
            as = item.as
          }

          // check if model provided is through table
          var association
          if (!as && parentAssociation && parentAssociation.through === model) {
            association = {as: Utils.singularize(model.tableName, model.options.language)}
          } else {
            // find applicable association for linking parent to this model
            association = parent.getAssociation(model, as)
          }

          if (association) {
            tableNames[i] = association.as
            parent = model
            parentAssociation = association
          } else {
            tableNames[i] = model.tableName
            throw new Error('\'' + tableNames.join('.') + '\' in order / group clause is not valid association')
          }
        }

        // add 1st string as quoted, 2nd as unquoted raw
        var sql = (i > 0 ? this.quoteIdentifier(tableNames.join('.')) + '.' : '') + this.quote(obj[i], parent, force)
        if (i < len - 1) {
          sql += ' ' + obj[i + 1]
        }
        return sql
      } else if (obj instanceof Utils.fn || obj instanceof Utils.col || obj instanceof Utils.literal || obj instanceof Utils.cast) {
        return obj.toString(this)
      } else if (Utils._.isObject(obj) && 'raw' in obj) {
        return obj.raw
      } else {
        throw new Error('Unknown structure passed to order / group: ' + JSON.stringify(obj))
      }
    },

    getTableNameOrder: function (obj){
      if (Utils._.isString(obj)) {
        return obj
      } else if (Array.isArray(obj)) {
        return this.getTableNameOrder(obj[0])
      } else if (obj instanceof Utils.fn) {
        return this.getTableNameOrder(obj.args)
      } else if (obj instanceof Utils.col) {
        return obj.col.split('.')[0]
      } else if (Utils._.isObject(obj) && 'raw' in obj){
        return obj.raw
      } else{
        return ''
      }
    },
    
    getSpecificQuoteOrder: function (obj){
      if (Utils._.isString(obj)) {
        return this.quoteIdentifier(obj)
      } else if (Array.isArray(obj)) {
        return this.getSpecificQuoteOrder(obj[0]) + (obj.length > 1 ? ' ' + obj[1] : '')
      } else if (obj instanceof Utils.fn) {
        return obj.fn + '(' + this.getSpecificQuoteOrder(obj.args) + ')'
      } else if (obj instanceof Utils.col) {
        return this.quoteIdentifier(obj.col)
      } else if (Utils._.isObject(obj) && 'raw' in obj){
        return obj.raw
      } else{
        return ''
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
      // Enter and change at your own peril -- Mick Hansen

      options = options || {}

      var table               = null
        , self                = this
        , query
        , limit               = options.limit
        , mainQueryItems      = []
        , mainAttributes      = options.attributes
        , mainJoinQueries     = []
        // We'll use a subquery if we have hasMany associations and a limit and a filtered/required association
        , subQuery            = limit && (options.hasIncludeWhere || options.hasIncludeRequired || options.hasMultiAssociation)
        , subQueryItems       = []
        , subQueryAs          = []
        , subQueryAttributes  = null
        , subJoinQueries      = []

      // Escape table
      options.table = table = !Array.isArray(tableName) ? this.quoteIdentifiers(tableName) : tableName.map(function(t) {
        return this.quoteIdentifiers(t)
      }.bind(this)).join(", ")

      if (subQuery && mainAttributes) {
        if (factory.hasPrimaryKeys) {
          factory.primaryKeyAttributes.forEach(function(keyAtt){
            if(mainAttributes.indexOf(keyAtt) == -1){
              mainAttributes.push(keyAtt)
            }
          })
        } else {
          mainAttributes.push("id")
        }          
      }

      // Escape attributes
      mainAttributes = mainAttributes && mainAttributes.map(function(attr){
        var addTable = true

        if (attr instanceof Utils.literal) {
          return attr.toString(this)
        }

        if (attr instanceof Utils.fn || attr instanceof Utils.col) {
          return attr.toString(self)
        }

        if(Array.isArray(attr) && attr.length == 2) {
          if (attr[0] instanceof Utils.fn || attr[0] instanceof Utils.col) {
            attr[0] = attr[0].toString(self)
            addTable = false
          }
          attr = [attr[0], this.quoteIdentifier(attr[1])].join(' as ')
        } else {
          attr = attr.indexOf(Utils.TICK_CHAR) < 0 && attr.indexOf('"') < 0 ? this.quoteIdentifiers(attr) : attr
        }

        if (options.include && attr.indexOf('.') === -1 && addTable) {
          attr = this.quoteIdentifier(options.table) + '.' + attr
        }

        return attr
      }.bind(this))

      // If no attributes specified, use *
      mainAttributes = mainAttributes || (options.include ? [options.table+'.*'] : ['*'])

      // If subquery, we ad the mainAttributes to the subQuery and set the mainAttributes to select * from subquery
      if (subQuery) {
        // We need primary keys
        subQueryAttributes = mainAttributes
        !Array.isArray(tableName) ? subQueryAs.push(tableName) : subQueryAs.concat(tableName)
        mainAttributes = [options.table+'.*']
      }

      if (options.include) {
        var generateJoinQueries = function(include, parentTable) {
          var table         = include.daoFactory.tableName
            , as            = include.as
            , joinQueryItem = ""
            , joinQueries = {
              mainQuery: [],
              subQuery: []
            }
            , attributes
            , association   = include.association
            , through       = include.through
            , joinType      = include.required ? ' INNER JOIN ' : ' LEFT OUTER JOIN '
            , includeWhere  = {}
            , whereOptions  = Utils._.clone(options)

          whereOptions.keysEscaped = true

          if (tableName !== parentTable) {
            as = parentTable+'.'+include.as
          }
          
          if (include.subQuery && subQuery){
            subQueryAs.push(as);
          }

          // includeIgnoreAttributes is used by aggregate functions
          if (options.includeIgnoreAttributes !== false) {
            attributes  = include.attributes.map(function(attr) {
              return self.quoteIdentifier(as) + "." + self.quoteIdentifier(attr) + " AS " + self.quoteIdentifier(as + "." + attr)
            })

            if (include.subQuery && subQuery) {
              subQueryAttributes = subQueryAttributes.concat(attributes)
            } else {
              mainAttributes = mainAttributes.concat(attributes)
            }
          }

          if (through) {
            var throughTable      = through.daoFactory.tableName
              , throughAs         = as + "." + through.as
              , throughAttributes = through.attributes.map(function(attr) {
                return self.quoteIdentifier(throughAs) + "." + self.quoteIdentifier(attr) + " AS " + self.quoteIdentifier(throughAs + "." + attr)
              })
              , primaryKeysSource = Object.keys(association.source.primaryKeys)
              , tableSource       = parentTable
              , identSource       = association.identifier
              , attrSource        = ((!association.source.hasPrimaryKeys || primaryKeysSource.length !== 1) ? 'id' : primaryKeysSource[0])
              , where

              , primaryKeysTarget = Object.keys(association.target.primaryKeys)
              , tableTarget       = as
              , identTarget       = association.foreignIdentifier
              , attrTarget        = ((!include.association.target.hasPrimaryKeys || primaryKeysTarget.length !== 1) ? 'id' : primaryKeysTarget[0])

              , sourceJoinOn
              , targetJoinOn
              , targetWhere

            if (options.includeIgnoreAttributes !== false) {
              // Through includes are always hasMany, so we need to add the attributes to the mainAttributes no matter what (Real join will never be executed in subquery)
              mainAttributes = mainAttributes.concat(throughAttributes)
            }

            // Filter statement for left side of through
            // Used by both join and subquery where
            sourceJoinOn = self.quoteIdentifier(tableSource) + "." + self.quoteIdentifier(attrSource) + " = "
              sourceJoinOn += self.quoteIdentifier(throughAs) + "." + self.quoteIdentifier(identSource)

            // Filter statement for right side of through
            // Used by both join and subquery where
            targetJoinOn = self.quoteIdentifier(tableTarget) + "." + self.quoteIdentifier(attrTarget) + " = "
              targetJoinOn += self.quoteIdentifier(throughAs) + "." + self.quoteIdentifier(identTarget)

            // Generate join SQL for left side of through
            joinQueryItem += joinType + self.quoteIdentifier(throughTable) + " AS " + self.quoteIdentifier(throughAs) + " ON "
              joinQueryItem += sourceJoinOn

            // Generate join SQL for right side of through
            joinQueryItem += joinType + self.quoteIdentifier(table) + " AS " + self.quoteIdentifier(as) + " ON "
              joinQueryItem += targetJoinOn


            if (include.where) {
              targetWhere = self.getWhereConditions(include.where, self.sequelize.literal(self.quoteIdentifier(as)), include.daoFactory, whereOptions)
              joinQueryItem += " AND "+ targetWhere
              if (subQuery) {
                if (!options.where) options.where = {}

                // Creating the as-is where for the subQuery, checks that the required association exists
                var _where = "(";
                  _where += "SELECT "+self.quoteIdentifier(identSource)+" FROM " + self.quoteIdentifier(throughTable) + " AS " + self.quoteIdentifier(throughAs);
                  _where += joinType + self.quoteIdentifier(table) + " AS " + self.quoteIdentifier(as) + " ON "+targetJoinOn;
                  _where += " WHERE " + sourceJoinOn + " AND " + targetWhere + " LIMIT 1"
                _where += ")";
                _where += " IS NOT NULL"

                options.where["__"+throughAs] = self.sequelize.asIs(_where)
              }
            }
          } else {
            var primaryKeysLeft = ((association.associationType === 'BelongsTo') ? Object.keys(association.target.primaryKeys) : Object.keys(include.association.source.primaryKeys))
              , tableLeft       = ((association.associationType === 'BelongsTo') ? as : parentTable)
              , attrLeft        = ((primaryKeysLeft.length !== 1) ? 'id' : primaryKeysLeft[0])
              , tableRight      = ((association.associationType === 'BelongsTo') ? parentTable : as)
              , attrRight       = association.identifier
              , where

            // Filter statement
            // Used by both join and subquery where

            if (subQuery && !include.subQuery && include.parent.subQuery) {
              where = self.quoteIdentifier(tableLeft + "." + attrLeft) + " = "
            } else {
              where = self.quoteIdentifier(tableLeft) + "." + self.quoteIdentifier(attrLeft) + " = "
            }
            where += self.quoteIdentifier(tableRight) + "." + self.quoteIdentifier(attrRight)

            // Generate join SQL
            joinQueryItem += joinType + self.quoteIdentifier(table) + " AS " + self.quoteIdentifier(as) + " ON "
              joinQueryItem += where

            if (include.where) {
              joinQueryItem += " AND "+self.getWhereConditions(include.where, self.sequelize.literal(self.quoteIdentifier(as)), include.daoFactory, whereOptions)

              // If its a multi association we need to add a where query to the main where (executed in the subquery)
              if (subQuery && association.isMultiAssociation) {
                if (!options.where) options.where = {}
                // Creating the as-is where for the subQuery, checks that the required association exists
                options.where["__"+as] = self.sequelize.asIs("(SELECT "+self.quoteIdentifier(attrRight)+" FROM " + self.quoteIdentifier(tableRight) + " WHERE " + where + " LIMIT 1) IS NOT NULL")
              }
            }
          }

          if (include.subQuery && subQuery) {
            joinQueries.subQuery.push(joinQueryItem);
          } else {
            joinQueries.mainQuery.push(joinQueryItem);
          }

          if (include.include) {
            include.include.forEach(function(childInclude) {
              if (childInclude._pseudo) return
              var childJoinQueries = generateJoinQueries(childInclude, as)

              if (childInclude.subQuery && subQuery) {
                joinQueries.subQuery = joinQueries.subQuery.concat(childJoinQueries.subQuery)
              } else {
                joinQueries.mainQuery = joinQueries.mainQuery.concat(childJoinQueries.mainQuery)
              }
            }.bind(this))
          }
          return joinQueries
        }

        // Loop through includes and generate subqueries
        options.include.forEach(function(include) {
          var joinQueries = generateJoinQueries(include, tableName)

          subJoinQueries = subJoinQueries.concat(joinQueries.subQuery)
          mainJoinQueries = mainJoinQueries.concat(joinQueries.mainQuery)
        }.bind(this))
      }

      // If using subQuery select defined subQuery attributes and join subJoinQueries
      if (subQuery) {
        subQueryItems.push("SELECT " + subQueryAttributes.join(', ') + " FROM " + options.table)
        subQueryItems.push(subJoinQueries.join(''))

      // Else do it the reguar way
      } else {
        mainQueryItems.push("SELECT " + mainAttributes.join(', ') + " FROM " + options.table)
        mainQueryItems.push(mainJoinQueries.join(''))
      }

      // Add WHERE to sub or main query
      if (options.hasOwnProperty('where')) {
        options.where = this.getWhereConditions(options.where, tableName, factory, options)
        if (subQuery) {
          subQueryItems.push(" WHERE " + options.where)
        } else {
          mainQueryItems.push(" WHERE " + options.where)
        }
      }

      // Add GROUP BY to sub or main query
      if (options.group) {
        options.group = Array.isArray(options.group) ? options.group.map(function (t) { return this.quote(t, factory) }.bind(this)).join(', ') : options.group
        if (subQuery) {
          subQueryItems.push(" GROUP BY " + options.group)
        } else {
          mainQueryItems.push(" GROUP BY " + options.group)
        }
      }
      
      // Add HAVING to sub or main query
      if (options.hasOwnProperty('having')) {
        options.having = this.getWhereConditions(options.having, tableName, factory, options, false)
        if (subQuery) {
          subQueryItems.push(" HAVING " + options.having)
        } else {
          mainQueryItems.push(" HAVING " + options.having)
        }
      }

      // Add ORDER to sub or main query
      if (options.order) {
        var mainQueryOrder = [];
        var subQueryOrder = [];

        if (Array.isArray(options.order)) {
          options.order.forEach(function (t) {
            var strOrder = this.quote(t, factory)
            var tableName = this.getTableNameOrder(t)
            if (subQuery && !(t[0] instanceof daoFactory) && !(t[0].model instanceof daoFactory)) {
              if(tableName && subQueryAs.indexOf(tableName) > -1){
                subQueryOrder.push(strOrder)
              }              
            }
            
            if(subQuery && tableName !== subQueryAs[0] && subQueryAs.indexOf(tableName) > -1){
              mainQueryOrder.push(this.getSpecificQuoteOrder(t))
            }else{
              mainQueryOrder.push(strOrder)
            }
          }.bind(this))
        } else {
          mainQueryOrder.push(options.order)
        }
        
        if (mainQueryOrder.length) {
          mainQueryItems.push(" ORDER BY " + mainQueryOrder.join(', '))
        }
        if (subQueryOrder.length) {
          subQueryItems.push(" ORDER BY " + subQueryOrder.join(', '))
        }
      }

      var limitOrder = this.addLimitAndOffset(options, query)

      // Add LIMIT, OFFSET to sub or main query
      if (limitOrder) {
        if (subQuery) {
          subQueryItems.push(limitOrder)
        } else {
          mainQueryItems.push(limitOrder)
        }
      }

      // If using subQuery, select attributes from wrapped subQuery and join out join tables
      if (subQuery) {
        query = "SELECT " + mainAttributes.join(', ') + " FROM ("
          query += subQueryItems.join('')
        query += ") AS "+options.table
        query += mainJoinQueries.join('')
        query += mainQueryItems.join('')
      } else {
        query = mainQueryItems.join('')
      }

      query += ";";

      return query
    },

    /**
     * Returns a query that starts a transaction.
     *
     * @param  {Boolean} value A boolean that states whether autocommit shall be done or not.
     * @return {String}        The generated sql query.
     */
    setAutocommitQuery: function(value) {
      return "SET autocommit = " + (!!value ? 1 : 0) + ";"
    },

    setIsolationLevelQuery: function(value) {
      return "SET SESSION TRANSACTION ISOLATION LEVEL " + value + ";"
    },

    /**
     * Returns a query that starts a transaction.
     *
     * @param  {Object} options An object with options.
     * @return {String}         The generated sql query.
     */
    startTransactionQuery: function(options) {
      return "START TRANSACTION;"
    },

    /**
     * Returns a query that commits a transaction.
     *
     * @param  {Object} options An object with options.
     * @return {String}         The generated sql query.
     */
    commitTransactionQuery: function(options) {
      return "COMMIT;"
    },

    /**
     * Returns a query that rollbacks a transaction.
     *
     * @param  {Object} options An object with options.
     * @return {String}         The generated sql query.
     */
    rollbackTransactionQuery: function(options) {
      return "ROLLBACK;"
    },

    addLimitAndOffset: function(options, query) {
      query = query || ""

      if (options.offset && !options.limit) {
        query += " LIMIT " + options.offset + ", " + 10000000000000;
      } else if (options.limit) {
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
    getWhereConditions: function(smth, tableName, factory, options, prepend) {
      var result = null
        , where  = {}
        , self   = this

      if (typeof prepend === 'undefined') {
        prepend = true
      }

      if ((smth instanceof Utils.and) || (smth instanceof Utils.or)) {
        var connector = (smth instanceof Utils.and) ? ' AND ' : ' OR '

        result = smth.args.map(function(arg) {
          return self.getWhereConditions(arg, tableName, factory, options, prepend)
        }).join(connector)

        result = "(" + result + ")"
      } else if (Utils.isHash(smth)) {
        if (prepend) {
          smth = Utils.prependTableNameToHash(tableName, smth, self.quoteIdentifier.bind(self))
        }
        result = this.hashToWhereConditions(smth, factory, options)
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
      } else if (Buffer.isBuffer(smth)) {
        result = this.escape(smth)
      } else if (Array.isArray(smth)) {
        var treatAsAnd = smth.reduce(function(treatAsAnd, arg) {
          if (treatAsAnd) {
            return treatAsAnd
          } else {
            return !(arg instanceof Date) && ((arg instanceof Utils.and) || (arg instanceof Utils.or) || Utils.isHash(arg))
          }
        }, false)

        if (treatAsAnd) {
          var _smth = self.sequelize.and.apply(null, smth)
          result = self.getWhereConditions(_smth, tableName, factory, options, prepend)
        } else {
          result = Utils.format(smth, this.dialect)
        }
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

    isAssociationFilter: function(filterStr, dao, options){
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

    getAssociationFilterColumn: function(filterStr, dao, options){
      var associationParts = filterStr.split('.')
        , attributePart = associationParts.pop()
        , self = this
        , association
        , keyParts = []

      associationParts.forEach(function (attribute) {
        association = self.findAssociation(attribute, dao)
        dao = association.target;
        if (options.include) {
          keyParts.push(association.as || association.options.as || dao.tableName)
        }
      })

      if (options.include) {
        return this.quoteIdentifier(keyParts.join('.')) + '.' + this.quoteIdentifiers(attributePart)
      }
      return this.quoteIdentifiers(dao.tableName + '.' + attributePart)
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

          if (self.isAssociationFilter(filterStr, dao, options)) {
            associationParts.forEach(function (attribute) {
              var association = self.findAssociation(attribute, dao);

              if(!joinedTables[association.target.tableName]){
                joinedTables[association.target.tableName] = true;

                if(association.associationType === 'BelongsTo'){
                  joins += ' LEFT JOIN ' + self.quoteIdentifiers(association.target.tableName)
                  joins += ' ON ' + self.quoteIdentifiers(association.source.tableName + '.' + association.identifier)
                  joins += ' = ' + self.quoteIdentifiers(association.target.tableName + '.' + association.target.autoIncrementField)
                } else if (Object(association.through) === association.through) {
                  joinedTables[association.through.tableName] = true;
                  joins += ' LEFT JOIN ' + self.quoteIdentifiers(association.through.tableName)
                  joins += ' ON ' + self.quoteIdentifiers(association.source.tableName + '.' + association.source.autoIncrementField)
                  joins += ' = ' + self.quoteIdentifiers(association.through.tableName + '.' + association.identifier)

                  joins += ' LEFT JOIN ' + self.quoteIdentifiers(association.target.tableName)
                  joins += ' ON ' + self.quoteIdentifiers(association.through.tableName + '.' + association.foreignIdentifier)
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

    arrayValue: function(value, key, _key, factory, logicResult){
        var _value = null;

        if (value.length === 0) { value = [null] }
        _value = "(" + value.map(function(v) { return this.escape(v) }.bind(this)).join(',') + ")"
        return [_key, _value].join(" " + logicResult + " ")
    },

    /*
      Takes a hash and transforms it into a mysql where condition: {key: value, key2: value2} ==> key=value AND key2=value2
      The values are transformed by the relevant datatype.
    */
    hashToWhereConditions: function(hash, dao, options) {
      var result = []

      options = options || {}

      // Closures are nice
      Utils._.each(hash, function (value, key) {
        var _key
          , _value = null

        if (value instanceof Utils.asIs) {
          result.push(value.toString(this))
          return
        }

        if (options.keysEscaped) {
          _key = key
        } else {
          if(this.isAssociationFilter(key, dao, options)){
            _key = key = this.getAssociationFilterColumn(key, dao, options);
          } else {
            _key = this.quoteIdentifiers(key)
          }
        }

        if (Array.isArray(value)) {
          result.push(this.arrayValue(value, key, _key, dao, "IN"))
        } else if ((value) && (typeof value == 'object') && !(value instanceof Date) && !Buffer.isBuffer(value)) {
          if (!!value.join) {
            //using as sentinel for join column => value
            _value = this.quoteIdentifiers(value.join)
            result.push([_key, _value].join("="))
          } else {
            for (var logic in value) {
              var logicResult = Utils.getWhereLogic(logic, hash[key][logic]);
              if (logicResult === "IN" || logicResult === "NOT IN") {
                var values = Array.isArray(value[logic]) ? value[logic] : [value[logic]]
                result.push(this.arrayValue(values, key, _key, dao, logicResult))
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
      }.bind(this))

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

