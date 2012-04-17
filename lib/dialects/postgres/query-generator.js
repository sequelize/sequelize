var Utils = require("../../utils")
  , util  = require("util")

tables = {}
primaryKeys = {}

function removeQuotes(s, quoteChar) {
  quoteChar = quoteChar || '"'
  return s.replace(new RegExp(quoteChar, 'g'), '')
}

function addQuotes(s, quoteChar) {
  quoteChar = quoteChar || '"'
  return quoteChar + removeQuotes(s) + quoteChar
}

function pgEscape(s) {
  s = Utils.escape(s)
  if (typeof s == 'string') s = s.replace(/\\"/g, '"')
  return s
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
    createTableQuery: function(tableName, attributes, options) {
      options = Utils._.extend({
      }, options || {})

      primaryKeys[tableName] = []
      tables[tableName] = {}

      var query   = "CREATE TABLE IF NOT EXISTS <%= table %> (<%= attributes%>)"
        , attrStr = Utils._.map(attributes, function(dataType, attr) {
            dataType = pgDataTypeMapping(tableName, attr, dataType)
            return addQuotes(attr) + " " + dataType
          }).join(", ")
        , values  = {
            table: addQuotes(tableName),
            attributes: attrStr,
          }

      var pks = primaryKeys[tableName].map(function(pk){return addQuotes(pk)}).join(",")
      if (pks.length > 0) values.attributes += ", PRIMARY KEY (" + pks + ")"

      return Utils._.template(query)(values).trim() + ";"
    },

    dropTableQuery: function(tableName, options) {
      options = options || {}
      var query = "DROP TABLE IF EXISTS <%= table %>;"
      return Utils._.template(query)({table: addQuotes(tableName)})
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
        , attrString = Utils._.map(attributes, function(definition, attributeName) {
            return Utils._.template('<%= attributeName %> <%= definition %>')({
              attributeName: addQuotes(attributeName),
              definition: pgDataTypeMapping(tableName, attributeName, definition)
            })
          }).join(', ')

      return Utils._.template(query)({ tableName: addQuotes(tableName), attributes: attrString })
    },

    removeColumnQuery: function(tableName, attributeName) {
      var query = "ALTER TABLE <%= tableName %> DROP COLUMN <%= attributeName %>;"
      return Utils._.template(query)({ tableName: addQuotes(tableName), attributeName: addQuotes(attributeName) })
    },

    changeColumnQuery: function(tableName, attributes) {
      var query = "ALTER TABLE <%= tableName %> ALTER COLUMN <%= query %>;"

      var sql = Utils._.map(attributes, function(definition, attributeName) {
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
        return attrSql;
      }).join('')

      return sql
    },

    renameColumnQuery: function(tableName, attrBefore, attributes) {
      var query      = "ALTER TABLE <%= tableName %> RENAME COLUMN <%= attributes %>;"
      var attrString = Utils._.map(attributes, function(definition, attributeName) {
        return Utils._.template('<%= before %> TO <%= after %>')({
          before: addQuotes(attrBefore),
          after: addQuotes(attributeName),
        })
      }).join(', ')

      return Utils._.template(query)({ tableName: addQuotes(tableName), attributes: attrString })
    },

    selectQuery: function(tableName, options) {
      options = options || {}
      options.table = Array.isArray(tableName) ? tableName.map(function(t){return addQuotes(t);}).join(", ") : addQuotes(tableName)
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

      var query = "SELECT <%= attributes %> FROM <%= table %>"

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
      if(options.limit) query += " LIMIT <%= limit %>"
      if(options.offset) query += " OFFSET <%= offset %>"

      query += ";"
      return Utils._.template(query)(options)
    },

    insertQuery: function(tableName, attrValueHash) {
      var query = "INSERT INTO <%= table %> (<%= attributes %>) VALUES (<%= values %>) RETURNING *;"

      returning = []
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
          return pgEscape((value instanceof Date) ? pgSqlDate(value) : value)
        }).join(",")
      }

      return Utils._.template(query)(replacements)
    },

    updateQuery: function(tableName, values, where) {
      var query = "UPDATE <%= table %> SET <%= values %> WHERE <%= where %>"
      var replacements = {
        table: addQuotes(tableName),
        values: Utils._.map(values, function(value, key){
          return addQuotes(key) + "=" + pgEscape((value instanceof Date) ? pgSqlDate(value) : value)
        }).join(","),
        where: QueryGenerator.getWhereConditions(where)
      }

      return Utils._.template(query)(replacements)
    },

    deleteQuery: function(tableName, where, options) {
      options = options || {}
      options.limit = options.limit || 1

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

      options = Utils._.extend({
        indicesType: null,
        indexName: Utils._.underscored(tableName + '_' + onlyAttributeNames.join('_')),
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
      return Utils._.map(hash, function(value, key) {
         //handle qualified key names
        var _key   = key.split('.').map(function(col){return addQuotes(col)}).join(".")
          , _value = null

      if(Array.isArray(value)) {
          _value = "(" + Utils._.map(value, function(subvalue) {
            return pgEscape(subvalue);
          }).join(',') + ")"

          return [_key, _value].join(" IN ")
      }
      else if ((value) && (typeof value == 'object')) {
        //using as sentinel for join column => value
        _value = value.join.split('.').map(function(col){return addQuotes(col)}).join(".")
        return [_key, _value].join("=")
      } else {
          _value = pgEscape(value)
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
      })

      return result
    },

    findAutoIncrementField: function(factory) {
      var fields = Utils._.map(factory.attributes, function(definition, name) {
        var isAutoIncrementField = (definition && (definition.indexOf('SERIAL') > -1))
        return isAutoIncrementField ? name : null
      })

      return Utils._.compact(fields)
    }
  }

  return Utils._.extend(Utils._.clone(require("../query-generator")), QueryGenerator)
})()
