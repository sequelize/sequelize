var Utils       = require("../../utils")
  , util        = require("util")
  , DataTypes   = require("../../data-types")
  , SqlString   = require("../../sql-string")
  , tables      = {}
  , primaryKeys = {}

module.exports = (function() {
  var QueryGenerator = {
    options: {},
    dialect: 'postgres',

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

      return this.quoteIdentifier(schema) + '.' + this.quoteIdentifier(tableName)
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

      var query   = "CREATE TABLE IF NOT EXISTS <%= table %> (<%= attributes%>)<%= comments %>"
        , comments = ""
        , attrStr = []
        , i

      if (options.comment && Utils._.isString(options.comment)) {
        comments += "; COMMENT ON TABLE <%= table %> IS " + this.escape(options.comment)
      }

      for (var attr in attributes) {
        if ((i = attributes[attr].indexOf('COMMENT')) !== -1) {
          // Move comment to a seperate query
          comments += "; " + attributes[attr].substring(i)
          attributes[attr] = attributes[attr].substring(0, i)
        }

        var dataType = this.pgDataTypeMapping(tableName, attr, attributes[attr])
        attrStr.push(this.quoteIdentifier(attr) + " " + dataType)
      }

      var values  = {
        table: this.quoteIdentifiers(tableName),
        attributes: attrStr.join(", "),
        comments: Utils._.template(comments, { table: this.quoteIdentifiers(tableName)})
      }

      var pks = primaryKeys[tableName].map(function(pk){
        return this.quoteIdentifier(pk)
      }.bind(this)).join(",")

      if (pks.length > 0) {
        values.attributes += ", PRIMARY KEY (" + pks + ")"
      }

      return Utils._.template(query)(values).trim() + ";"
    },

    dropTableQuery: function(tableName, options) {
      options = options || {}
      var query = "DROP TABLE IF EXISTS <%= schema %><%= table %><%= cascade %>;"
      return Utils._.template(query)({
        schema: options.schema ? this.quoteIdentifiers(options.schema) + '.' : '',
        table: this.quoteIdentifiers(tableName),
        cascade: options.cascade? " CASCADE" : ""
      })
    },

    renameTableQuery: function(before, after) {
      var query = "ALTER TABLE <%= before %> RENAME TO <%= after %>;"
      return Utils._.template(query)({
        before: this.quoteIdentifier(before),
        after: this.quoteIdentifier(after)
      })
    },

    showTablesQuery: function() {
      return "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';"
    },

    describeTableQuery: function(tableName, schema) {
      if (!schema) {
        schema = 'public';
      }

      var query = 'SELECT c.column_name as "Field", c.column_default as "Default", c.is_nullable as "Null", CASE WHEN c.udt_name = \'hstore\' THEN c.udt_name ELSE c.data_type END as "Type", (SELECT array_agg(e.enumlabel) FROM pg_catalog.pg_type t JOIN pg_catalog.pg_enum e ON t.oid=e.enumtypid WHERE t.typname=c.udt_name) AS "special" FROM information_schema.columns c WHERE table_name = <%= table %> AND table_schema = <%= schema %>'

      return Utils._.template(query)({
        table: this.escape(tableName),
        schema: this.escape(schema)
      })
    },

    addColumnQuery: function(tableName, attributes) {
      var query      = "ALTER TABLE <%= tableName %> ADD COLUMN <%= attributes %>;"
        , attrString = []

      for (var attrName in attributes) {
        var definition = attributes[attrName]

        attrString.push(Utils._.template('<%= attrName %> <%= definition %>')({
          attrName:   this.quoteIdentifier(attrName),
          definition: this.pgDataTypeMapping(tableName, attrName, definition)
        }))

        if (definition.match(/^ENUM\(/)) {
          query = this.pgEnum(tableName, attrName, definition) + query
        }
      }

      return Utils._.template(query)({
        tableName:  this.quoteIdentifiers(tableName),
        attributes: attrString.join(', ') })
    },

    removeColumnQuery: function(tableName, attributeName) {
      var query = "ALTER TABLE <%= tableName %> DROP COLUMN <%= attributeName %>;"
      return Utils._.template(query)({
        tableName:     this.quoteIdentifiers(tableName),
        attributeName: this.quoteIdentifier(attributeName)
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
            tableName: this.quoteIdentifiers(tableName),
            query:     this.quoteIdentifier(attributeName) + ' SET NOT NULL'
          })

          definition = definition.replace('NOT NULL', '').trim()
        } else {
          attrSql += Utils._.template(query)({
            tableName: this.quoteIdentifiers(tableName),
            query:     this.quoteIdentifier(attributeName) + ' DROP NOT NULL'
          })
        }

        if (definition.indexOf('DEFAULT') > 0) {
          attrSql += Utils._.template(query)({
            tableName: this.quoteIdentifiers(tableName),
            query:     this.quoteIdentifier(attributeName) + ' SET DEFAULT' + definition.match(/DEFAULT ([^;]+)/)[1]
          })

          definition = definition.replace(/(DEFAULT[^;]+)/, '').trim()
        } else {
          attrSql += Utils._.template(query)({
            tableName: this.quoteIdentifiers(tableName),
            query:     this.quoteIdentifier(attributeName) + ' DROP DEFAULT'
          })
        }

        if (definition.match(/^ENUM\(/)) {
          query      = this.pgEnum(tableName, attributeName, definition) + query
          definition = definition.replace(/^ENUM\(.+\)/, this.quoteIdentifier("enum_" + tableName + "_" + attributeName))
        }

        if (definition.match(/UNIQUE;*$/)) {
          definition = definition.replace(/UNIQUE;*$/, '')

          attrSql += Utils._.template(query.replace('ALTER COLUMN', ''))({
            tableName: this.quoteIdentifiers(tableName),
            query:     'ADD CONSTRAINT ' + this.quoteIdentifier(attributeName + '_unique_idx') + ' UNIQUE (' + this.quoteIdentifier(attributeName) + ')'
          })
        }

        attrSql += Utils._.template(query)({
          tableName: this.quoteIdentifiers(tableName),
          query:     this.quoteIdentifier(attributeName) + ' TYPE ' + definition
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
          before: this.quoteIdentifier(attrBefore),
          after:  this.quoteIdentifier(attributeName)
        }))
      }

      return Utils._.template(query)({
        tableName:  this.quoteIdentifiers(tableName),
        attributes: attrString.join(', ')
      })
    },

    selectQuery: function(tableName, options, factory) {
      var query = "SELECT <%= attributes %> FROM <%= table %>",
          table = null

      options            = options || {}
      options.table      = table = Array.isArray(tableName) ? tableName.map(function(t) { return this.quoteIdentifiers(t) }.bind(this)).join(", ") : this.quoteIdentifiers(tableName)
      options.attributes = options.attributes && options.attributes.map(function(attr) {
        if (Array.isArray(attr) && attr.length === 2) {
          return [attr[0], this.quoteIdentifier(attr[1])].join(' as ')
        } else {
          return attr.indexOf('"') < 0 ? this.quoteIdentifiers(attr) : attr
        }
      }.bind(this)).join(", ")
      options.attributes = options.attributes || '*'

      if (options.include) {
        var optAttributes = options.attributes === '*' ? [options.table + '.*'] : [options.attributes]

        options.include.forEach(function(include) {
          var attributes = include.attributes.map(function(attr) {
            return this.quoteIdentifier(include.as) + "." + this.quoteIdentifier(attr) + " AS " + this.quoteIdentifier(include.as + "." + attr, true)
          }.bind(this))

          optAttributes = optAttributes.concat(attributes)

          var joinQuery = ' LEFT OUTER JOIN <%= table %> AS <%= as %> ON <%= tableLeft %>.<%= attrLeft %> = <%= tableRight %>.<%= attrRight %>'

          if (!include.association.connectorDAO) {
            var primaryKeysLeft = ((include.association.associationType === 'BelongsTo') ? Object.keys(include.association.target.primaryKeys) : Object.keys(include.association.source.primaryKeys))
            query += Utils._.template(joinQuery)({
              table:      this.quoteIdentifiers(include.daoFactory.tableName),
              as:         this.quoteIdentifier(include.as),
              tableLeft:  this.quoteIdentifiers((include.association.associationType === 'BelongsTo') ? include.as : tableName),
              attrLeft:   this.quoteIdentifier(((primaryKeysLeft.length !== 1) ? 'id' : primaryKeysLeft[0])),
              tableRight: this.quoteIdentifiers((include.association.associationType === 'BelongsTo') ? tableName : include.as),
              attrRight:  this.quoteIdentifier(include.association.identifier)
            })
          } else {
            var primaryKeysSource = Object.keys(include.association.source.primaryKeys)
              , primaryKeysTarget = Object.keys(include.association.target.primaryKeys)

            query += Utils._.template(joinQuery)({
              table:      this.quoteIdentifiers(include.association.connectorDAO.tableName),
              as:         this.quoteIdentifier(include.association.connectorDAO.tableName),
              tableLeft:  this.quoteIdentifiers(tableName),
              attrLeft:   this.quoteIdentifier(((!include.association.source.hasPrimaryKeys || primaryKeysSource.length !== 1) ? 'id' : primaryKeysSource[0])),
              tableRight: this.quoteIdentifiers(include.association.connectorDAO.tableName),
              attrRight:  this.quoteIdentifier(include.association.identifier)
            })

            query += Utils._.template(joinQuery)({
              table:      this.quoteIdentifiers(include.daoFactory.tableName),
              as:         this.quoteIdentifier(include.as),
              tableLeft:  this.quoteIdentifiers(include.as),
              attrLeft:   this.quoteIdentifier(((!include.association.target.hasPrimaryKeys || primaryKeysTarget.length !== 1) ? 'id' : primaryKeysTarget[0])),
              tableRight: this.quoteIdentifiers(include.association.connectorDAO.tableName),
              attrRight:  this.quoteIdentifier(include.association.foreignIdentifier)
            })
          }
        }.bind(this))

        options.attributes = optAttributes.join(', ')
      }

      if(options.hasOwnProperty('where')) {
        options.where = this.getWhereConditions(options.where, tableName, factory)
        query += " WHERE <%= where %>"
      }

      if(options.group) {
        options.group = Array.isArray(options.group) ? options.group.map(function(t) { return this.quoteIdentifiers(t) }.bind(this)).join(', ') : this.quoteIdentifiers(options.group)
        query += " GROUP BY <%= group %>"
      }

      if(options.order) {
        options.order = options.order.replace(/([^ ]+)(.*)/, function(m, g1, g2) {
          return this.quoteIdentifiers(g1) + g2
        }.bind(this))
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

    insertQuery: function(tableName, attrValueHash, attributes) {
      attrValueHash = Utils.removeNullValuesFromHash(attrValueHash, this.options.omitNull)

      var query     = "INSERT INTO <%= table %> (<%= attributes %>) VALUES (<%= values %>) RETURNING *;"
      // Remove serials that are null or undefined, which causes an error in PG
      Utils._.forEach(attrValueHash, function(value, key, hash) {
        if (tables[tableName]) {
          switch (tables[tableName][key]) {
            case 'bigserial':
            case 'serial':
              if ([null, undefined].indexOf(hash[key]) !== -1) delete hash[key]
              break
          }
        }
      });

      var rowValues = []
      Object.keys(attrValueHash).forEach(function(attr) {
        rowValues[rowValues.length] = this.escape(attrValueHash[attr], (!!attributes && !!attributes[attr] ? attributes[attr] : undefined))
      }.bind(this))

      var replacements  = {
        table:      this.quoteIdentifiers(tableName)
      , attributes: Object.keys(attrValueHash).map(function(attr){
                      return this.quoteIdentifier(attr)
                    }.bind(this)).join(",")
      , values:     rowValues.join(",")
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
            return this.escape(value)
          }.bind(this)).join(",") +
        ")")
      }.bind(this))

      var replacements  = {
        table:      this.quoteIdentifiers(tableName)
      , attributes: Object.keys(attrValueHashes[0]).map(function(attr){
                      return this.quoteIdentifier(attr)
                    }.bind(this)).join(",")
      , tuples:     tuples.join(",")
      }

      return Utils._.template(query)(replacements)
    },

    updateQuery: function(tableName, attrValueHash, where, options) {
      attrValueHash = Utils.removeNullValuesFromHash(attrValueHash, this.options.omitNull, options)

      var query  = "UPDATE <%= table %> SET <%= values %> WHERE <%= where %> RETURNING *"
        , values = []

      for (var key in attrValueHash) {
        var value = attrValueHash[key]
        values.push(this.quoteIdentifier(key) + "=" + this.escape(value))
      }

      var replacements = {
        table:  this.quoteIdentifiers(tableName),
        values: values.join(","),
        where:  this.getWhereConditions(where)
      }

      return Utils._.template(query)(replacements)
    },

    deleteQuery: function(tableName, where, options) {
      options = options || {}

      if (options.truncate === true) {
        return "TRUNCATE " + QueryGenerator.quoteIdentifier(tableName)
      }

      if(Utils._.isUndefined(options.limit)) {
        options.limit = 1;
      }

      primaryKeys[tableName] = primaryKeys[tableName] || [];

      var query = "DELETE FROM <%= table %> WHERE <%= primaryKeys %> IN (SELECT <%= primaryKeysSelection %> FROM <%= table %> WHERE <%= where %><%= limit %>)"

      var pks;
      if (primaryKeys[tableName] && primaryKeys[tableName].length > 0) {
        pks = primaryKeys[tableName].map(function(pk) {
          return this.quoteIdentifier(pk)
        }.bind(this)).join(',')
      } else {
        pks = this.quoteIdentifier('id')
      }

      var replacements = {
        table: this.quoteIdentifiers(tableName),
        where: this.getWhereConditions(where),
        limit: !!options.limit? " LIMIT " + this.escape(options.limit) : "",
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
        values.push(this.quoteIdentifier(key) + "=" + this.quoteIdentifier(key) + " + " + this.escape(value))
      }

      var replacements = {
        table:  this.quoteIdentifiers(tableName),
        values: values.join(","),
        where:  this.getWhereConditions(where)
      }

      return Utils._.template(query)(replacements)
    },


    addIndexQuery: function(tableName, attributes, options) {
      var transformedAttributes = attributes.map(function(attribute) {
        if (typeof attribute === 'string') {
          return this.quoteIdentifier(attribute)
        } else {
          var result = ""

          if (!attribute.attribute) {
            throw new Error('The following index attribute has no attribute: ' + util.inspect(attribute))
          }

          result += this.quoteIdentifier(attribute.attribute)

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
        return (typeof attribute === "string") ? attribute : attribute.attribute
      }.bind(this))

      var indexTable = tableName.split('.')
      options = Utils._.extend({
        indicesType: null,
        indexName:   Utils._.underscored(indexTable[indexTable.length-1] + '_' + onlyAttributeNames.join('_')),
        parser:      null
      }, options || {})

      return Utils._.compact([
        "CREATE", options.indicesType, "INDEX", this.quoteIdentifiers(options.indexName),
        (options.indexType ? ('USING ' + options.indexType) : undefined),
        "ON", this.quoteIdentifiers(tableName), '(' + transformedAttributes.join(', ') + ')'
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
        tableName: this.quoteIdentifiers(tableName),
        indexName: this.quoteIdentifiers(indexName)
      })
    },

    getWhereConditions: function(smth, tableName, factory) {
      var result = null
        , where = {}

      if (Utils.isHash(smth)) {
        smth = Utils.prependTableNameToHash(tableName, smth)
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
      }
      else if (Array.isArray(smth)) {
        result = Utils.format(smth, "postgres")
      }

      return result
    },

    hashToWhereConditions: function(hash) {
      var result = []

      for (var key in hash) {
        var value = hash[key]

        //handle qualified key names
        var _key   = this.quoteIdentifiers(key)
          , _value = null

        if (Array.isArray(value)) {
          if (value.length === 0) { value = [null] }
          _value = "(" + value.map(this.escape).join(',') + ")"

          result.push([_key, _value].join(" IN "))
        }
        else if ((value) && (typeof value === "object")) {
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
                return this.escape(value)
              }.bind(this)).join(", ") + ")"
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
            template += " SERIAL"
          }

          if (dataType.defaultValue !== undefined) {
            template += " DEFAULT <%= defaultValue %>"
            replacements.defaultValue = this.escape(dataType.defaultValue)
          }

          if (dataType.unique) {
            template += " UNIQUE"
          }

          if (dataType.primaryKey) {
            template += " PRIMARY KEY"
          }

          if(dataType.references) {
            template += " REFERENCES <%= referencesTable %> (<%= referencesKey %>)"
            replacements.referencesTable = this.quoteIdentifier(dataType.references)

            if(dataType.referencesKey) {
              replacements.referencesKey = this.quoteIdentifier(dataType.referencesKey)
            } else {
              replacements.referencesKey = this.quoteIdentifier('id')
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

          if (dataType.comment && Utils._.isString(dataType.comment)) {
            template += " COMMENT ON COLUMN <%= tableName %>.<%= columnName %> IS <%= comment %>"
            replacements.columnName = this.quoteIdentifier(name)
            replacements.tableName = '<%= table %>' // Hacky, table name will be inserted by create table
            replacements.comment = this.escape(dataType.comment)
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
        user:     config.username,
        password: config.password,
        database: config.database,
        host:     config.host,
        port:     config.port,
        protocol: config.protocol
      })
    },

    pgEscapeAndQuote: function (val) {
      return this.quoteIdentifier(Utils.removeTicks(this.escape(val), "'"))
    },

    pgListEnums: function(tableName, attrName, options) {
      if (arguments.length === 1) {
        options = tableName
        tableName = null
      }

      var enumName = ''

      if (!!tableName && !!attrName) {
        enumName = ' AND t.typname=' + this.escape("enum_" + tableName + "_" + attrName) + ' '
      }

      var query = 'SELECT t.typname enum_name, array_agg(e.enumlabel) enum_value FROM pg_type t ' +
        'JOIN pg_enum e ON t.oid = e.enumtypid ' +
        'JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace ' +
        'WHERE n.nspname = \'public\' ' + enumName + ' GROUP BY 1'

      return query
    },

    pgEnum: function (tableName, attr, dataType, options) {
      var enumName = this.pgEscapeAndQuote("enum_" + tableName + "_" + attr)
      var sql = "CREATE TYPE " + enumName + " AS " + dataType.match(/^ENUM\(.+\)/)[0] + "; "
      if (!!options && options.force === true) {
        sql = this.pgEnumDrop(tableName, attr) + sql
      }
      return sql
    },

    pgEnumAdd: function(tableName, attr, value, options) {
      var enumName = this.pgEscapeAndQuote("enum_" + tableName + "_" + attr)
      var sql = 'ALTER TYPE ' + enumName + ' ADD VALUE ' + this.escape(value)

      if (!!options.before) {
        sql += ' BEFORE ' + this.escape(options.before)
      }
      else if (!!options.after) {
        sql += ' AFTER ' + this.escape(options.after)
      }

      return sql
    },

    pgEnumDrop: function(tableName, attr) {
      var enumName = this.pgEscapeAndQuote("enum_" + tableName + "_" + attr)
      return 'DROP TYPE IF EXISTS ' + enumName + '; '
    },

    fromArray: function(text) {
      text = text.replace(/^{/, '').replace(/}$/, '')
      var matches = text.match(/("(?:\\.|[^"\\\\])*"|[^,]*)(?:\s*,\s*|\s*$)/ig)

      if (matches.length < 1) {
        return []
      }

      matches = matches.map(function(m){
        return m.replace(/",$/, '').replace(/,$/, '').replace(/(^"|"$)/, '')
      })

      return matches.slice(0, -1)
    },

    padInt: function (i) {
      return (i < 10) ? '0' + i.toString() : i.toString()
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
        if (Utils._.includes(dataType, 'BIGINT')) {
          dataType = dataType.replace(/SERIAL/, 'BIGSERIAL')
          dataType = dataType.replace(/BIGINT/, '')
          tables[tableName][attr] = 'bigserial'
        } else {
          dataType = dataType.replace(/INTEGER/, '')
          tables[tableName][attr] = 'serial'
        }
        dataType = dataType.replace(/NOT NULL/, '')
      }

      if (dataType.lastIndexOf('BLOB') !== -1) {
        dataType = 'bytea'
      }

      if (dataType.match(/^ENUM\(/)) {
        dataType = dataType.replace(/^ENUM\(.+\)/, this.pgEscapeAndQuote("enum_" + tableName + "_" + attr))
      }

      return dataType
    },

    quoteIdentifier: function(identifier, force) {
      if(!force && this.options && this.options.quoteIdentifiers === false) { // default is `true`
        // In Postgres, if tables or attributes are created double-quoted,
        // they are also case sensitive. If they contain any uppercase
        // characters, they must always be double-quoted. This makes it
        // impossible to write queries in portable SQL if tables are created in
        // this way. Hence, we strip quotes if we don't want case sensitivity.
        return Utils.removeTicks(identifier, '"')
      } else {
        return Utils.addTicks(identifier, '"')
      }
    },

    quoteIdentifiers: function(identifiers, force) {
      return identifiers.split('.').map(function(t) { return this.quoteIdentifier(t, force) }.bind(this)).join('.')
    },

    escape: function(value, field) {
      return SqlString.escape(value, false, null, "postgres", field)
    }

  }

  // Private

  var removeSerialsFromHash = function(tableName, attrValueHash) {
    var returning = [];
    Utils._.forEach(attrValueHash, function(value, key, hash) {
        if (tables[tableName] && tables[tableName][key]) {
          switch (tables[tableName][key]) {
            case 'bigserial':
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
