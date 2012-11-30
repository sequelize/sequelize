var Utils = require("../../utils")
  , util  = require("util")
  , tables = {}
  , primaryKeys = {};

function removeQuotes(s, quoteChar) {
  quoteChar = quoteChar || '"'
  return s.replace(new RegExp(quoteChar, 'g'), '')
}

function addQuotes(s, quoteChar) {
  quoteChar = quoteChar || '"'
  return removeQuotes(s, quoteChar)
    .split('.')
    .map(function(e) { return quoteChar + String(e) + quoteChar })
    .join('.')
}

function pgEscape(val) {
  if (val === undefined || val === null) {
    return 'NULL';
  }

  switch (typeof val) {
    case 'boolean': return (val) ? 'true' : 'false';
    case 'number': return val+'';
  }

  if (val instanceof Date) {
    val = pgSqlDate(val);
  }

  // http://www.postgresql.org/docs/8.2/static/sql-syntax-lexical.html#SQL-SYNTAX-STRINGS
  val = val.replace(/'/g, "''");
  return "'"+val+"'";
}

function padInt(i) {
  return (i < 10) ? '0' + i.toString() : i.toString()
}
function pgSqlDate(dt) {
  var date = [ dt.getUTCFullYear(), padInt(dt.getUTCMonth()+1), padInt(dt.getUTCDate()) ].join('-')
  var time = [ dt.getUTCHours(), padInt(dt.getUTCMinutes()), padInt(dt.getUTCSeconds())].join(':')
  return date + ' ' + time + '.' + ((dt.getTime() % 1000) * 1000)
}

function pgDataTypeMapping(tableName, attr, dataType) {
  if (Utils._.includes(dataType, 'PRIMARY KEY')) {
    primaryKeys[tableName].push(attr)
    dataType = dataType.replace(/PRIMARY KEY/, '')
  }

  if (Utils._.includes(dataType, 'TINYINT(1)')) {
    dataType = dataType.replace(/TINYINT\(1\)/, 'BOOLEAN')
  }

  if (Utils._.includes(dataType, 'DATETIME')) {
    dataType = dataType.replace(/DATETIME/, 'TIMESTAMP')
  }

  if (Utils._.includes(dataType, 'SERIAL')) {
    dataType = dataType.replace(/INTEGER/, '')
    dataType = dataType.replace(/NOT NULL/, '')
    tables[tableName][attr] = 'serial'
  }

  return dataType
}

module.exports = (function() {
  var QueryGenerator = {
    options: {},

    createTableQuery: function(tableName, attributes, options) {
      options = Utils._.extend({
      }, options || {})

      primaryKeys[tableName] = []
      tables[tableName] = {}

      var query   = "CREATE TABLE IF NOT EXISTS <%= table %> (<%= attributes%>)"
        , attrStr = []

      for (var attr in attributes) {
        var dataType = pgDataTypeMapping(tableName, attr, attributes[attr])
        attrStr.push(addQuotes(attr) + " " + dataType)
      }

      var values  = {
        table: addQuotes(tableName),
        attributes: attrStr.join(", "),
      }

      var pks = primaryKeys[tableName].map(function(pk){ return addQuotes(pk) }).join(",")
      if (pks.length > 0) {
        values.attributes += ", PRIMARY KEY (" + pks + ")"
      }

      return Utils._.template(query)(values).trim() + ";"
    },

    dropTableQuery: function(tableName, options) {
      options = options || {}
      var query = "DROP TABLE IF EXISTS <%= table %>;"
      return Utils._.template(query)({ table: addQuotes(tableName) })
    },

    renameTableQuery: function(before, after) {
      var query = "ALTER TABLE <%= before %> RENAME TO <%= after %>;"
      return Utils._.template(query)({ before: addQuotes(before), after: addQuotes(after) })
    },

    showTablesQuery: function() {
      return "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';"
    },

    describeTableQuery: function(tableName) {
      var query = 'SELECT column_name as "Field", column_default as "Default", is_nullable as "Null", data_type as "Type" FROM information_schema.columns WHERE table_name = <%= table %>;'
      return Utils._.template(query)({ table: addQuotes(tableName, "'") })
    },

    addColumnQuery: function(tableName, attributes) {
      var query      = "ALTER TABLE <%= tableName %> ADD COLUMN <%= attributes %>;"
        , attrString = []

      for (var attrName in attributes) {
        var definition = attributes[attrName]

        attrString.push(Utils._.template('<%= attrName %> <%= definition %>')({
          attrName: addQuotes(attrName),
          definition: pgDataTypeMapping(tableName, attrName, definition)
        }))
      }

      return Utils._.template(query)({ tableName: addQuotes(tableName), attributes: attrString.join(', ') })
    },

    removeColumnQuery: function(tableName, attributeName) {
      var query = "ALTER TABLE <%= tableName %> DROP COLUMN <%= attributeName %>;"
      return Utils._.template(query)({ tableName: addQuotes(tableName), attributeName: addQuotes(attributeName) })
    },

    changeColumnQuery: function(tableName, attributes) {
      var query = "ALTER TABLE <%= tableName %> ALTER COLUMN <%= query %>;"
        , sql   = []

      for (var attributeName in attributes) {
        var definition = attributes[attributeName]
        var attrSql = ''

        if (definition.indexOf('NOT NULL') > 0) {
          attrSql += Utils._.template(query)({
            tableName: addQuotes(tableName),
            query: addQuotes(attributeName) + ' SET NOT NULL'
          })
          definition = definition.replace('NOT NULL', '').trim()
        } else {
          attrSql += Utils._.template(query)({
            tableName: addQuotes(tableName),
            query: addQuotes(attributeName) + ' DROP NOT NULL'
          })
        }

        attrSql += Utils._.template(query)({
          tableName: addQuotes(tableName),
          query: addQuotes(attributeName) + ' TYPE ' + definition
        })

        sql.push(attrSql)
      }

      return sql.join('')
    },

    renameColumnQuery: function(tableName, attrBefore, attributes) {
      var query      = "ALTER TABLE <%= tableName %> RENAME COLUMN <%= attributes %>;"
      var attrString = []

      for (var attributeName in attributes) {
        attrString.push(Utils._.template('<%= before %> TO <%= after %>')({
          before: addQuotes(attrBefore),
          after: addQuotes(attributeName),
        }))
      }

      return Utils._.template(query)({ tableName: addQuotes(tableName), attributes: attrString.join(', ') })
    },

    selectQuery: function(tableName, options) {
      var query = "SELECT <%= attributes %> FROM <%= table %>"
        , table = null

      options = options || {}
      options.table = table = Array.isArray(tableName) ? tableName.map(function(t){return addQuotes(t);}).join(", ") : addQuotes(tableName)
      options.attributes = options.attributes && options.attributes.map(function(attr){
        if(Array.isArray(attr) && attr.length == 2) {
          return [attr[0], addQuotes(removeQuotes(attr[1], '`'))].join(' as ')
        } else if (attr.indexOf('`') >= 0) {
          return attr.replace(/`/g, '"')
        } else {
          return addQuotes(attr)
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
              , _tableName  = addQuotes(dao.tableName)
              , association = dao.getAssociation(daoFactory)

            if (association.connectorDAO) {
              var foreignIdentifier = Utils._.keys(association.connectorDAO.rawAttributes).filter(function(attrName) {
                return (!!attrName.match(/.+Id$/) || !!attrName.match(/.+_id$/)) && (attrName !== association.identifier)
              })[0]

              query += ' LEFT OUTER JOIN ' + addQuotes(association.connectorDAO.tableName) + ' ON '
              query += addQuotes(association.connectorDAO.tableName) + '.'
              query += addQuotes(foreignIdentifier) + '='
              query += addQuotes(table) + '.' + addQuotes('id')

              query += ' LEFT OUTER JOIN ' + addQuotes(dao.tableName) + ' ON '
              query += addQuotes(dao.tableName) + '.'
              query += addQuotes('id') + '='
              query += addQuotes(association.connectorDAO.tableName) + '.' + addQuotes(association.identifier)
            } else {
              query += ' LEFT OUTER JOIN ' + addQuotes(dao.tableName) + ' ON '
              query += addQuotes(association.associationType === 'BelongsTo' ? dao.tableName : tableName) + '.'
              query += addQuotes(association.identifier) + '='
              query += addQuotes(association.associationType === 'BelongsTo' ? tableName : dao.tableName) + '.' + addQuotes('id')
            }

            var aliasAssoc = daoFactory.getAssociationByAlias(daoName)
              , aliasName  = !!aliasAssoc ? addQuotes(daoName) : _tableName

            optAttributes = optAttributes.concat(
              Utils._.keys(dao.attributes).map(function(attr) {
                return '' +
                  [_tableName, addQuotes(attr)].join('.') +
                  ' AS "' +
                  removeQuotes([aliasName, attr].join('.')) + '"'
              })
            )
          }
        }

        options.attributes = optAttributes.join(', ')
      }

      if(options.where) {
        options.where = QueryGenerator.getWhereConditions(options.where)
        query += " WHERE <%= where %>"
      }

      if(options.order) {
        options.order = options.order.replace(/([^ ]+)(.*)/, function(m, g1, g2) { return addQuotes(g1)+g2 })
        query += " ORDER BY <%= order %>"
      }

      if(options.group) {
        options.group = addQuotes(options.group)
        query += " GROUP BY <%= group %>"
      }

      if (!(options.include && (options.limit === 1))) {
        if (options.limit) {
          query += " LIMIT <%= limit %>"
        }

        if (options.offset) {
          query += " OFFSET <%= offset %>"
        }
      }

      query += ";"

      return Utils._.template(query)(options)
    },

    insertQuery: function(tableName, attrValueHash) {
      attrValueHash = Utils.removeNullValuesFromHash(attrValueHash, this.options.omitNull)

      var query     = "INSERT INTO <%= table %> (<%= attributes %>) VALUES (<%= values %>) RETURNING *;"
        , returning = []

      Utils._.forEach(attrValueHash, function(value, key, hash) {
        if (tables[tableName] && tables[tableName][key]) {
          switch (tables[tableName][key]) {
            case 'serial':
              delete hash[key]
              returning.push(key)
              break
          }
        }
      });

      var replacements  = {
        table: addQuotes(tableName),
        attributes: Utils._.keys(attrValueHash).map(function(attr){return addQuotes(attr)}).join(","),
        values: Utils._.values(attrValueHash).map(function(value){
          return pgEscape(value)
        }).join(",")
      }

      return Utils._.template(query)(replacements)
    },

    updateQuery: function(tableName, attrValueHash, where) {
      attrValueHash = Utils.removeNullValuesFromHash(attrValueHash, this.options.omitNull)

      var query  = "UPDATE <%= table %> SET <%= values %> WHERE <%= where %> RETURNING *"
        , values = []

      for (var key in attrValueHash) {
        var value = attrValueHash[key]
        values.push(addQuotes(key) + "=" + pgEscape(value))
      }

      var replacements = {
        table: addQuotes(tableName),
        values: values.join(","),
        where: QueryGenerator.getWhereConditions(where)
      }

      return Utils._.template(query)(replacements)
    },

    deleteQuery: function(tableName, where, options) {
      options = options || {}
      options.limit = options.limit || 1

      primaryKeys[tableName] = primaryKeys[tableName] || [];

      var query = "DELETE FROM <%= table %> WHERE <%= primaryKeys %> IN (SELECT <%= primaryKeysSelection %> FROM <%= table %> WHERE <%= where %> LIMIT <%= limit %>)"

      var pks;
      if (primaryKeys[tableName] && primaryKeys[tableName].length > 0) {
        pks = primaryKeys[tableName].map(function(pk) { return addQuotes(pk) }).join(',')
      } else {
        pks = addQuotes('id')
      }

      var replacements = {
        table: addQuotes(tableName),
        where: QueryGenerator.getWhereConditions(where),
        limit: pgEscape(options.limit),
        primaryKeys: primaryKeys[tableName].length > 1 ? '(' + pks + ')' : pks,
        primaryKeysSelection: pks
      }

      return Utils._.template(query)(replacements)
    },

    addIndexQuery: function(tableName, attributes, options) {
      var transformedAttributes = attributes.map(function(attribute) {
        if(typeof attribute == 'string')
          return addQuotes(attribute)
        else {
          var result = ""

          if(!attribute.attribute)
            throw new Error('The following index attribute has no attribute: ' + util.inspect(attribute))

          result += addQuotes(attribute.attribute)

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

      var indexTable = tableName.split('.')
      options = Utils._.extend({
        indicesType: null,
        indexName: Utils._.underscored(indexTable[indexTable.length-1] + '_' + onlyAttributeNames.join('_')),
        parser: null
      }, options || {})

      return Utils._.compact([
        "CREATE", options.indicesType, "INDEX", addQuotes(options.indexName),
        (options.indexType ? ('USING ' + options.indexType) : undefined),
        "ON", addQuotes(tableName), '(' + transformedAttributes.join(', ') + ')'
      ]).join(' ')
    },

    showIndexQuery: function(tableName, options) {
      var query = "SELECT relname FROM pg_class WHERE oid IN ( SELECT indexrelid FROM pg_index, pg_class WHERE pg_class.relname='<%= tableName %>' AND pg_class.oid=pg_index.indrelid);"
      return Utils._.template(query)({ tableName: tableName });
    },

    removeIndexQuery: function(tableName, indexNameOrAttributes) {
      var sql       = "DROP INDEX IF EXISTS <%= indexName %>"
        , indexName = indexNameOrAttributes

      if(typeof indexName != 'string')
        indexName = Utils._.underscored(tableName + '_' + indexNameOrAttributes.join('_'))

      return Utils._.template(sql)({ tableName: addQuotes(tableName), indexName: addQuotes(indexName) })
    },

    getWhereConditions: function(smth) {
      var result = null

      if(Utils.isHash(smth))
        result = QueryGenerator.hashToWhereConditions(smth)
      else if(typeof smth == 'number')
        result = '\"id\"' + "=" + pgEscape(smth)
      else if(typeof smth == "string")
        result = smth
      else if(Array.isArray(smth))
        result = Utils.format(smth)

      return result
    },

    hashToWhereConditions: function(hash) {
      var result = []

      for (var key in hash) {
        var value = hash[key]

        //handle qualified key names
        var _key   = key.split('.').map(function(col){return addQuotes(col)}).join(".")
          , _value = null

        if(Array.isArray(value)) {
          if(value.length == 0) { value = [null] }
          _value = "(" + value.map(function(subValue) {
            return pgEscape(subValue);
          }).join(',') + ")"

          result.push([_key, _value].join(" IN "))
        }
        else if ((value) && (typeof value == 'object')) {
          //using as sentinel for join column => value
          _value = value.join.split('.').map(function(col){return addQuotes(col)}).join(".")
          result.push([_key, _value].join("="))
        } else {
          _value = pgEscape(value)
          result.push((_value == 'NULL') ? _key + " IS NULL" : [_key, _value].join("="))
        }
      }

      return result.join(' AND ')
    },

    attributesToSQL: function(attributes) {
      var result = {}

      for (var name in attributes) {
        var dataType = attributes[name]

        if(Utils.isHash(dataType)) {
          var template     = "<%= type %>"
            , replacements = { type: dataType.type }

          if(dataType.type == 'TINYINT(1)') dataType.type = 'BOOLEAN'
          if(dataType.type == 'DATETIME') dataType.type = 'TIMESTAMP'

          if(dataType.hasOwnProperty('allowNull') && (!dataType.allowNull)) template += " NOT NULL"
          if(dataType.autoIncrement) template +=" SERIAL"
          if(dataType.defaultValue != undefined) {
            template += " DEFAULT <%= defaultValue %>"
            replacements.defaultValue = pgEscape(dataType.defaultValue)
          }
          if(dataType.unique) template += " UNIQUE"
          if(dataType.primaryKey) template += " PRIMARY KEY"

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
        var definition = factory.attributes[name]

        if (definition && (definition.indexOf('SERIAL') > -1)) {
          fields.push(name)
        }
      }

      return fields
    },

    databaseConnectionUri: function(config) {
      var template = '<%= protocol %>://<%= user %>:<%= password %>@<%= host %><% if(port) { %>:<%= port %><% } %>/<%= database %>';

      return Utils._.template(template)({
        user: config.username,
        password: config.password,
        database: config.database,
        host: config.host,
        port: config.port,
        protocol: config.protocol
      })
    }
  }

  return Utils._.extend(Utils._.clone(require("../query-generator")), QueryGenerator)
})()
