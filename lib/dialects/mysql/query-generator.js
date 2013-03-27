var Utils     = require("../../utils")
  , DataTypes = require("../../data-types")
  , util      = require("util")

module.exports = (function() {
  var QueryGenerator = {
    createTableQuery: function(tableName, attributes, options) {
      options = Utils._.extend({
        engine: 'InnoDB',
        charset: null
      }, options || {})

      var query   = "CREATE TABLE IF NOT EXISTS <%= table %> (<%= attributes%>) ENGINE=<%= engine %> <%= charset %>"
        , primaryKeys = []
        , attrStr = []

      for (var attr in attributes) {
        if (attributes.hasOwnProperty(attr)) {
          var dataType = attributes[attr]

          if (Utils._.includes(dataType, 'PRIMARY KEY')) {
            primaryKeys.push(attr)
            attrStr.push(QueryGenerator.addQuotes(attr) + " " + dataType.replace(/PRIMARY KEY/, ''))
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

      for (attrName in attributes) {
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
      var query = "SELECT <%= attributes %> FROM <%= table %>"
        , table = null

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
            var template = Utils._.template("`<%= as %>`.`<%= attr %>` AS `<%= as %>.<%= attr %>`")
            return template({ as: include.as, attr: attr })
          })

          optAttributes = optAttributes.concat(attributes)

          var joinQuery = " LEFT OUTER JOIN `<%= table %>` AS `<%= as %>` ON `<%= tableLeft %>`.`<%= attrLeft %>` = `<%= tableRight %>`.`<%= attrRight %>`"
          query += Utils._.template(joinQuery)({
            table:      include.daoFactory.tableName,
            as:         include.as,
            tableLeft:  ((include.association.associationType === 'BelongsTo') ? include.as : tableName),
            attrLeft:   'id',
            tableRight: ((include.association.associationType === 'BelongsTo') ? tableName : include.as),
            attrRight:  include.association.identifier
          })
        })

        options.attributes = optAttributes.join(', ')
      }

      if (options.where) {
        options.where = this.getWhereConditions(options.where, tableName)
        query += " WHERE <%= where %>"
      }

      if (options.group) {
        options.group = Array.isArray(options.group) ? options.group.map(function(grp){return QueryGenerator.addQuotes(grp)}).join(', ') : QueryGenerator.addQuotes(options.group)
        query += " GROUP BY <%= group %>"
      }

      if (options.order) {
        query += " ORDER BY <%= order %>"
      }


      if (options.limit && !(options.include && (options.limit === 1))) {
        if (options.offset) {
          query += " LIMIT <%= offset %>, <%= limit %>"
        } else {
          query += " LIMIT <%= limit %>"
        }
      }

      query += ";"

      return Utils._.template(query)(options)
    },

    insertQuery: function(tableName, attrValueHash) {
      attrValueHash = Utils.removeNullValuesFromHash(attrValueHash, this.options.omitNull)

      var query = "INSERT INTO <%= table %> (<%= attributes %>) VALUES (<%= values %>);"

      var replacements  = {
        table: QueryGenerator.addQuotes(tableName),
        attributes: Object.keys(attrValueHash).map(function(attr){return QueryGenerator.addQuotes(attr)}).join(","),
        values: Utils._.values(attrValueHash).map(function(value){
          return Utils.escape((value instanceof Date) ? Utils.toSqlDate(value) : value)
        }).join(",")
      }

      return Utils._.template(query)(replacements)
    },

    updateQuery: function(tableName, attrValueHash, where) {
      attrValueHash = Utils.removeNullValuesFromHash(attrValueHash, this.options.omitNull)

      var query  = "UPDATE <%= table %> SET <%= values %> WHERE <%= where %>"
        , values = []

      for (var key in attrValueHash) {
        var value  = attrValueHash[key]
          , _value = (value instanceof Date) ? Utils.toSqlDate(value) : value

        values.push(QueryGenerator.addQuotes(key) + "=" + Utils.escape(_value))
      }

      var replacements = {
        table: QueryGenerator.addQuotes(tableName),
        values: values.join(","),
        where: QueryGenerator.getWhereConditions(where)
      }

      return Utils._.template(query)(replacements)
    },

    deleteQuery: function(tableName, where, options) {
      options = options || {}
      options.limit = options.limit || 1

      var query = "DELETE FROM <%= table %> WHERE <%= where %> LIMIT <%= limit %>"
      var replacements = {
        table: QueryGenerator.addQuotes(tableName),
        where: QueryGenerator.getWhereConditions(where),
        limit: Utils.escape(options.limit)
      }

      return Utils._.template(query)(replacements)
    },

    incrementQuery: function (tableName, attrValueHash, where) {
      attrValueHash = Utils.removeNullValuesFromHash(attrValueHash, this.options.omitNull)

      var query = "UPDATE <%= table %> SET <%= values %> WHERE <%= where %> "
        , values = []

      for (var key in attrValueHash) {
        var value  = attrValueHash[key]
          , _value = (value instanceof Date) ? Utils.toSqlDate(value) : value

        values.push(QueryGenerator.addQuotes(key) + "=" + QueryGenerator.addQuotes(key) + " + " +Utils.escape(_value))
      }

      var replacements = {
        table: QueryGenerator.addQuotes(tableName),
        values: values.join(","),
        where: QueryGenerator.getWhereConditions(where)
      }

      return Utils._.template(query)(replacements)
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

      return result
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
          if (value.length == 0) { value = [null] }
          _value = "(" + value.map(function(subValue) {
            return Utils.escape(subValue);
          }).join(',') + ")"

          result.push([_key, _value].join(" IN "))
        } else if ((value) && (typeof value == 'object')) {
          // is value an object?

          //using as sentinel for join column => value
          _value = value.join.split('.').map(function(col){ return QueryGenerator.addQuotes(col) }).join(".")
          result.push([_key, _value].join("="))
        } else {
          _value = Utils.escape(value)
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
          var template     = "<%= type %>"
            , replacements = { type: dataType.type }

          if (dataType.type.toString() === DataTypes.ENUM.toString()) {
            if (Array.isArray(dataType.values) && (dataType.values.length > 0)) {
              replacements.type = "ENUM(" + Utils._.map(dataType.values, function(value) {
                return Utils.escape(value)
              }).join(", ") + ")"
            } else {
              throw new Error('Values for ENUM haven\'t been defined.')
            }
          }

          if (dataType.hasOwnProperty('allowNull') && (!dataType.allowNull)) {
            template += " NOT NULL"
          }

          if (dataType.autoIncrement) {
            template += " auto_increment"
          }

          if ((dataType.defaultValue != undefined) && (dataType.defaultValue != DataTypes.NOW)) {
            template += " DEFAULT <%= defaultValue %>"
            replacements.defaultValue = Utils.escape(dataType.defaultValue)
          }

          if (dataType.unique) {
            template += " UNIQUE"
          }

          if (dataType.primaryKey) {
            template += " PRIMARY KEY"
          }

          result[name] = Utils._.template(template)(replacements)
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

    addQuotes: function(s, quoteChar) {
      return Utils.addTicks(s, quoteChar)
    },

    removeQuotes: function(s, quoteChar) {
      return Utils.removeTicks(s, quoteChar)
    }
  }

  return Utils._.extend(Utils._.clone(require("../query-generator")), QueryGenerator)
})()
