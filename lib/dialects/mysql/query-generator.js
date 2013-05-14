var Utils     = require("../../utils")
  , DataTypes = require("../../data-types")
  , util      = require("util")

var processAndEscapeValue = function(value) {
  var processedValue = value
  if (value instanceof Date) {
    processedValue = Utils.toSqlDate(value)
  } else if (typeof value === 'boolean') {
    processedValue = value ? 1 : 0
  }
  return Utils.escape(processedValue)
}

module.exports = (function() {
  var QueryGenerator = {
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

      return QueryGenerator.addQuotes(schema + (!schemaDelimiter ? '.' : schemaDelimiter) + tableName)
    },

    createSchema: function() {
      var query = "SHOW TABLES"
      return Utils._.template(query)({})
    },

    dropSchema: function() {
      var query = "SHOW TABLES"
      return Utils._.template(query)({})
    },

    showSchemasQuery: function() {
      return "SHOW TABLES"
    },

    createTableQuery: function(tableName, attributes, options) {
      options = Utils._.extend({
        engine: 'InnoDB',
        charset: null
      }, options || {})

      var query   = "CREATE TABLE IF NOT EXISTS <%= table %> (<%= attributes%>) ENGINE=<%= engine %> <%= charset %>"
        , primaryKeys = []
        , foreignKeys = {}
        , attrStr = []

      for (var attr in attributes) {
        if (attributes.hasOwnProperty(attr)) {
          var dataType = attributes[attr]

          if (Utils._.includes(dataType, 'PRIMARY KEY')) {
            primaryKeys.push(attr)
            attrStr.push(QueryGenerator.addQuotes(attr) + " " + dataType.replace(/PRIMARY KEY/, ''))
          } else if (Utils._.includes(dataType, 'REFERENCES')) {
            // MySQL doesn't support inline REFERENCES declarations: move to the end
            var m = dataType.match(/^(.+) (REFERENCES.*)$/)
            attrStr.push(QueryGenerator.addQuotes(attr) + " " + m[1])
            foreignKeys[attr] = m[2]
          } else {
            attrStr.push(QueryGenerator.addQuotes(attr) + " " + dataType)
          }
        }
      }

      var values = {
        table: QueryGenerator.addQuotes(tableName),
        attributes: attrStr.join(", "),
        engine: options.engine,
        charset: (options.charset ? "DEFAULT CHARSET=" + options.charset : "")
      }
      , pkString = primaryKeys.map(function(pk) { return QueryGenerator.addQuotes(pk) }).join(", ")

      if (pkString.length > 0) {
        values.attributes += ", PRIMARY KEY (" + pkString + ")"
      }

      for (var fkey in foreignKeys) {
        if(foreignKeys.hasOwnProperty(fkey)) {
          values.attributes += ", FOREIGN KEY (" + QueryGenerator.addQuotes(fkey) + ") " + foreignKeys[fkey]
        }
      }

      return Utils._.template(query)(values).trim() + ";"
    },

    dropTableQuery: function(tableName, options) {
      options = options || {}

      var query = "DROP TABLE IF EXISTS <%= table %>;"

      return Utils._.template(query)({
        table: QueryGenerator.addQuotes(tableName)
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

    selectQuery: function(tableName, options) {
      var table = null,
          joinQuery = ""

      options            = options || {}
      options.table      = table = Array.isArray(tableName) ? tableName.map(function(tbl){ return QueryGenerator.addQuotes(tbl) }).join(", ") : QueryGenerator.addQuotes(tableName)
      options.attributes = options.attributes && options.attributes.map(function(attr){
        if(Array.isArray(attr) && attr.length == 2) {
          return [attr[0], QueryGenerator.addQuotes(attr[1])].join(' as ')
        } else {
          return attr.indexOf(Utils.TICK_CHAR) < 0 ? QueryGenerator.addQuotes(attr) : attr
        }
      }).join(", ")
      options.attributes = options.attributes || '*'

      if (options.include) {
        var optAttributes = [options.table + '.*']

        options.include.forEach(function(include) {
          var attributes = Object.keys(include.daoFactory.attributes).map(function(attr) {
            return "`" + include.as + "`.`" + attr + "` AS `" + include.as + "." + attr + "`"
          })

          optAttributes = optAttributes.concat(attributes)

          var table = include.daoFactory.tableName
          var as = include.as
          var tableLeft = ((include.association.associationType === 'BelongsTo') ? include.as : tableName)
          var attrLeft = 'id'
          var tableRight = ((include.association.associationType === 'BelongsTo') ? tableName : include.as)
          var attrRight = include.association.identifier
          joinQuery += " LEFT OUTER JOIN `" + table + "` AS `" + as + "` ON `" + tableLeft + "`.`" + attrLeft + "` = `" + tableRight + "`.`" + attrRight + "`"

        })

        options.attributes = optAttributes.join(', ')
      }

      var query = "SELECT " + options.attributes + " FROM " + options.table
      query += joinQuery

      if (options.hasOwnProperty('where')) {
        options.where = this.getWhereConditions(options.where, tableName)
        query += " WHERE " + options.where
      }

      if (options.group) {
        options.group = Array.isArray(options.group) ? options.group.map(function(grp){return QueryGenerator.addQuotes(grp)}).join(', ') : QueryGenerator.addQuotes(options.group)
        query += " GROUP BY " + options.group
      }

      if (options.order) {
        query += " ORDER BY " + options.order
      }


      if (options.limit && !(options.include && (options.limit === 1))) {
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

      var table = QueryGenerator.addQuotes(tableName)
      var attributes = Object.keys(attrValueHash).map(function(attr){return QueryGenerator.addQuotes(attr)}).join(",")
      var values = Utils._.values(attrValueHash).map(processAndEscapeValue).join(",")

      var query = "INSERT INTO " + table + " (" + attributes + ") VALUES (" + values + ");"

      return query
    },

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

    deleteQuery: function(tableName, where, options) {
      options = options || {}

      var table = QueryGenerator.addQuotes(tableName)
      where = QueryGenerator.getWhereConditions(where)
      var limit = ""

      if(Utils._.isUndefined(options.limit)) {
        options.limit = 1;
      }

      if(!!options.limit) {
        limit = " LIMIT " + Utils.escape(options.limit)
      }

      var query = "DELETE FROM " + table + " WHERE " + where + limit

      return query
    },

    bulkDeleteQuery: function(tableName, where, options) {
      options = options || {}

      var table = QueryGenerator.addQuotes(tableName)
      where = QueryGenerator.getWhereConditions(where)

      var query = "DELETE FROM " + table + " WHERE " + where

      return query
    },

    incrementQuery: function (tableName, attrValueHash, where) {
      attrValueHash = Utils.removeNullValuesFromHash(attrValueHash, this.options.omitNull)

      var values = []

      for (var key in attrValueHash) {
        var value  = attrValueHash[key]
          , _value = processAndEscapeValue(value)

        values.push(QueryGenerator.addQuotes(key) + "=" + QueryGenerator.addQuotes(key) + " + " + _value)
      }

      var table = QueryGenerator.addQuotes(tableName)
      values = values.join(",")
      where = QueryGenerator.getWhereConditions(where)

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
      })

      var onlyAttributeNames = attributes.map(function(attribute) {
        return (typeof attribute === 'string') ? attribute : attribute.attribute
      })

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

    getWhereConditions: function(smth, tableName) {
      var result = null

      if (Utils.isHash(smth)) {
        smth   = Utils.prependTableNameToHash(tableName, smth)
        result = this.hashToWhereConditions(smth)
      } else if (typeof smth === 'number') {
        smth   = Utils.prependTableNameToHash(tableName, { id: smth })
        result = this.hashToWhereConditions(smth)
      } else if (typeof smth === "string") {
        result = smth
      } else if (Array.isArray(smth)) {
        result = Utils.format(smth)
      }

      return result ? result : '1=1'
    },

    hashToWhereConditions: function(hash) {
      var result = []

      for (var key in hash) {
        var value = hash[key]

         //handle qualified key names
        var _key   = key.split('.').map(function(col){return QueryGenerator.addQuotes(col)}).join(".")
          , _value = null

        if (Array.isArray(value)) {
          // is value an array?
          if (value.length === 0) { value = [null] }
          _value = "(" + value.map(processAndEscapeValue).join(',') + ")"

          result.push([_key, _value].join(" IN "))
        } else if ((value) && (typeof value == 'object') && !(value instanceof Date)) {
          // is value an object?

          //using as sentinel for join column => value
          _value = value.join.split('.').map(function(col){ return QueryGenerator.addQuotes(col) }).join(".")
          result.push([_key, _value].join("="))
        } else {
          _value = processAndEscapeValue(value)
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
                return Utils.escape(value)
              }).join(", ") + ")"
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

          if ((dataType.defaultValue !== undefined) && (dataType.defaultValue != DataTypes.NOW)) {
            template += " DEFAULT " + Utils.escape(dataType.defaultValue)
          }

          if (dataType.unique) {
            template += " UNIQUE"
          }

          if (dataType.primaryKey) {
            template += " PRIMARY KEY"
          }

          if(dataType.references) {
            template += " REFERENCES " + Utils.addTicks(dataType.references)


            if(dataType.referencesKey) {
              template += " (" + Utils.addTicks(dataType.referencesKey) + ")"
            } else {
              template += " (" + Utils.addTicks('id') + ")"
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

    addQuotes: function(s, quoteChar) {
      return Utils.addTicks(s, quoteChar)
    },

    removeQuotes: function(s, quoteChar) {
      return Utils.removeTicks(s, quoteChar)
    }
  }

  return Utils._.extend(Utils._.clone(require("../query-generator")), QueryGenerator)
})()
