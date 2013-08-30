var Utils     = require("../../utils")
  , DataTypes = require("../../data-types")
  , SqlString = require("../../sql-string")
  , util      = require("util")

module.exports = (function() {
  var QueryGenerator = {
    dialect: 'mysql',
    addSchema: function(opts) {
      var tableName
      var schema        = (!!opts && !!opts.options && !!opts.options.schema ? opts.options.schema : undefined)
      var schemaDelimiter  = (!!opts && !!opts.options && !!opts.options.schemaDelimiter ? opts.options.schemaDelimiter : undefined)

      if (!!opts && !!opts.tableName) {
        tableName = opts.tableName
      }
      else if (typeof opts === "string") {
        tableName = opts
      }

      if (!schema || schema.toString().trim() === "") {
        return tableName
      }

      return this.quoteIdentifier(schema + (!schemaDelimiter ? '.' : schemaDelimiter) + tableName, false)
    },

    createSchema: function() {
      var query = "SHOW TABLES"
      return Utils._.template(query)({})
    },

    dropSchema: function(tableName, options) {
      return QueryGenerator.dropTableQuery(tableName, options)
    },

    showSchemasQuery: function() {
      return "SHOW TABLES"
    },

    createTableQuery: function(tableName, attributes, options) {
      options = Utils._.extend({
        engine: 'InnoDB',
        charset: null
      }, options || {})

      var query   = "CREATE TABLE IF NOT EXISTS <%= table %> (<%= attributes%>)<%= comment %> ENGINE=<%= engine %> <%= charset %> <%= collation %>"
        , primaryKeys = []
        , foreignKeys = {}
        , attrStr = []

      for (var attr in attributes) {
        if (attributes.hasOwnProperty(attr)) {
          var dataType = attributes[attr]

          if (Utils._.includes(dataType, 'PRIMARY KEY')) {
            primaryKeys.push(attr)
            attrStr.push(this.quoteIdentifier(attr) + " " + dataType.replace(/PRIMARY KEY/, ''))
          } else if (Utils._.includes(dataType, 'REFERENCES')) {
            // MySQL doesn't support inline REFERENCES declarations: move to the end
            var m = dataType.match(/^(.+) (REFERENCES.*)$/)
            attrStr.push(this.quoteIdentifier(attr) + " " + m[1])
            foreignKeys[attr] = m[2]
          } else {
            attrStr.push(this.quoteIdentifier(attr) + " " + dataType)
          }
        }
      }

      var values = {
        table: this.quoteIdentifier(tableName),
        attributes: attrStr.join(", "),
        comment: options.comment && Utils._.isString(options.comment) ? " COMMENT " + this.escape(options.comment) : "",
        engine: options.engine,
        charset: (options.charset ? "DEFAULT CHARSET=" + options.charset : ""),
        collation: (options.collate ? "COLLATE " + options.collate : "")
      }
      , pkString = primaryKeys.map(function(pk) { return this.quoteIdentifier(pk) }.bind(this)).join(", ")

      if (pkString.length > 0) {
        values.attributes += ", PRIMARY KEY (" + pkString + ")"
      }

      for (var fkey in foreignKeys) {
        if(foreignKeys.hasOwnProperty(fkey)) {
          values.attributes += ", FOREIGN KEY (" + this.quoteIdentifier(fkey) + ") " + foreignKeys[fkey]
        }
      }

      return Utils._.template(query)(values).trim() + ";"
    },

    dropTableQuery: function(tableName, options) {
      options = options || {}

      var query = "DROP TABLE IF EXISTS <%= table %>;"

      return Utils._.template(query)({
        table: this.quoteIdentifier(tableName)
      })
    },

    renameTableQuery: function(before, after) {
      var query = "RENAME TABLE `<%= before %>` TO `<%= after %>`;"
      return Utils._.template(query)({ before: before, after: after })
    },

    showTablesQuery: function() {
      return 'SHOW TABLES;'
    },

    addColumnQuery: function(tableName, attributes) {
      var query      = "ALTER TABLE `<%= tableName %>` ADD <%= attributes %>;"
        , attrString = []

      for (var attrName in attributes) {
        var definition = attributes[attrName]

        attrString.push(Utils._.template('`<%= attrName %>` <%= definition %>')({
          attrName: attrName,
          definition: definition
        }))
      }

      return Utils._.template(query)({ tableName: tableName, attributes: attrString.join(', ') })
    },

    removeColumnQuery: function(tableName, attributeName) {
      var query = "ALTER TABLE `<%= tableName %>` DROP `<%= attributeName %>`;"
      return Utils._.template(query)({ tableName: tableName, attributeName: attributeName })
    },

    changeColumnQuery: function(tableName, attributes) {
      var query      = "ALTER TABLE `<%= tableName %>` CHANGE <%= attributes %>;"
      var attrString = []

      for (var attrName in attributes) {
        var definition = attributes[attrName]

        attrString.push(Utils._.template('`<%= attrName %>` `<%= attrName %>` <%= definition %>')({
          attrName: attrName,
          definition: definition
        }))
      }

      return Utils._.template(query)({ tableName: tableName, attributes: attrString.join(', ') })
    },

    renameColumnQuery: function(tableName, attrBefore, attributes) {
      var query      = "ALTER TABLE `<%= tableName %>` CHANGE <%= attributes %>;"
      var attrString = []

      for (var attrName in attributes) {
        var definition = attributes[attrName]

        attrString.push(Utils._.template('`<%= before %>` `<%= after %>` <%= definition %>')({
          before: attrBefore,
          after: attrName,
          definition: definition
        }))
      }

      return Utils._.template(query)({ tableName: tableName, attributes: attrString.join(', ') })
    },

    selectQuery: function(tableName, options, factory) {
      var table = null,
          joinQuery = ""

      options            = options || {}
      options.table      = table = Array.isArray(tableName) ? tableName.map(function(t) { return this.quoteIdentifier(t)}.bind(this)).join(", ") : this.quoteIdentifier(tableName)
      options.attributes = options.attributes && options.attributes.map(function(attr){
        if(Array.isArray(attr) && attr.length == 2) {
          return [attr[0], this.quoteIdentifier(attr[1])].join(' as ')
        } else {
          return attr.indexOf(Utils.TICK_CHAR) < 0 ? this.quoteIdentifiers(attr) : attr
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

      var query = "SELECT " + options.attributes + " FROM " + options.table
      query += joinQuery

      if (options.hasOwnProperty('where')) {
        options.where = this.getWhereConditions(options.where, tableName, factory)
        query += " WHERE " + options.where
      }

      if (options.group) {
        options.group = Array.isArray(options.group) ? options.group.map(function(t) { return this.quoteIdentifiers(t)}.bind(this)).join(', ') : this.quoteIdentifiers(options.group)
        query += " GROUP BY " + options.group
      }

      if (options.order) {
        query += " ORDER BY " + options.order
      }

      if (options.offset && !options.limit) {
        /*
         * If no limit is defined, our best bet is to use the max number of rows in a table. From the MySQL docs:
         * There is a limit of 2^32 (~4.295E+09) rows in a MyISAM table. If you build MySQL with the --with-big-tables option,
         * the row limitation is increased to (2^32)^2 (1.844E+19) rows.
         */
        query += " LIMIT " + options.offset + ", " + 18440000000000000000;
      } else if (options.limit && !(options.include && (options.limit === 1))) {
        if (options.offset) {
          query += " LIMIT " + options.offset + ", " + options.limit
        } else {
          query += " LIMIT " + options.limit
        }
      }

      query += ";"

      return query
    },

    insertQuery: function(tableName, attrValueHash) {
      attrValueHash = Utils.removeNullValuesFromHash(attrValueHash, this.options.omitNull)

      var table = this.quoteIdentifier(tableName)
      var attributes = Object.keys(attrValueHash).map(function(attr){return this.quoteIdentifier(attr)}.bind(this)).join(",")
      var values = Utils._.values(attrValueHash).map(function(v) { return this.escape(v) }.bind(this)).join(",")

      var query = "INSERT INTO " + table + " (" + attributes + ") VALUES (" + values + ");"

      return query
    },

    bulkInsertQuery: function(tableName, attrValueHashes) {
      var tuples = []

      Utils._.forEach(attrValueHashes, function(attrValueHash) {
        tuples.push("(" +
          Utils._.values(attrValueHash).map(function(v) { return this.escape(v) }.bind(this)).join(",") +
        ")")
      }.bind(this))

      var table      = this.quoteIdentifier(tableName)
      var attributes = Object.keys(attrValueHashes[0]).map(function(attr){return this.quoteIdentifier(attr)}.bind(this)).join(",")

      var query  = "INSERT INTO " + table + " (" + attributes + ") VALUES " + tuples.join(",") + ";"

      return query
    },

    updateQuery: function(tableName, attrValueHash, where, options) {
      attrValueHash = Utils.removeNullValuesFromHash(attrValueHash, this.options.omitNull, options)

      var values = []

      for (var key in attrValueHash) {
        var value  = attrValueHash[key]
          , _value = this.escape(value)

        values.push(this.quoteIdentifier(key) + "=" + _value)
      }

      var query = "UPDATE " + this.quoteIdentifier(tableName) +
                  " SET " + values.join(",") +
                  " WHERE " + this.getWhereConditions(where)

      return query
    },

    deleteQuery: function(tableName, where, options) {
      options = options || {}

      var table = this.quoteIdentifier(tableName)
      if (options.truncate === true) {
        // Truncate does not allow LIMIT and WHERE
        return "TRUNCATE " + table
      }

      where = this.getWhereConditions(where)
      var limit = ""

      if(Utils._.isUndefined(options.limit)) {
        options.limit = 1;
      }

      if(!!options.limit) {
        limit = " LIMIT " + this.escape(options.limit)
      }

      return "DELETE FROM " + table + " WHERE " + where + limit
    },

    bulkDeleteQuery: function(tableName, where, options) {
      options = options || {}

      var table = this.quoteIdentifier(tableName)
      where = this.getWhereConditions(where)

      var query = "DELETE FROM " + table + " WHERE " + where

      return query
    },

    incrementQuery: function (tableName, attrValueHash, where) {
      attrValueHash = Utils.removeNullValuesFromHash(attrValueHash, this.options.omitNull)

      var values = []

      for (var key in attrValueHash) {
        var value  = attrValueHash[key]
          , _value = this.escape(value)

        values.push(this.quoteIdentifier(key) + "=" + this.quoteIdentifier(key) + " + " + _value)
      }

      var table = this.quoteIdentifier(tableName)
      values = values.join(",")
      where = this.getWhereConditions(where)

      var query = "UPDATE " + table + " SET " + values + " WHERE " + where

      return query
    },

    addIndexQuery: function(tableName, attributes, options) {
      var transformedAttributes = attributes.map(function(attribute) {
        if(typeof attribute === 'string') {
          return attribute
        } else {
          var result = ""

          if (!attribute.attribute) {
            throw new Error('The following index attribute has no attribute: ' + util.inspect(attribute))
          }

          result += attribute.attribute

          if (attribute.length) {
            result += '(' + attribute.length + ')'
          }

          if (attribute.order) {
            result += ' ' + attribute.order
          }

          return result
        }
      }.bind(this))

      var onlyAttributeNames = attributes.map(function(attribute) {
        return (typeof attribute === 'string') ? attribute : attribute.attribute
      }.bind(this))

      options = Utils._.extend({
        indicesType: null,
        indexName: Utils._.underscored(tableName + '_' + onlyAttributeNames.join('_')),
        parser: null
      }, options || {})

      return Utils._.compact([
        "CREATE", options.indicesType, "INDEX", options.indexName,
        (options.indexType ? ('USING ' + options.indexType) : undefined),
        "ON", tableName, '(' + transformedAttributes.join(', ') + ')',
        (options.parser ? "WITH PARSER " + options.parser : undefined)
      ]).join(' ')
    },

    showIndexQuery: function(tableName, options) {
      var sql = "SHOW INDEX FROM <%= tableName %><%= options %>"
      return Utils._.template(sql)({
        tableName: tableName,
        options: (options || {}).database ? ' FROM ' + options.database : ''
      })
    },

    removeIndexQuery: function(tableName, indexNameOrAttributes) {
      var sql       = "DROP INDEX <%= indexName %> ON <%= tableName %>"
        , indexName = indexNameOrAttributes

      if (typeof indexName !== 'string') {
        indexName = Utils._.underscored(tableName + '_' + indexNameOrAttributes.join('_'))
      }

      return Utils._.template(sql)({ tableName: tableName, indexName: indexName })
    },

    getWhereConditions: function(smth, tableName, factory) {
      var result = null
        , where = {}

      if (Utils.isHash(smth)) {
        smth   = Utils.prependTableNameToHash(tableName, smth)
        result = this.hashToWhereConditions(smth)
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

    hashToWhereConditions: function(hash) {
      var result = []

      for (var key in hash) {
        var value = hash[key]

         //handle qualified key names
        var _key   = this.quoteIdentifiers(key)
          , _value = null

        if (Array.isArray(value)) {
          // is value an array?
          if (value.length === 0) { value = [null] }
          _value = "(" + value.map(function(v) { return this.escape(v) }.bind(this)).join(',') + ")"

          result.push([_key, _value].join(" IN "))
        } else if ((value) && (typeof value == 'object') && !(value instanceof Date)) {
          if (!!value.join) {
            //using as sentinel for join column => value
            _value = this.quoteIdentifiers(value.join)
            result.push([_key, _value].join("="))
          } else {
            for (var logic in value) {
              var logicResult = Utils.getWhereLogic(logic)
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
          _value = this.escape(value)
          result.push((_value == 'NULL') ? _key + " IS NULL" : [_key, _value].join("="))
        }
      }

      return result.join(" AND ")
    },

    attributesToSQL: function(attributes) {
      var result = {}

      for (var name in attributes) {
        var dataType = attributes[name]

        if (Utils.isHash(dataType)) {
          var template

          if (dataType.type.toString() === DataTypes.ENUM.toString()) {
            if (Array.isArray(dataType.values) && (dataType.values.length > 0)) {
              template = "ENUM(" + Utils._.map(dataType.values, function(value) {
                return this.escape(value)
              }.bind(this)).join(", ") + ")"
            } else {
              throw new Error('Values for ENUM haven\'t been defined.')
            }
          } else {
            template = dataType.type.toString();
          }

          if (dataType.hasOwnProperty('allowNull') && (!dataType.allowNull)) {
            template += " NOT NULL"
          }

          if (dataType.autoIncrement) {
            template += " auto_increment"
          }

          // Blobs/texts cannot have a defaultValue
          if (dataType.type !== "TEXT" && dataType.type._binary !== true && (dataType.defaultValue !== undefined) && (dataType.defaultValue != DataTypes.NOW)) {
            template += " DEFAULT " + this.escape(dataType.defaultValue)
          }

          if (dataType.unique) {
            template += " UNIQUE"
          }

          if (dataType.primaryKey) {
            template += " PRIMARY KEY"
          }

          if(dataType.references) {
            template += " REFERENCES " + this.quoteIdentifier(dataType.references)

            if(dataType.referencesKey) {
              template += " (" + this.quoteIdentifier(dataType.referencesKey) + ")"
            } else {
              template += " (" + this.quoteIdentifier('id') + ")"
            }

            if(dataType.onDelete) {
              template += " ON DELETE " + dataType.onDelete.toUpperCase()
            }

            if(dataType.onUpdate) {
              template += " ON UPDATE " + dataType.onUpdate.toUpperCase()
            }

          }

          if (dataType.comment && Utils._.isString(dataType.comment) && dataType.comment.length) {
            template += " COMMENT " + this.escape(dataType.comment)
          }

          result[name] = template
        } else {
          result[name] = dataType
        }
      }

      return result
    },

    findAutoIncrementField: function(factory) {
      var fields = []

      for (var name in factory.attributes) {
        if (factory.attributes.hasOwnProperty(name)) {
          var definition = factory.attributes[name]

          if (definition && (definition.indexOf('auto_increment') > -1)) {
            fields.push(name)
          }
        }
      }

      return fields
    },

    enableForeignKeyConstraintsQuery: function() {
      var sql = "SET FOREIGN_KEY_CHECKS = 1;"
      return Utils._.template(sql, {})
    },

    disableForeignKeyConstraintsQuery: function() {
      var sql = "SET FOREIGN_KEY_CHECKS = 0;"
      return Utils._.template(sql, {})
    },

    quoteIdentifier: function(identifier, force) {
      return Utils.addTicks(identifier, "`")
    },

    quoteIdentifiers: function(identifiers, force) {
      return identifiers.split('.').map(function(v) { return this.quoteIdentifier(v, force) }.bind(this)).join('.')
    },

    escape: function(value) {
      return SqlString.escape(value, false, null, "mysql")
    }

  }

  return Utils._.extend(Utils._.clone(require("../query-generator")), QueryGenerator)
})()
