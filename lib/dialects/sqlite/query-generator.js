var Utils       = require("../../utils")
  , DataTypes   = require("../../data-types")
  , SqlString   = require("../../sql-string")
  , Transaction = require("../../transaction")

var MySqlQueryGenerator = Utils._.extend(
  Utils._.clone(require("../abstract/query-generator")),
  Utils._.clone(require("../mysql/query-generator"))
)

var hashToWhereConditions = MySqlQueryGenerator.hashToWhereConditions

module.exports = (function() {
  var QueryGenerator = {
    options: {},
    dialect: 'sqlite',

    addSchema: function(opts) {
      var tableName       = undefined
      var schema          = (!!opts && !!opts.options && !!opts.options.schema ? opts.options.schema : undefined)
      var schemaDelimiter = (!!opts && !!opts.options && !!opts.options.schemaDelimiter ? opts.options.schemaDelimiter : undefined)

      if (!!opts && !!opts.tableName) {
        tableName = opts.tableName
      }
      else if (typeof opts === "string") {
        tableName = opts
      }

      if (!schema || schema.toString().trim() === "") {
        return tableName
      }

      return this.quoteIdentifier(schema) + (!schemaDelimiter ? '.' : schemaDelimiter) + this.quoteIdentifier(tableName)
    },

    createSchema: function() {
      var query = "SELECT name FROM sqlite_master WHERE type='table' and name!='sqlite_sequence';"
      return Utils._.template(query)({})
    },

    dropSchema: function(tableName, options) {
      return this.dropTableQuery(tableName, options)
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
        , modifierLastIndex = -1

      for (var attr in attributes) {
        if (attributes.hasOwnProperty(attr)) {
          var dataType = attributes[attr]

          if (Utils._.includes(dataType, 'AUTOINCREMENT')) {
            dataType = dataType.replace(/BIGINT/, 'INTEGER')
          }

          // SQLite thinks that certain modifiers should come before the length declaration,
          // whereas other dialects want them after, see http://www.sqlite.org/lang_createtable.html.

          // Start by finding the index of the last of the modifiers
          ['UNSIGNED', 'BINARY', 'ZEROFILL'].forEach(function (modifier) {
            var tmpIndex = dataType.indexOf(modifier)

            if (tmpIndex > modifierLastIndex) {
              modifierLastIndex = tmpIndex + modifier.length
            }
          })
          if (modifierLastIndex) {
            // If a modifier was found, and a lenght declaration is given before the modifier, move the length
            var length = dataType.match(/\(\s*\d+(\s*,\s*\d)?\s*\)/)
            if (length && length.index < modifierLastIndex) {
              dataType = dataType.replace(length[0], '')

              // Since the legnth was placed before the modifier, removing the legnth has changed the index
              if (length.index < modifierLastIndex) {
                modifierLastIndex -= length[0].length
              }
              dataType = Utils._.insert(dataType, modifierLastIndex, length[0]).trim()
            }

            modifierLastIndex = -1
          }

          if (Utils._.includes(dataType, 'PRIMARY KEY') && needsMultiplePrimaryKeys) {
            primaryKeys.push(attr)
            attrStr.push(this.quoteIdentifier(attr) + " " + dataType.replace(/PRIMARY KEY/, 'NOT NULL'))
          } else {
            attrStr.push(this.quoteIdentifier(attr) + " " + dataType)
          }
        }
      }

      var values = {
        table: this.quoteIdentifier(tableName),
        attributes: attrStr.join(", "),
        charset: (options.charset ? "DEFAULT CHARSET=" + options.charset : "")
      }
      , pkString = primaryKeys.map(function(pk) { return this.quoteIdentifier(pk) }.bind(this)).join(", ")

      if (pkString.length > 0) {
        values.attributes += ", PRIMARY KEY (" + pkString + ")"
      }

      var sql = Utils._.template(query, values).trim() + ";"
      return this.replaceBooleanDefaults(sql)
    },

    booleanValue: function(value){
      return !!value ? 1 : 0;
    },

    dropTableQuery: function(tableName, options) {
      options = options || {}

      var query = "DROP TABLE IF EXISTS <%= table %>;"

      return Utils._.template(query)({
        table: this.quoteIdentifier(tableName)
      })
    },

    addLimitAndOffset: function(options, query){
      if (options.offset && !options.limit) {
        query += " LIMIT " + options.offset + ", " + 10000000000000;
      } else if (options.limit && !(options.include && (options.limit === 1))) {
        if (options.offset) {
          query += " LIMIT " + options.offset + ", " + options.limit
        } else {
          query += " LIMIT " + options.limit
        }
      }
      return query;
    },

    addColumnQuery: function() {
      var sql = MySqlQueryGenerator.addColumnQuery.apply(this, arguments)
      return this.replaceBooleanDefaults(sql)
    },

    showTablesQuery: function() {
      return "SELECT name FROM sqlite_master WHERE type='table' and name!='sqlite_sequence';"
    },

    insertQuery: function(tableName, attrValueHash) {
      attrValueHash = Utils.removeNullValuesFromHash(attrValueHash, this.options.omitNull)

      var query = "INSERT INTO <%= table %> (<%= attributes %>) VALUES (<%= values %>);";

      var replacements  = {
        table: this.quoteIdentifier(tableName),
        attributes: Object.keys(attrValueHash).map(function(attr){return this.quoteIdentifier(attr)}.bind(this)).join(","),
        values: Utils._.values(attrValueHash).map(function(value){
          return this.escape(value)
        }.bind(this)).join(",")
      }

      return Utils._.template(query)(replacements)
    },

    bulkInsertQuery: function(tableName, attrValueHashes) {
      var query = "INSERT INTO <%= table %> (<%= attributes %>) VALUES <%= tuples %>;"
        , tuples = []

      Utils._.forEach(attrValueHashes, function(attrValueHash) {
        tuples.push("(" +
          Utils._.values(attrValueHash).map(function(value){
            return this.escape(value)
          }.bind(this)).join(",") +
        ")")
      }.bind(this))

      var replacements  = {
        table: this.quoteIdentifier(tableName),
        attributes: Object.keys(attrValueHashes[0]).map(function(attr){return this.quoteIdentifier(attr)}.bind(this)).join(","),
        tuples: tuples
      }

      return Utils._.template(query)(replacements)
    },

    updateQuery: function(tableName, attrValueHash, where, options) {
      attrValueHash = Utils.removeNullValuesFromHash(attrValueHash, this.options.omitNull, options)

      var query  = "UPDATE <%= table %> SET <%= values %> WHERE <%= where %>"
        , values = []

      for (var key in attrValueHash) {
        var value = attrValueHash[key]
        values.push(this.quoteIdentifier(key) + "=" + this.escape(value))
      }

      var replacements = {
        table: this.quoteIdentifier(tableName),
        values: values.join(","),
        where: this.getWhereConditions(where)
      }

      return Utils._.template(query)(replacements)
    },

    deleteQuery: function(tableName, where, options) {
      options = options || {}

      var query = "DELETE FROM <%= table %> WHERE <%= where %>"
      var replacements = {
        table: this.quoteIdentifier(tableName),
        where: this.getWhereConditions(where)
      }

      return Utils._.template(query)(replacements)
    },

    incrementQuery: function(tableName, attrValueHash, where, options) {
      attrValueHash = Utils.removeNullValuesFromHash(attrValueHash, this.options.omitNull)

      var query  = "UPDATE <%= table %> SET <%= values %> WHERE <%= where %>"
        , values = []

      for (var key in attrValueHash) {
        var value = attrValueHash[key]
        values.push(this.quoteIdentifier(key) + "=" + this.quoteIdentifier(key) + "+ " + this.escape(value))
      }

      options = options || {}
      for (var key in options) {
        var value = options[key];
        values.push(this.quoteIdentifier(key) + "=" + this.escape(value))
      }

      var replacements = {
        table: this.quoteIdentifier(tableName),
        values: values.join(","),
        where: this.getWhereConditions(where)
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

          if (Utils.defaultValueSchemable(dataType.defaultValue)) {
            // TODO thoroughly check that DataTypes.NOW will properly
            // get populated on all databases as DEFAULT value
            // i.e. mysql requires: DEFAULT CURRENT_TIMESTAMP
            template += " DEFAULT <%= defaultValue %>"
            replacements.defaultValue = this.escape(dataType.defaultValue)
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

    showIndexQuery: function(tableName) {
      var sql = "PRAGMA INDEX_LIST('<%= tableName %>')"
      return Utils._.template(sql, { tableName: tableName })
    },

    removeIndexQuery: function(tableName, indexNameOrAttributes) {
      var sql       = "DROP INDEX IF EXISTS <%= indexName %>"
        , indexName = indexNameOrAttributes

      if (typeof indexName !== 'string') {
        indexName = Utils._.underscored(tableName + '_' + indexNameOrAttributes.join('_'))
      }

      return Utils._.template(sql, { tableName: tableName, indexName: indexName })
    },

    describeTableQuery: function(tableName, schema, schemaDelimiter) {
      var options = {}
      options.schema = schema || null
      options.schemaDelimiter = schemaDelimiter || null

      var sql = "PRAGMA TABLE_INFO('<%= tableName %>');"
      return Utils._.template(sql, { tableName: this.addSchema({tableName: tableName, options: options})})
    },

    renameTableQuery: function(before, after) {
      var query = "ALTER TABLE `<%= before %>` RENAME TO `<%= after %>`;"
      return Utils._.template(query, { before: before, after: after })
    },

    removeColumnQuery: function(tableName, attributes) {
      attributes = this.attributesToSQL(attributes)

      var backupTableName = tableName + "_backup"
      var query = [
        this.createTableQuery(backupTableName, attributes).replace('CREATE TABLE', 'CREATE TEMPORARY TABLE'),
        "INSERT INTO <%= tableName %>_backup SELECT <%= attributeNames %> FROM <%= tableName %>;",
        "DROP TABLE <%= tableName %>;",
        this.createTableQuery(tableName, attributes),
        "INSERT INTO <%= tableName %> SELECT <%= attributeNames %> FROM <%= tableName %>_backup;",
        "DROP TABLE <%= tableName %>_backup;"
      ].join("")

      return Utils._.template(query, {
        tableName: tableName,
        attributeNames: Utils._.keys(attributes).join(', ')
      })
    },

    renameColumnQuery: function(tableName, attrNameBefore, attrNameAfter, attributes) {
      attributes = this.attributesToSQL(attributes)

      var backupTableName = tableName + "_backup"
      var query = [
        this.createTableQuery(backupTableName, attributes).replace('CREATE TABLE', 'CREATE TEMPORARY TABLE'),
        "INSERT INTO <%= tableName %>_backup SELECT <%= attributeNamesImport %> FROM <%= tableName %>;",
        "DROP TABLE <%= tableName %>;",
        this.createTableQuery(tableName, attributes),
        "INSERT INTO <%= tableName %> SELECT <%= attributeNamesExport %> FROM <%= tableName %>_backup;",
        "DROP TABLE <%= tableName %>_backup;"
      ].join("")

      return Utils._.template(query, {
        tableName: tableName,
        attributeNamesImport: Utils._.keys(attributes).map(function(attr) {
          return (attrNameAfter === attr) ? attrNameBefore + ' AS ' + attr : attr
        }.bind(this)).join(', '),
        attributeNamesExport: Utils._.keys(attributes).map(function(attr) {
          return attr
        }.bind(this)).join(', ')
      })
    },

    startTransactionQuery: function(options) {
      return "BEGIN TRANSACTION;"
    },

    setAutocommitQuery: function(value) {
      return "-- SQLite does not support SET autocommit."
    },

    setIsolationLevelQuery: function(value) {
      switch (value) {
        case Transaction.ISOLATION_LEVELS.REPEATABLE_READ:
          return "-- SQLite is not able to choose the isolation level REPEATABLE READ."
        case Transaction.ISOLATION_LEVELS.READ_UNCOMMITTED:
          return "PRAGMA read_uncommitted = ON;"
        case Transaction.ISOLATION_LEVELS.READ_COMMITTED:
          return "PRAGMA read_uncommitted = OFF;"
        case Transaction.ISOLATION_LEVELS.SERIALIZABLE:
          return "-- SQLite's default isolation level is SERIALIZABLE. Nothing to do."
        default:
          throw new Error('Unknown isolation level: ' + value)
      }
    },

    replaceBooleanDefaults: function(sql) {
      return sql.replace(/DEFAULT '?false'?/g, "DEFAULT 0").replace(/DEFAULT '?true'?/g, "DEFAULT 1")
    },

    quoteIdentifier: function(identifier, force) {
      return Utils.addTicks(identifier, "`")
    },

    quoteIdentifiers: function(identifiers, force) {
      return identifiers.split('.').map(function(v) { return this.quoteIdentifier(v, force) }.bind(this)).join('.')
    },

        /**
     * Generates an SQL query that returns all foreign keys of a table.
     *
     * @param  {String} tableName  The name of the table.
     * @param  {String} schemaName The name of the schema.
     * @return {String}            The generated sql query.
     */
    getForeignKeysQuery: function(tableName, schemaName) {
      return "PRAGMA foreign_key_list(\"" + tableName + "\")"
    }
  }

  return Utils._.extend({}, MySqlQueryGenerator, QueryGenerator)
})()
