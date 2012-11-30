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
            attrStr.push(Utils.addTicks(attr) + " " + dataType.replace(/PRIMARY KEY/, ''))
          } else {
            attrStr.push(Utils.addTicks(attr) + " " + dataType)
          }
        }
      }

      var values = {
        table: Utils.addTicks(tableName),
        attributes: attrStr.join(", "),
        engine: options.engine,
        charset: (options.charset ? "DEFAULT CHARSET=" + options.charset : "")
      }
      , pkString = primaryKeys.map(function(pk) { return Utils.addTicks(pk) }).join(", ")

      if(pkString.length > 0) {
        values.attributes += ", PRIMARY KEY (" + pkString + ")"
      }

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
      options.table      = table = Array.isArray(tableName) ? tableName.map(function(tbl){ return Utils.addTicks(tbl) }).join(", ") : Utils.addTicks(tableName)
      options.attributes = options.attributes && options.attributes.map(function(attr){
        if(Array.isArray(attr) && attr.length == 2) {
          return [attr[0], Utils.addTicks(attr[1])].join(' as ')
        } else {
          return attr.indexOf(Utils.TICK_CHAR) < 0 ? Utils.addTicks(attr) : attr
        }
      }).join(", ")
      options.attributes = options.attributes || '*'

      if (options.include) {
        var optAttributes = [options.table + '.*']

        for (var daoName in options.include) {
          if (options.include.hasOwnProperty(daoName)) {
            var dao         = options.include[daoName]
              , daoFactory  = dao.daoFactoryManager.getDAO(tableName, {
                  attribute: 'tableName'
                })
              , _tableName  = Utils.addTicks(dao.tableName)
              , association = dao.getAssociation(daoFactory)

            if (association.connectorDAO) {
              var foreignIdentifier = Utils._.keys(association.connectorDAO.rawAttributes).filter(function(attrName) {
                return (!!attrName.match(/.+Id$/) || !!attrName.match(/.+_id$/)) && (attrName !== association.identifier)
              })[0]

              query += ' LEFT OUTER JOIN ' + Utils.addTicks(association.connectorDAO.tableName) + ' ON '
              query += Utils.addTicks(association.connectorDAO.tableName) + '.'
              query += Utils.addTicks(foreignIdentifier) + '='
              query += Utils.addTicks(table) + '.' + Utils.addTicks('id')

              query += ' LEFT OUTER JOIN ' + Utils.addTicks(dao.tableName) + ' ON '
              query += Utils.addTicks(dao.tableName) + '.'
              query += Utils.addTicks('id') + '='
              query += Utils.addTicks(association.connectorDAO.tableName) + '.' + Utils.addTicks(association.identifier)
            } else {
              query += ' LEFT OUTER JOIN ' + Utils.addTicks(dao.tableName) + ' ON '
              query += Utils.addTicks(association.associationType === 'BelongsTo' ? dao.tableName : tableName) + '.'
              query += Utils.addTicks(association.identifier) + '='
              query += Utils.addTicks(association.associationType === 'BelongsTo' ? tableName : dao.tableName) + '.' + Utils.addTicks('id')
            }

            var aliasAssoc = daoFactory.getAssociationByAlias(daoName)
              , aliasName  = !!aliasAssoc ? Utils.addTicks(daoName) : _tableName

            optAttributes = optAttributes.concat(
              Utils._.keys(dao.attributes).map(function(attr) {
                return '' +
                  [_tableName, Utils.addTicks(attr)].join('.') +
                  ' AS ' +
                  Utils.addTicks([aliasName, attr].join('.'))
              })
            )
          }
        }

        options.attributes = optAttributes.join(', ')
      }

      if(options.where) {
        options.where = this.getWhereConditions(options.where, tableName)
        query += " WHERE <%= where %>"
      }

      if(options.group) {
        options.group = Utils.addTicks(options.group)
        query += " GROUP BY <%= group %>"
      }

      if(options.order) {
        query += " ORDER BY <%= order %>"
      }


      if(options.limit && !(options.include && (options.limit === 1))) {
        if(options.offset) {
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
        table: Utils.addTicks(tableName),
        attributes: Utils._.keys(attrValueHash).map(function(attr){return Utils.addTicks(attr)}).join(","),
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

        values.push(Utils.addTicks(key) + "=" + Utils.escape(_value))
      }

      var replacements = {
        table: Utils.addTicks(tableName),
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

    getWhereConditions: function(smth, tableName) {
      var result = null

      if(Utils.isHash(smth)) {
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
        var _key   = key.split('.').map(function(col){return Utils.addTicks(col)}).join(".")
          , _value = null

        if (Array.isArray(value)) {
          // is value an array?
          if(value.length == 0) { value = [null] }
          _value = "(" + value.map(function(subValue) {
            return Utils.escape(subValue);
          }).join(',') + ")"

          result.push([_key, _value].join(" IN "))
        } else if ((value) && (typeof value == 'object')) {
          // is value an object?

          //using as sentinel for join column => value
          _value = value.join.split('.').map(function(col){ return Utils.addTicks(col) }).join(".")
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

        if(Utils.isHash(dataType)) {
          var template     = "<%= type %>"
            , replacements = { type: dataType.type }

          if(dataType.hasOwnProperty('allowNull') && (!dataType.allowNull)) {
            template += " NOT NULL"
          }

          if(dataType.autoIncrement) {
            template += " auto_increment"
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
    }
  }

  return Utils._.extend(Utils._.clone(require("../query-generator")), QueryGenerator)
})()
