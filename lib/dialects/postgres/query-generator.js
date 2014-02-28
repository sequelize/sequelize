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

      if (!!opts && !!opts.tableName) {
        tableName = opts.tableName
      }
      else if (typeof opts === "string") {
        tableName = opts
      }

      if (!schema || schema.toString().trim() === "") {
        return tableName
      }

      return this.quoteIdentifiers((!!schema ? (schema + '.' + tableName) : tableName));
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
      var self = this

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

      if (!!options.uniqueKeys) {
        Utils._.each(options.uniqueKeys, function(columns) {
          values.attributes += ", UNIQUE (" + columns.fields.map(function(f) { return self.quoteIdentifiers(f) }).join(', ') + ")"
        })
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

    uniqueConstraintMapping: {
      code: '23505',
      map: function(str) {
        var match = str.match(/duplicate key value violates unique constraint "(.*?)_key"/)
        if (match === null || match.length < 2) {
          return false
        }

        return match[1].split('_').splice(1)
      }
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

    arrayValue: function(value, key, _key, factory, logicResult){
      var col      = null
        , coltype  = null
        , _realKey = key.split('.').pop()
        , _value

      if (value.length === 0) { value = [null] }

      // Special conditions for searching within an array column type
      if (!!factory && !!factory.rawAttributes[_realKey]) {
        col = factory.rawAttributes[_realKey]
        coltype = col.type
        if(coltype && !(typeof coltype == 'string')) {
          coltype = coltype.toString();
        }
      }
      if ( col && ((!!coltype && coltype.match(/\[\]$/) !== null) || (col.toString().match(/\[\]$/) !== null))) {
        _value = 'ARRAY[' + value.map(this.escape.bind(this)).join(',') + ']::' + (!!col.type ? col.type : col.toString())
        return [_key, _value].join(" && ")
      } else {
        _value = "(" + value.map(this.escape.bind(this)).join(',') + ")"
        return [_key, _value].join(" " + logicResult + " ")
      }
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
            query:     this.quoteIdentifier(attributeName) + ' SET DEFAULT ' + definition.match(/DEFAULT ([^;]+)/)[1]
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

    bulkInsertQuery: function(tableName, attrValueHashes, options) {
      var query        = "INSERT INTO <%= table %> (<%= attributes %>) VALUES <%= tuples %> RETURNING *;"
        , tuples       = []
        , serials      = []
        , allAttributes = []

      Utils._.forEach(attrValueHashes, function(attrValueHash, i) {
        Utils._.forOwn(attrValueHash, function(value, key, hash) {
          if (allAttributes.indexOf(key) === -1) allAttributes.push(key)

          if (tables[tableName] && tables[tableName][key]) {
            if (['bigserial', 'serial'].indexOf(tables[tableName][key]) !== -1 && serials.indexOf(key) === -1) {
              serials.push(key)
            }
          }
        })
      })

      Utils._.forEach(attrValueHashes, function(attrValueHash, i) {
        tuples.push("(" +
          allAttributes.map(function (key) {
            if (serials.indexOf(key) !== -1) {
              return attrValueHash[key] || 'DEFAULT';
            }
            return this.escape(attrValueHash[key])
          }.bind(this)).join(",") +
        ")")
      }.bind(this))

      var replacements  = {
        table:      this.quoteIdentifiers(tableName)
      , attributes: allAttributes.map(function(attr){
                      return this.quoteIdentifier(attr)
                    }.bind(this)).join(",")
      , tuples:     tuples.join(",")
      }

      return Utils._.template(query)(replacements)
    },

    deleteQuery: function(tableName, where, options, factory) {
      options = options || {}

      if (options.truncate === true) {
        return "TRUNCATE " + QueryGenerator.quoteIdentifier(tableName)
      }

      if(Utils._.isUndefined(options.limit)) {
        options.limit = 1;
      }

      primaryKeys[tableName] = primaryKeys[tableName] || [];

      if (!!factory && primaryKeys[tableName].length < 1) {
        primaryKeys[tableName] = Object.keys(factory.primaryKeys)
      }

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
        "ON", this.quoteIdentifiers(tableName), (options.indexType ? ('USING ' + options.indexType) : undefined),
        '(' + transformedAttributes.join(', ') + ')'
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

    addLimitAndOffset: function(options, query){
      query = query || ""
      if (options.limit) {
        query += " LIMIT " + options.limit
      }

      if (options.offset) {
        query += " OFFSET " + options.offset
      }

      return query;
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
            dataType.originalType = "DATETIME"
            dataType.type = 'TIMESTAMP WITH TIME ZONE'
          }

          if (dataType.hasOwnProperty('allowNull') && (!dataType.allowNull)) {
            template += " NOT NULL"
          }

          if (dataType.autoIncrement) {
            template += " SERIAL"
          }

          if (Utils.defaultValueSchemable(dataType.defaultValue)) {
            // TODO thoroughly check that DataTypes.NOW will properly
            // get populated on all databases as DEFAULT value
            // i.e. mysql requires: DEFAULT CURRENT_TIMESTAMP
            template += " DEFAULT <%= defaultValue %>"
            replacements.defaultValue = this.escape(dataType.defaultValue)
          }

          if (dataType.unique === true) {
            template += " UNIQUE"
          }

          if (dataType.primaryKey) {
            template += " PRIMARY KEY"
          }

          if(dataType.references) {
            template += " REFERENCES <%= referencesTable %> (<%= referencesKey %>)"
            replacements.referencesTable = this.quoteIdentifiers(dataType.references)

            if(dataType.referencesKey) {
              replacements.referencesKey = this.quoteIdentifiers(dataType.referencesKey)
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

    createTrigger: function(tableName, triggerName, eventType, fireOnSpec, functionName, functionParams, optionsArray) {
      var sql = [
          'CREATE <%= constraintVal %>TRIGGER <%= triggerName %>'
          , '<%= eventType %> <%= eventSpec %>'
          , 'ON <%= tableName %>'
          , '<%= optionsSpec %>'
          , 'EXECUTE PROCEDURE <%= functionName %>(<%= paramList %>);'
        ].join('\n\t')

      return Utils._.template(sql)({
        constraintVal: this.triggerEventTypeIsConstraint(eventType),
        triggerName: triggerName,
        eventType: this.decodeTriggerEventType(eventType),
        eventSpec: this.expandTriggerEventSpec(fireOnSpec),
        tableName: tableName,
        optionsSpec: this.expandOptions(optionsArray),
        functionName: functionName,
        paramList: this.expandFunctionParamList(functionParams)
      })
    },

    dropTrigger: function(tableName, triggerName) {
      var sql = 'DROP TRIGGER <%= triggerName %> ON <%= tableName %> RESTRICT;'
      return Utils._.template(sql)({
        triggerName: triggerName,
        tableName: tableName
      })
    },

    renameTrigger: function(tableName, oldTriggerName, newTriggerName) {
      var sql = 'ALTER TRIGGER <%= oldTriggerName %> ON <%= tableName %> RENAME TO <%= newTriggerName%>;'
      return Utils._.template(sql)({
        tableName: tableName,
        oldTriggerName: oldTriggerName,
        newTriggerName: newTriggerName
      })
    },

    createFunction: function(functionName, params, returnType, language, body, options) {
      var sql = [ "CREATE FUNCTION <%= functionName %>(<%= paramList %>)"
          , "RETURNS <%= returnType %> AS $$"
          , "BEGIN"
          , "\t<%= body %>"
          , "END;"
          , "$$ language '<%= language %>'<%= options %>;"
      ].join('\n')

      return Utils._.template(sql)({
        functionName: functionName,
        paramList: this.expandFunctionParamList(params),
        returnType: returnType,
        body: body.replace('\n', '\n\t'),
        language: language,
        options: this.expandOptions(options)
      })
    },

    dropFunction: function(functionName, params) {
      // RESTRICT is (currently, as of 9.2) default but we'll be explicit
      var sql = 'DROP FUNCTION <%= functionName %>(<%= paramList %>) RESTRICT;'
      return Utils._.template(sql)({
        functionName: functionName,
        paramList: this.expandFunctionParamList(params)
      })
    },

    renameFunction: function(oldFunctionName, params, newFunctionName) {
      var sql = 'ALTER FUNCTION <%= oldFunctionName %>(<%= paramList %>) RENAME TO <%= newFunctionName %>;'
      return Utils._.template(sql)({
        oldFunctionName: oldFunctionName,
        paramList: this.expandFunctionParamList(params),
        newFunctionName: newFunctionName
      })
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

    expandFunctionParamList: function expandFunctionParamList(params) {
      if (Utils._.isUndefined(params) || !Utils._.isArray(params)) {
        throw new Error("expandFunctionParamList: function parameters array required, including an empty one for no arguments")
      }

      var paramList = Utils._.each(params, function expandParam(curParam){
        paramDef = []
        if (Utils._.has(curParam, 'type')) {
          if (Utils._.has(curParam, 'direction')) { paramDef.push(curParam.direction) }
          if (Utils._.has(curParam, 'name')) { paramDef.push(curParam.name) }
          paramDef.push(curParam.type)
        } else {
          throw new Error('createFunction called with a parameter with no type')
        }
        return paramDef.join(' ')
      })
      return paramList.join(', ')
    },

    expandOptions: function expandOptions(options) {
      return  Utils._.isUndefined(options) || Utils._.isEmpty(options) ?
          '' : '\n\t' + options.join('\n\t')
    },

    decodeTriggerEventType: function decodeTriggerEventType(eventSpecifier) {
      var EVENT_DECODER = {
        'after': 'AFTER',
        'before': 'BEFORE',
        'instead_of': 'INSTEAD OF',
        'after_constraint': 'AFTER'
      }

      if (!Utils._.has(EVENT_DECODER, eventSpecifier)) {
        throw new Error('Invalid trigger event specified: ' + eventSpecifier)
      }

      return EVENT_DECODER[eventSpecifier]
    },

    triggerEventTypeIsConstraint: function triggerEventTypeIsConstraint(eventSpecifier) {
      return eventSpecifier === 'after_constrain' ? 'CONSTRAINT ' : ''
    },

    expandTriggerEventSpec: function expandTriggerEventSpec(fireOnSpec) {
      if (Utils._.isEmpty(fireOnSpec)) {
        throw new Error('no table change events specified to trigger on')
      }

      return Utils._.map(fireOnSpec, function parseTriggerEventSpec(fireValue, fireKey){
        var EVENT_MAP = {
          'insert': 'INSERT',
          'update': 'UPDATE',
          'delete': 'DELETE',
          'truncate': 'TRUNCATE'
        }

        if (!Utils._.has(EVENT_MAP, fireKey)) {
          throw new Error('parseTriggerEventSpec: undefined trigger event ' + fireKey)
        }

        var eventSpec = EVENT_MAP[fireKey]
        if (eventSpec === 'UPDATE') {
          if (Utils._.isArray(fireValue) && fireValue.length > 0) {
            eventSpec += ' OF ' + fireValue.join(', ')
          }
        }

        return eventSpec
      }).join(' OR ')
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
        , values

      if (dataType.values) {
        values = "ENUM('"+dataType.values.join("', '")+"')";
      } else {
        values = dataType.toString().match(/^ENUM\(.+\)/)[0]
      }

      var sql = "CREATE TYPE " + enumName + " AS " + values + "; "
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

    pgEnumDrop: function(tableName, attr, enumName) {
      enumName = enumName || this.pgEscapeAndQuote("enum_" + tableName + "_" + attr)
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

      if (dataType.lastIndexOf('BLOB') !== -1 || dataType.lastIndexOf('BINARY') !== -1) {
        dataType = 'bytea'
      }

      if (dataType.match(/^ENUM\(/)) {
        dataType = dataType.replace(/^ENUM\(.+\)/, this.pgEscapeAndQuote("enum_" + tableName + "_" + attr))
      }

      return dataType
    },

    quoteIdentifier: function(identifier, force) {
      if (identifier === '*') return identifier
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

    quoteTable: function(table) {
      return this.quoteIdentifiers(table)
    },

    /**
     * Generates an SQL query that returns all foreign keys of a table.
     *
     * @param  {String} tableName  The name of the table.
     * @param  {String} schemaName The name of the schema.
     * @return {String}            The generated sql query.
     */
    getForeignKeysQuery: function(tableName, schemaName) {
      return "SELECT conname as constraint_name, pg_catalog.pg_get_constraintdef(r.oid, true) as condef FROM pg_catalog.pg_constraint r WHERE r.conrelid = (SELECT oid FROM pg_class WHERE relname = '" + tableName + "' LIMIT 1) AND r.contype = 'f' ORDER BY 1;"
    },

    /**
     * Generates an SQL query that removes a foreign key from a table.
     *
     * @param  {String} tableName  The name of the table.
     * @param  {String} foreignKey The name of the foreign key constraint.
     * @return {String}            The generated sql query.
     */
    dropForeignKeyQuery: function(tableName, foreignKey) {
      return 'ALTER TABLE ' + this.quoteIdentifier(tableName) + ' DROP CONSTRAINT ' + this.quoteIdentifier(foreignKey) + ';'
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

  return Utils._.extend(Utils._.clone(require("../abstract/query-generator")), QueryGenerator)
})()
