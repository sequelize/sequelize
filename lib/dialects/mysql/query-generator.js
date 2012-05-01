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
        , attrStr = Utils._.map(attributes, function(dataType, attr) {
            var dt = dataType
            if (Utils._.includes(dt, 'PRIMARY KEY')) {
              primaryKeys.push(attr)
              return Utils.addTicks(attr) + " " + dt.replace(/PRIMARY KEY/, '')
            } else {
              return Utils.addTicks(attr) + " " + dt
            }
          }).join(", ")
        , values  = {
            table: Utils.addTicks(tableName),
            attributes: attrStr,
            engine: options.engine,
            charset: (options.charset ? "DEFAULT CHARSET=" + options.charset : "")
          }
        , pkString = primaryKeys.map(function(pk) {return Utils.addTicks(pk)}).join(", ")

      if(pkString.length > 0) values.attributes += ", PRIMARY KEY (" + pkString + ")"

      return Utils._.template(query)(values).trim() + ";"
    },

    dropTableQuery: function(tableName, options) {
      options = options || {}

      var query = "DROP TABLE IF EXISTS <%= table %>;"

      return Utils._.template(query)({table: Utils.addTicks(tableName)})
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
        , attrString = Utils._.map(attributes, function(definition, attributeName) {
            return Utils._.template('`<%= attributeName %>` <%= definition %>')({
              attributeName: attributeName,
              definition: definition
            })
          }).join(', ')

      return Utils._.template(query)({ tableName: tableName, attributes: attrString })
    },

    removeColumnQuery: function(tableName, attributeName) {
      var query = "ALTER TABLE `<%= tableName %>` DROP `<%= attributeName %>`;"
      return Utils._.template(query)({ tableName: tableName, attributeName: attributeName })
    },

    changeColumnQuery: function(tableName, attributes) {
      var query      = "ALTER TABLE `<%= tableName %>` CHANGE <%= attributes %>;"
      var attrString = Utils._.map(attributes, function(definition, attributeName) {
        return Utils._.template('`<%= attributeName %>` `<%= attributeName %>` <%= definition %>')({
          attributeName: attributeName,
          definition: definition
        })
      }).join(', ')

      return Utils._.template(query)({ tableName: tableName, attributes: attrString })
    },

    renameColumnQuery: function(tableName, attrBefore, attributes) {
      var query      = "ALTER TABLE `<%= tableName %>` CHANGE <%= attributes %>;"
      var attrString = Utils._.map(attributes, function(definition, attributeName) {
        return Utils._.template('`<%= before %>` `<%= after %>` <%= definition %>')({
          before: attrBefore,
          after: attributeName,
          definition: definition
        })
      }).join(', ')

      return Utils._.template(query)({ tableName: tableName, attributes: attrString })
    },

    selectQuery: function(tableName, options) {
      options = options || {}
      options.table = Array.isArray(tableName) ? tableName.map(function(tbl){return Utils.addTicks(tbl)}).join(", ") : Utils.addTicks(tableName)
      options.attributes = options.attributes && options.attributes.map(function(attr){
        if(Array.isArray(attr) && attr.length == 2)
          return [attr[0], Utils.addTicks(attr[1])].join(' as ')
        else
          return attr.indexOf(Utils.TICK_CHAR)<0 ? Utils.addTicks(attr) : attr
      }).join(", ")

      options.attributes = options.attributes || '*'

      var query = "SELECT <%= attributes %> FROM <%= table %>"

      if(options.where) {
        options.where = QueryGenerator.getWhereConditions(options.where)
        query += " WHERE <%= where %>"
      }
      if(options.order) query += " ORDER BY <%= order %>"
      if(options.group) {
        options.group = Utils.addTicks(options.group)
        query += " GROUP BY <%= group %>"
      }
      if(options.limit) {
        if(options.offset) query += " LIMIT <%= offset %>, <%= limit %>"
        else query += " LIMIT <%= limit %>"
      }

      query += ";"

      return Utils._.template(query)(options)
    },

    insertQuery: function(tableName, attrValueHash) {
      var query = "INSERT INTO <%= table %> (<%= attributes %>) VALUES (<%= values %>);"

      var replacements  = {
        table: Utils.addTicks(tableName),
        attributes: Utils._.keys(attrValueHash).map(function(attr){return Utils.addTicks(attr)}).join(","),
        values: Utils._.values(attrValueHash).map(function(value){
          return Utils.escape((value instanceof Date) ? Utils.toSqlDate(value) : value)
        }).join(",")
      }

      return Utils._.template(query)(replacements)
    },

    updateQuery: function(tableName, values, where) {
      var query = "UPDATE <%= table %> SET <%= values %> WHERE <%= where %>"
      var replacements = {
        table: Utils.addTicks(tableName),
        values: Utils._.map(values, function(value, key){
          return Utils.addTicks(key) + "=" + Utils.escape((value instanceof Date) ? Utils.toSqlDate(value) : value)
        }).join(","),
        where: QueryGenerator.getWhereConditions(where)
      }

      return Utils._.template(query)(replacements)
    },

    deleteQuery: function(tableName, where, options) {
      options = options || {}
      options.limit = options.limit || 1

      var query = "DELETE FROM <%= table %> WHERE <%= where %> LIMIT <%= limit %>"
      var replacements = {
        table: Utils.addTicks(tableName),
        where: QueryGenerator.getWhereConditions(where),
        limit: Utils.escape(options.limit)
      }

      return Utils._.template(query)(replacements)
    },

    addIndexQuery: function(tableName, attributes, options) {
      var transformedAttributes = attributes.map(function(attribute) {
        if(typeof attribute == 'string')
          return attribute
        else {
          var result = ""

          if(!attribute.attribute)
            throw new Error('The following index attribute has no attribute: ' + util.inspect(attribute))

          result += attribute.attribute

          if(attribute.length)
            result += '(' + attribute.length + ')'

          if(attribute.order)
            result += ' ' + attribute.order

          return result
        }
      })

      var onlyAttributeNames = attributes.map(function(attribute) {
        return (typeof attribute == 'string') ? attribute : attribute.attribute
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

      if(typeof indexName != 'string')
        indexName = Utils._.underscored(tableName + '_' + indexNameOrAttributes.join('_'))

      return Utils._.template(sql)({ tableName: tableName, indexName: indexName })
    },

    getWhereConditions: function(smth) {
      var result = null

      if(Utils.isHash(smth))
        result = QueryGenerator.hashToWhereConditions(smth)
      else if(typeof smth == 'number')
        result = Utils.addTicks('id') + "=" + Utils.escape(smth)
      else if(typeof smth == "string")
        result = smth
      else if(Array.isArray(smth))
        result = Utils.format(smth)

      return result
    },

    hashToWhereConditions: function(hash) {
      return Utils._.map(hash, function(value, key) {
         //handle qualified key names
        var _key   = key.split('.').map(function(col){return Utils.addTicks(col)}).join(".")
          , _value = null

      if(Array.isArray(value)) {
          _value = "(" + Utils._.map(value, function(subvalue) {
            return Utils.escape(subvalue);
          }).join(',') + ")"

          return [_key, _value].join(" IN ")
      }
      else if ((value) && (typeof value == 'object')) {
        //using as sentinel for join column => value
        _value = value.join.split('.').map(function(col){return Utils.addTicks(col)}).join(".")
        return [_key, _value].join("=")
      } else {
          _value = Utils.escape(value)
          return (_value == 'NULL') ? _key + " IS NULL" : [_key, _value].join("=")
        }
      }).join(" AND ")
    },

    attributesToSQL: function(attributes) {
      var result = {}

      Utils._.map(attributes, function(dataType, name) {
        if(Utils.isHash(dataType)) {
          var template     = "<%= type %>"
            , replacements = { type: dataType.type }

          if(dataType.hasOwnProperty('allowNull') && (!dataType.allowNull)) {
            template += " NOT NULL"
          }

          if(dataType.autoIncrement) {
            template +=" auto_increment"
          }

          if((dataType.defaultValue != undefined) && (dataType.defaultValue != DataTypes.NOW)) {
            template += " DEFAULT <%= defaultValue %>"
            replacements.defaultValue = Utils.escape(dataType.defaultValue)
          }

          if(dataType.unique) {
            template += " UNIQUE"
          }

          if(dataType.primaryKey) {
            template += " PRIMARY KEY"
          }

          result[name] = Utils._.template(template)(replacements)
        } else {
          result[name] = dataType
        }
      })

      return result
    },

    findAutoIncrementField: function(factory) {
      var fields = Utils._.map(factory.attributes, function(definition, name) {
        var isAutoIncrementField = (definition && (definition.indexOf('auto_increment') > -1))
        return isAutoIncrementField ? name : null
      })

      return Utils._.compact(fields)
    }
  }

  return Utils._.extend(Utils._.clone(require("../query-generator")), QueryGenerator)
})()
