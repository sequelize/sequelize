var Utils = require("../../utils")
  , DataTypes = require("../../data-types")

var MySqlQueryGenerator = Utils._.extend(
  Utils._.clone(require("../query-generator")),
  Utils._.clone(require("../mysql/query-generator"))
)

var hashToWhereConditions = MySqlQueryGenerator.hashToWhereConditions

var escape = function(str) {
  if (typeof str === 'string') {
    return "'" + str.replace(/'/g, "''") + "'";
  } else if (typeof str === 'boolean') {
    return str ? 1 : 0; // SQLite has no type boolean
  } else if (str === null || str === undefined) {
    return 'NULL';
  } else {
    return str;
  }
};

module.exports = (function() {
  var QueryGenerator = {
    options: {},

    removeQuotes: function (s, quoteChar) {
      quoteChar = quoteChar || '`'
      return s.replace(new RegExp(quoteChar, 'g'), '')
    },

    addQuotes: function (s, quoteChar) {
      quoteChar = quoteChar || '`'
      return QueryGenerator.removeQuotes(s, quoteChar)
        .split('.')
        .map(function(e) { return quoteChar + String(e) + quoteChar })
        .join('.')
    },

    addSchema: function(opts) {
      var tableName     = undefined
      var schema        = (!!opts && !!opts.options && !!opts.options.schema ? opts.options.schema : undefined)
      var schemaPrefix  = (!!opts && !!opts.options && !!opts.options.schemaPrefix ? opts.options.schemaPrefix : undefined)

      if (!!opts && !!opts.tableName) {
        tableName = opts.tableName
      }
      else if (typeof opts === "string") {
        tableName = opts
      }

      if (!schema || schema.toString().trim() === "") {
        return tableName
      }

      return QueryGenerator.addQuotes(schema + (!schemaPrefix ? '.' : schemaPrefix) + tableName)
    },

    createSchema: function() {
      var query = "SELECT name FROM sqlite_master WHERE type='table' and name!='sqlite_sequence';"
      return Utils._.template(query)({})
    },

    dropSchema: function() {
      var query = "SELECT name FROM sqlite_master WHERE type='table' and name!='sqlite_sequence';"
      return Utils._.template(query)({})
    },

    showSchemasQuery: function() {
      return "SELECT name FROM sqlite_master WHERE type='table' and name!='sqlite_sequence';"
    },

    createTableQuery: function(tableName, attributes, options) {
      options = options || {}

      var query       = "CREATE TABLE IF NOT EXISTS <%= table %> (<%= attributes%>)"
        , primaryKeys = []
        , needsMultiplePrimaryKeys = (Utils._.values(attributes).filter(function(definition) {
                    return Utils._.includes(definition, 'PRIMARY KEY')
                  }).length > 1)
        , attrStr     = []


      for (var attr in attributes) {
        if (attributes.hasOwnProperty(attr)) {
          var dataType = attributes[attr]

          if (Utils._.includes(dataType, 'AUTOINCREMENT')) {
            dataType = dataType.replace(/BIGINT/, 'INTEGER')
          }

          if (Utils._.includes(dataType, 'PRIMARY KEY') && needsMultiplePrimaryKeys) {
            primaryKeys.push(attr)
            attrStr.push(Utils.addTicks(attr) + " " + dataType.replace(/PRIMARY KEY/, 'NOT NULL'))
          } else {
            attrStr.push(Utils.addTicks(attr) + " " + dataType)
          }
        }
      }

      var values = {
        table: Utils.addTicks(tableName),
        attributes: attrStr.join(", "),
        charset: (options.charset ? "DEFAULT CHARSET=" + options.charset : "")
      }
      , pkString = primaryKeys.map(function(pk) { return Utils.addTicks(pk) }).join(", ")

      if (pkString.length > 0) {
        values.attributes += ", PRIMARY KEY (" + pkString + ")"
      }

      var sql = Utils._.template(query, values).trim() + ";"
      return QueryGenerator.replaceBooleanDefaults(sql)
    },

    addColumnQuery: function() {
      var sql = MySqlQueryGenerator.addColumnQuery.apply(null, arguments)
      return QueryGenerator.replaceBooleanDefaults(sql)
    },

    showTablesQuery: function() {
      return "SELECT name FROM sqlite_master WHERE type='table' and name!='sqlite_sequence';"
    },

    insertQuery: function(tableName, attrValueHash) {
      attrValueHash = Utils.removeNullValuesFromHash(attrValueHash, this.options.omitNull)

      var query = "INSERT INTO <%= table %> (<%= attributes %>) VALUES (<%= values %>);";

      var replacements  = {
        table: Utils.addTicks(tableName),
        attributes: Object.keys(attrValueHash).map(function(attr){return Utils.addTicks(attr)}).join(","),
        values: Utils._.values(attrValueHash).map(function(value){
          return escape((value instanceof Date) ? Utils.toSqlDate(value) : value)
        }).join(",")
      }

      return Utils._.template(query)(replacements)
    },

    bulkInsertQuery: function(tableName, attrValueHashes) {
      var query = "INSERT INTO <%= table %> (<%= attributes %>) VALUES <%= tuples %>;"
        , tuples = []

      Utils._.forEach(attrValueHashes, function(attrValueHash) {
        tuples.push("(" +
          Utils._.values(attrValueHash).map(function(value){
            return escape((value instanceof Date) ? Utils.toSqlDate(value) : value)
          }).join(",") +
        ")")
      })

      var replacements  = {
        table: Utils.addTicks(tableName),
        attributes: Object.keys(attrValueHashes[0]).map(function(attr){return Utils.addTicks(attr)}).join(","),
        tuples: tuples
      }

      return Utils._.template(query)(replacements)
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
        var optAttributes = options.attributes === '*' ? [options.table + '.*'] : [options.attributes]

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

    updateQuery: function(tableName, attrValueHash, where) {
      attrValueHash = Utils.removeNullValuesFromHash(attrValueHash, this.options.omitNull)

      var query  = "UPDATE <%= table %> SET <%= values %> WHERE <%= where %>"
        , values = []

      for (var key in attrValueHash) {
        var value = attrValueHash[key]
        values.push(Utils.addTicks(key) + "=" + escape((value instanceof Date) ? Utils.toSqlDate(value) : value))
      }

      var replacements = {
        table: Utils.addTicks(tableName),
        values: values.join(","),
        where: MySqlQueryGenerator.getWhereConditions(where)
      }

      return Utils._.template(query)(replacements)
    },

    deleteQuery: function(tableName, where, options) {
      options = options || {}

      var query = "DELETE FROM <%= table %> WHERE <%= where %>"
      var replacements = {
        table: Utils.addTicks(tableName),
        where: MySqlQueryGenerator.getWhereConditions(where)
      }

      return Utils._.template(query)(replacements)
    },

    incrementQuery: function(tableName, attrValueHash, where) {
      attrValueHash = Utils.removeNullValuesFromHash(attrValueHash, this.options.omitNull)

      var query  = "UPDATE <%= table %> SET <%= values %> WHERE <%= where %>"
        , values = []

      for (var key in attrValueHash) {
        var value = attrValueHash[key]
        values.push(Utils.addTicks(key) + "=" + Utils.addTicks(key) + "+ " + escape((value instanceof Date) ? Utils.toSqlDate(value) : value))
      }

      var replacements = {
        table: Utils.addTicks(tableName),
        values: values.join(","),
        where: MySqlQueryGenerator.getWhereConditions(where)
      }

      return Utils._.template(query)(replacements)
    },

    attributesToSQL: function(attributes) {
      var result = {}

      for (var name in attributes) {
        var dataType = attributes[name]

        if (Utils.isHash(dataType)) {
          var template     = "<%= type %>"
            , replacements = { type: dataType.type }

          if (dataType.type.toString() === DataTypes.ENUM.toString()) {
            replacements.type = "TEXT"

            if (!(Array.isArray(dataType.values) && (dataType.values.length > 0))) {
              throw new Error('Values for ENUM haven\'t been defined.')
            }
          }

          if (dataType.hasOwnProperty('allowNull') && !dataType.allowNull && !dataType.primaryKey) {
            template += " NOT NULL"
          }

          if (dataType.defaultValue !== undefined) {
            template += " DEFAULT <%= defaultValue %>"
            replacements.defaultValue = Utils.escape(dataType.defaultValue)
          }

          if (dataType.unique) {
            template += " UNIQUE"
          }

          if (dataType.primaryKey) {
            template += " PRIMARY KEY"

            if (dataType.autoIncrement) {
              template += ' AUTOINCREMENT'
            }
          }

          if(dataType.references) {
            template += " REFERENCES <%= referencesTable %> (<%= referencesKey %>)"
            replacements.referencesTable = Utils.addTicks(dataType.references)

            if(dataType.referencesKey) {
              replacements.referencesKey = Utils.addTicks(dataType.referencesKey)
            } else {
              replacements.referencesKey = Utils.addTicks('id')
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
        if (factory.attributes.hasOwnProperty(name)) {
          var definition = factory.attributes[name]

          if (definition && (definition.indexOf('INTEGER PRIMARY KEY AUTOINCREMENT') === 0)) {
            fields.push(name)
          }
        }
      }

      return fields
    },

    enableForeignKeyConstraintsQuery: function() {
      var sql = "PRAGMA foreign_keys = ON;"
      return Utils._.template(sql, {})
    },

    disableForeignKeyConstraintsQuery: function() {
      var sql = "PRAGMA foreign_keys = OFF;"
      return Utils._.template(sql, {})
    },

    hashToWhereConditions: function(hash) {
      for (var key in hash) {
        if (hash.hasOwnProperty(key)) {
          var value = hash[key]

          if (typeof value === 'boolean') {
            value = !!value ? 1 : 0
          }

          hash[key] = value
        }
      }

      return hashToWhereConditions(hash).replace(/\\'/g, "''");
    },

    showIndexQuery: function(tableName) {
      var sql = "PRAGMA INDEX_LIST('<%= tableName %>')"
      return Utils._.template(sql, { tableName: tableName })
    },

    removeIndexQuery: function(tableName, indexNameOrAttributes) {
      var sql       = "DROP INDEX <%= indexName %>"
        , indexName = indexNameOrAttributes

      if (typeof indexName !== 'string') {
        indexName = Utils._.underscored(tableName + '_' + indexNameOrAttributes.join('_'))
      }

      return Utils._.template(sql, { tableName: tableName, indexName: indexName })
    },

    describeTableQuery: function(tableName) {
      var sql = "PRAGMA TABLE_INFO('<%= tableName %>');"
      return Utils._.template(sql, { tableName: tableName })
    },

    renameTableQuery: function(before, after) {
      var query = "ALTER TABLE `<%= before %>` RENAME TO `<%= after %>`;"
      return Utils._.template(query, { before: before, after: after })
    },

    removeColumnQuery: function(tableName, attributes) {
      attributes = QueryGenerator.attributesToSQL(attributes)

      var backupTableName = tableName + "_backup"
      var query = [
        QueryGenerator.createTableQuery(backupTableName, attributes).replace('CREATE TABLE', 'CREATE TEMPORARY TABLE'),
        "INSERT INTO <%= tableName %>_backup SELECT <%= attributeNames %> FROM <%= tableName %>;",
        "DROP TABLE <%= tableName %>;",
        QueryGenerator.createTableQuery(tableName, attributes),
        "INSERT INTO <%= tableName %> SELECT <%= attributeNames %> FROM <%= tableName %>_backup;",
        "DROP TABLE <%= tableName %>_backup;"
      ].join("")

      return Utils._.template(query, {
        tableName: tableName,
        attributeNames: Utils._.keys(attributes).join(', ')
      })
    },

    renameColumnQuery: function(tableName, attrNameBefore, attrNameAfter, attributes) {
      attributes = QueryGenerator.attributesToSQL(attributes)

      var backupTableName = tableName + "_backup"
      var query = [
        QueryGenerator.createTableQuery(backupTableName, attributes).replace('CREATE TABLE', 'CREATE TEMPORARY TABLE'),
        "INSERT INTO <%= tableName %>_backup SELECT <%= attributeNamesImport %> FROM <%= tableName %>;",
        "DROP TABLE <%= tableName %>;",
        QueryGenerator.createTableQuery(tableName, attributes),
        "INSERT INTO <%= tableName %> SELECT <%= attributeNamesExport %> FROM <%= tableName %>_backup;",
        "DROP TABLE <%= tableName %>_backup;"
      ].join("")

      return Utils._.template(query, {
        tableName: tableName,
        attributeNamesImport: Utils._.keys(attributes).map(function(attr) {
          return (attrNameAfter === attr) ? attrNameBefore + ' AS ' + attr : attr
        }).join(', '),
        attributeNamesExport: Utils._.keys(attributes).map(function(attr) {
          return attr
        }).join(', ')
      })
    },

    replaceBooleanDefaults: function(sql) {
      return sql.replace(/DEFAULT '?false'?/g, "DEFAULT 0").replace(/DEFAULT '?true'?/g, "DEFAULT 1")
    }
  }

  return Utils._.extend({}, MySqlQueryGenerator, QueryGenerator)
})()
