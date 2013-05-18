var Utils       = require("../../utils")
  , util        = require("util")
  , DataTypes   = require("../../data-types")
  , tables      = {}
  , primaryKeys = {}

module.exports = (function() {
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
      var query = "DROP SCHEMA <%= schema%> CASCADE;"
      return Utils._.template(query)({schema: schema})
    },

    showSchemasQuery: function() {
      return "SELECT schema_name FROM information_schema.schemata WHERE schema_name <> 'information_schema' AND schema_name != 'public' AND schema_name !~ E'^pg_';"
    },

    createTableQuery: function(tableName, attributes, options) {
      options = Utils._.extend({
      }, options || {})

      primaryKeys[tableName] = []
      tables[tableName] = {}

      var query   = "CREATE TABLE IF NOT EXISTS <%= table %> (<%= attributes%>)"
        , attrStr = []

      for (var attr in attributes) {
        var dataType = QueryGenerator.pgDataTypeMapping(tableName, attr, attributes[attr])
        attrStr.push(QueryGenerator.addQuotes(attr) + " " + dataType)

        if (attributes[attr].match(/^ENUM\(/)) {
          query = QueryGenerator.pgEnum(tableName, attr, attributes[attr]) + query
        }
      }

      var values  = {
        table: QueryGenerator.addQuotes(tableName),
        attributes: attrStr.join(", ")
      }

      var pks = primaryKeys[tableName].map(function(pk){
        return QueryGenerator.addQuotes(pk)
      }).join(",")

      if (pks.length > 0) {
        values.attributes += ", PRIMARY KEY (" + pks + ")"
      }

      return Utils._.template(query)(values).trim() + ";"
    },

    dropTableQuery: function(tableName, options) {
      options = options || {}
      var query = "DROP TABLE IF EXISTS <%= table %><%= cascade %>;"
      return Utils._.template(query)({
        table: QueryGenerator.addQuotes(tableName),
        cascade: options.cascade? " CASCADE" : ""
      })
    },

    renameTableQuery: function(before, after) {
      var query = "ALTER TABLE <%= before %> RENAME TO <%= after %>;"
      return Utils._.template(query)({
        before: QueryGenerator.addQuotes(before),
        after: QueryGenerator.addQuotes(after)
      })
    },

    showTablesQuery: function() {
      return "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';"
    },

    describeTableQuery: function(tableName) {
      var query = 'SELECT column_name as "Field", column_default as "Default", is_nullable as "Null", data_type as "Type" FROM information_schema.columns WHERE table_name = <%= table %>;'
      return Utils._.template(query)({
        table: QueryGenerator.addQuotes(tableName, "'")
      })
    },

    addColumnQuery: function(tableName, attributes) {
      var query      = "ALTER TABLE <%= tableName %> ADD COLUMN <%= attributes %>;"
        , attrString = []

      for (var attrName in attributes) {
        var definition = attributes[attrName]

        attrString.push(Utils._.template('<%= attrName %> <%= definition %>')({
          attrName:   QueryGenerator.addQuotes(attrName),
          definition: QueryGenerator.pgDataTypeMapping(tableName, attrName, definition)
        }))

        if (definition.match(/^ENUM\(/)) {
          query = QueryGenerator.pgEnum(tableName, attrName, definition) + query
        }
      }

      return Utils._.template(query)({
        tableName:  QueryGenerator.addQuotes(tableName),
        attributes: attrString.join(', ') })
    },

    removeColumnQuery: function(tableName, attributeName) {
      var query = "ALTER TABLE <%= tableName %> DROP COLUMN <%= attributeName %>;"
      return Utils._.template(query)({
        tableName:     QueryGenerator.addQuotes(tableName),
        attributeName: QueryGenerator.addQuotes(attributeName)
      })
    },

    changeColumnQuery: function(tableName, attributes) {
      var query = "ALTER TABLE <%= tableName %> ALTER COLUMN <%= query %>;"
        , sql   = []

      for (var attributeName in attributes) {
        var definition = attributes[attributeName]
        var attrSql = ''

        if (definition.indexOf('NOT NULL') > 0) {
          attrSql += Utils._.template(query)({
            tableName: QueryGenerator.addQuotes(tableName),
            query:     QueryGenerator.addQuotes(attributeName) + ' SET NOT NULL'
          })

          definition = definition.replace('NOT NULL', '').trim()
        } else {
          attrSql += Utils._.template(query)({
            tableName: QueryGenerator.addQuotes(tableName),
            query:     QueryGenerator.addQuotes(attributeName) + ' DROP NOT NULL'
          })
        }

        if (definition.indexOf('DEFAULT') > 0) {
          attrSql += Utils._.template(query)({
            tableName: QueryGenerator.addQuotes(tableName),
            query:     QueryGenerator.addQuotes(attributeName) + ' SET DEFAULT' + definition.match(/DEFAULT ([^;]+)/)[1]
          })

          definition = definition.replace(/(DEFAULT[^;]+)/, '').trim()
        } else {
          attrSql += Utils._.template(query)({
            tableName: QueryGenerator.addQuotes(tableName),
            query:     QueryGenerator.addQuotes(attributeName) + ' DROP DEFAULT'
          })
        }

        if (definition.match(/^ENUM\(/)) {
          query      = QueryGenerator.pgEnum(tableName, attributeName, definition) + query
          definition = definition.replace(/^ENUM\(.+\)/, Utils.escape("enum_" + tableName + "_" + attributeName))
        }

        attrSql += Utils._.template(query)({
          tableName: QueryGenerator.addQuotes(tableName),
          query:     QueryGenerator.addQuotes(attributeName) + ' TYPE ' + definition
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
          before: QueryGenerator.addQuotes(attrBefore),
          after:  QueryGenerator.addQuotes(attributeName)
        }))
      }

      return Utils._.template(query)({
        tableName:  QueryGenerator.addQuotes(tableName),
        attributes: attrString.join(', ')
      })
    },

    selectQuery: function(tableName, options) {
      var query = "SELECT <%= attributes %> FROM <%= table %>"
        , table = null

      options = options || {}

      if (Array.isArray(tableName)) {
        options.table = table = tableName.map(function(t){
          return QueryGenerator.addQuotes(t)
        }).join(", ")
      } else {
        options.table = table = QueryGenerator.addQuotes(tableName)
      }

      options.attributes = options.attributes && options.attributes.map(function(attr) {
        if (Array.isArray(attr) && attr.length === 2) {
          return [
            attr[0],
            QueryGenerator.addQuotes(QueryGenerator.removeQuotes(attr[1], '`'))
          ].join(' as ')
        } else if (attr.indexOf('`') >= 0) {
          return attr.replace(/`/g, '"')
        } else {
          return QueryGenerator.addQuotes(attr)
        }
      }).join(", ")

      options.attributes = options.attributes || '*'

      if (options.include) {
        var optAttributes = options.attributes === '*' ? [options.table + '.*'] : [options.attributes]

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
            attrLeft:   'id',
            tableRight: ((include.association.associationType === 'BelongsTo') ? tableName : include.as),
            attrRight:  include.association.identifier
          })
        })

        options.attributes = optAttributes.join(', ')
      }

      if(options.hasOwnProperty('where')) {
        options.where = QueryGenerator.getWhereConditions(options.where, tableName)
        query += " WHERE <%= where %>"
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
        , returning = removeSerialsFromHash(tableName, attrValueHash)

      var replacements  = {
        table:      QueryGenerator.addQuotes(tableName)
      , attributes: Object.keys(attrValueHash).map(function(attr){
                      return QueryGenerator.addQuotes(attr)
                    }).join(",")
      , values:     Utils._.values(attrValueHash).map(function(value){
                      return QueryGenerator.pgEscape(value)
                    }).join(",")
      }

      return Utils._.template(query)(replacements)
    },

    bulkInsertQuery: function(tableName, attrValueHashes) {
      var query     = "INSERT INTO <%= table %> (<%= attributes %>) VALUES <%= tuples %> RETURNING *;"
        , tuples    = []

      Utils._.forEach(attrValueHashes, function(attrValueHash) {
        removeSerialsFromHash(tableName, attrValueHash)
        tuples.push("(" +
          Utils._.values(attrValueHash).map(function(value){
            return QueryGenerator.pgEscape(value)
          }).join(",") +
        ")")
      })

      var replacements  = {
        table:      QueryGenerator.addQuotes(tableName)
      , attributes: Object.keys(attrValueHashes[0]).map(function(attr){
                      return QueryGenerator.addQuotes(attr)
                    }).join(",")
      , tuples:     tuples.join(",")
      }

      return Utils._.template(query)(replacements)
    },

    updateQuery: function(tableName, attrValueHash, where) {
      attrValueHash = Utils.removeNullValuesFromHash(attrValueHash, this.options.omitNull)

      var query  = "UPDATE <%= table %> SET <%= values %> WHERE <%= where %> RETURNING *"
        , values = []

      for (var key in attrValueHash) {
        var value = attrValueHash[key]
        values.push(QueryGenerator.addQuotes(key) + "=" + QueryGenerator.pgEscape(value))
      }

      var replacements = {
        table:  QueryGenerator.addQuotes(tableName),
        values: values.join(","),
        where:  QueryGenerator.getWhereConditions(where)
      }

      return Utils._.template(query)(replacements)
    },

    deleteQuery: function(tableName, where, options) {
      options = options || {}

      if(Utils._.isUndefined(options.limit)) {
        options.limit = 1;
      }

      primaryKeys[tableName] = primaryKeys[tableName] || [];

      var query = "DELETE FROM <%= table %> WHERE <%= primaryKeys %> IN (SELECT <%= primaryKeysSelection %> FROM <%= table %> WHERE <%= where %><%= limit %>)"

      var pks;
      if (primaryKeys[tableName] && primaryKeys[tableName].length > 0) {
        pks = primaryKeys[tableName].map(function(pk) {
          return QueryGenerator.addQuotes(pk)
        }).join(',')
      } else {
        pks = QueryGenerator.addQuotes('id')
      }

      var replacements = {
        table: QueryGenerator.addQuotes(tableName),
        where: QueryGenerator.getWhereConditions(where),
        limit: !!options.limit? " LIMIT " + QueryGenerator.pgEscape(options.limit) : "",
        primaryKeys: primaryKeys[tableName].length > 1 ? '(' + pks + ')' : pks,
        primaryKeysSelection: pks
      }

      return Utils._.template(query)(replacements)
    },

    incrementQuery: function(tableName, attrValueHash, where) {
      attrValueHash = Utils.removeNullValuesFromHash(attrValueHash, this.options.omitNull)

      var query  = "UPDATE <%= table %> SET <%= values %> WHERE <%= where %> RETURNING *"
        , values = []

      for (var key in attrValueHash) {
        var value = attrValueHash[key]
        values.push(QueryGenerator.addQuotes(key) + "=" + QueryGenerator.addQuotes(key) + " + " + QueryGenerator.pgEscape(value))
      }

      var replacements = {
        table:  QueryGenerator.addQuotes(tableName),
        values: values.join(","),
        where:  QueryGenerator.getWhereConditions(where)
      }

      return Utils._.template(query)(replacements)
    },


    addIndexQuery: function(tableName, attributes, options) {
      var transformedAttributes = attributes.map(function(attribute) {
        if (typeof attribute === 'string') {
          return QueryGenerator.addQuotes(attribute)
        } else {
          var result = ""

          if (!attribute.attribute) {
            throw new Error('The following index attribute has no attribute: ' + util.inspect(attribute))
          }

          result += QueryGenerator.addQuotes(attribute.attribute)

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
        return (typeof attribute === "string") ? attribute : attribute.attribute
      })

      var indexTable = tableName.split('.')
      options = Utils._.extend({
        indicesType: null,
        indexName:   Utils._.underscored(indexTable[indexTable.length-1] + '_' + onlyAttributeNames.join('_')),
        parser:      null
      }, options || {})

      return Utils._.compact([
        "CREATE", options.indicesType, "INDEX", QueryGenerator.addQuotes(options.indexName),
        (options.indexType ? ('USING ' + options.indexType) : undefined),
        "ON", QueryGenerator.addQuotes(tableName), '(' + transformedAttributes.join(', ') + ')'
      ]).join(' ')
    },

    showIndexQuery: function(tableName, options) {
      var query = "SELECT relname FROM pg_class WHERE oid IN ( SELECT indexrelid FROM pg_index, pg_class WHERE pg_class.relname='<%= tableName %>' AND pg_class.oid=pg_index.indrelid);"
      return Utils._.template(query)({ tableName: tableName });
    },

    removeIndexQuery: function(tableName, indexNameOrAttributes) {
      var sql       = "DROP INDEX IF EXISTS <%= indexName %>"
        , indexName = indexNameOrAttributes

      if (typeof indexName !== "string") {
        indexName = Utils._.underscored(tableName + '_' + indexNameOrAttributes.join('_'))
      }

      return Utils._.template(sql)({
        tableName: QueryGenerator.addQuotes(tableName),
        indexName: QueryGenerator.addQuotes(indexName)
      })
    },

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

    hashToWhereConditions: function(hash) {
      var result = []

      for (var key in hash) {
        var value = hash[key]

        //handle qualified key names
        var _key   = key.split('.').map(function(col){return QueryGenerator.addQuotes(col)}).join(".")
          , _value = null

        if (Array.isArray(value)) {
          if (value.length == 0) { value = [null] }
          _value = "(" + value.map(function(subValue) {
            return QueryGenerator.pgEscape(subValue);
          }).join(',') + ")"

          result.push([_key, _value].join(" IN "))
        }
        else if ((value) && (typeof value === "object")) {
          //using as sentinel for join column => value
          _value = value.join.split('.').map(function(col){return QueryGenerator.addQuotes(col)}).join(".")
          result.push([_key, _value].join("="))
        } else {
          _value = QueryGenerator.pgEscape(value)
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

          if (dataType.type.toString() === DataTypes.ENUM.toString()) {
            if (Array.isArray(dataType.values) && (dataType.values.length > 0)) {
              replacements.type = "ENUM(" + Utils._.map(dataType.values, function(value) {
                return Utils.escape(value)
              }).join(", ") + ")"
            } else {
              throw new Error('Values for ENUM haven\'t been defined.')
            }
          }

          if (dataType.type === "TINYINT(1)") {
            dataType.type = 'BOOLEAN'
          }

          if (dataType.type === "DATETIME") {
            dataType.type = 'TIMESTAMP WITH TIME ZONE'
          }

          if (dataType.hasOwnProperty('allowNull') && (!dataType.allowNull)) {
            template += " NOT NULL"
          }

          if (dataType.autoIncrement) {
            template +=" SERIAL"
          }

          if (dataType.defaultValue !== undefined) {
            template += " DEFAULT <%= defaultValue %>"
            replacements.defaultValue = QueryGenerator.pgEscape(dataType.defaultValue)
          }

          if (dataType.unique) {
            template += " UNIQUE"
          }

          if (dataType.primaryKey) {
            template += " PRIMARY KEY"
          }

          if(dataType.references) {
            template += " REFERENCES <%= referencesTable %> (<%= referencesKey %>)"
            replacements.referencesTable = QueryGenerator.addQuotes(dataType.references)

            if(dataType.referencesKey) {
              replacements.referencesKey = QueryGenerator.addQuotes(dataType.referencesKey)
            } else {
              replacements.referencesKey = QueryGenerator.addQuotes('id')
            }

            if(dataType.onDelete) {
              template += " ON DELETE <%= onDeleteAction %>"
              replacements.onDeleteAction = dataType.onDelete.toUpperCase()
            }

            if(dataType.onUpdate) {
              template += " ON UPDATE <%= onUpdateAction %>"
              replacements.onUpdateAction = dataType.onUpdate.toUpperCase()
            }

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
        var definition = factory.attributes[name]

        if (definition && (definition.indexOf('SERIAL') > -1)) {
          fields.push(name)
        }
      }

      return fields
    },

    enableForeignKeyConstraintsQuery: function() {
      return false // not supported by dialect
    },

    disableForeignKeyConstraintsQuery: function() {
      return false // not supported by dialect
    },

    databaseConnectionUri: function(config) {
      var template = '<%= protocol %>://<%= user %>:<%= password %>@<%= host %><% if(port) { %>:<%= port %><% } %>/<%= database %>'

      return Utils._.template(template)({
        user:     encodeURIComponent(config.username),
        password: encodeURIComponent(config.password),
        database: config.database,
        host:     config.host,
        port:     config.port,
        protocol: config.protocol
      })
    },

    removeQuotes: function (s, quoteChar) {
      quoteChar = quoteChar || '"'
      return s.replace(new RegExp(quoteChar, 'g'), '')
    },

    addQuotes: function (s, quoteChar) {
      quoteChar = quoteChar || '"'
      return QueryGenerator.removeQuotes(s, quoteChar)
        .split('.')
        .map(function(e) { return quoteChar + String(e) + quoteChar })
        .join('.')
    },

    pgEscape: function (val) {
      if (val === undefined || val === null) {
        return 'NULL';
      }

      switch (typeof val) {
        case 'boolean': return (val) ? 'true' : 'false';
        case 'number': return val+'';
        case 'object':
          if (Array.isArray(val)) {
            return 'ARRAY['+ val.map(function(it) { return QueryGenerator.pgEscape(it) }).join(',') +']';
          }
      }

      if (val instanceof Date) {
        val = QueryGenerator.pgSqlDate(val);
      }

      // http://www.postgresql.org/docs/8.2/static/sql-syntax-lexical.html#SQL-SYNTAX-STRINGS
      val = val.replace(/'/g, "''");
      return "'"+val+"'";
    },

    pgEscapeAndQuote: function (val) {
      return QueryGenerator.addQuotes(QueryGenerator.removeQuotes(QueryGenerator.pgEscape(val), "'"))
    },

    pgEnum: function (tableName, attr, dataType) {
      var enumName = QueryGenerator.pgEscapeAndQuote("enum_" + tableName + "_" + attr)
      return "DROP TYPE IF EXISTS " + enumName + "; CREATE TYPE " + enumName + " AS " + dataType.match(/^ENUM\(.+\)/)[0] + "; "
    },

    toHstore: function(text) {
      var obj = {}
        , pattern = '("\\\\.|[^"\\\\]*"\s*=|[^=]*)\s*=\s*>\s*("(?:\\.|[^"\\\\])*"|[^,]*)(?:\s*,\s*|$)'
        , rex = new RegExp(pattern,'g')
        , r = null

      while ((r = rex.exec(text)) !== null) {
        if (!!r[1] && !!r[2]) {
          obj[r[1].replace(/^"/, '').replace(/"$/, '')] = r[2].replace(/^"/, '').replace(/"$/, '')
        }
      }

      return obj
    },

    padInt: function (i) {
      return (i < 10) ? '0' + i.toString() : i.toString()
    },

    pgSqlDate: function (dt) {
      var date = [ dt.getUTCFullYear(), QueryGenerator.padInt(dt.getUTCMonth()+1), QueryGenerator.padInt(dt.getUTCDate()) ].join('-')
      var time = [ dt.getUTCHours(), QueryGenerator.padInt(dt.getUTCMinutes()), QueryGenerator.padInt(dt.getUTCSeconds())].join(':')
      return date + ' ' + time + '.' + ((dt.getTime() % 1000) * 1000) + 'Z'
    },

    pgDataTypeMapping: function (tableName, attr, dataType) {
      if (Utils._.includes(dataType, 'PRIMARY KEY')) {
        primaryKeys[tableName].push(attr)
        dataType = dataType.replace(/PRIMARY KEY/, '')
      }

      if (Utils._.includes(dataType, 'TINYINT(1)')) {
        dataType = dataType.replace(/TINYINT\(1\)/, 'BOOLEAN')
      }

      if (Utils._.includes(dataType, 'DATETIME')) {
        dataType = dataType.replace(/DATETIME/, 'TIMESTAMP WITH TIME ZONE')
      }

      if (Utils._.includes(dataType, 'SERIAL')) {
        dataType = dataType.replace(/INTEGER/, '')
        dataType = dataType.replace(/NOT NULL/, '')
        tables[tableName][attr] = 'serial'
      }

      if (dataType.match(/^ENUM\(/)) {
        dataType = dataType.replace(/^ENUM\(.+\)/, QueryGenerator.pgEscapeAndQuote("enum_" + tableName + "_" + attr))
      }

      return dataType
    }
  }

  // Private

  var removeSerialsFromHash = function(tableName, attrValueHash) {
    var returning = [];
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
    return returning;
  }

  return Utils._.extend(Utils._.clone(require("../query-generator")), QueryGenerator)
})()
