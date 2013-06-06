var Utils = require("../../utils")
  , DataTypes = require("../../data-types")

var MySqlQueryGenerator = Utils._.extend(
  Utils._.clone(require("../query-generator")),
  Utils._.clone(require("../mysql/query-generator"))
)

var hashToWhereConditions = MySqlQueryGenerator.hashToWhereConditions

module.exports = (function() {
  var QueryGenerator = {
    options: {},

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

      return this.quoteIdentifier(schema) + (!schemaPrefix ? '.' : schemaPrefix) + this.quoteIdentifier(tableName)
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
    selectQuery: function(tableName, options) {
      var table = null,
          joinQuery = ""

      options            = options || {}
      options.table      = table = Array.isArray(tableName) ? tableName.map(function(t) { return this.quoteIdentifier(t)}.bind(this)).join(", ") : this.quoteIdentifier(tableName)
      options.attributes = options.attributes && options.attributes.map(function(attr){
        if(Array.isArray(attr) && attr.length == 2) {
          return [attr[0], this.quoteIdentifier(attr[1])].join(' as ')
        } else {
          return attr.indexOf(Utils.TICK_CHAR) < 0 ? this.quoteIdentifiers(attr) : attr
        }
      }.bind(this)).join(", ")
      options.attributes = options.attributes || '*'

      if (options.include) {
        var optAttributes = options.attributes === '*' ? [options.table + '.*'] : [options.attributes]

        options.include.forEach(function(include) {
          var attributes = Object.keys(include.daoFactory.attributes).map(function(attr) {
            return this.quoteIdentifier(include.as) + "." + this.quoteIdentifier(attr) + " AS " + this.quoteIdentifier(include.as + "." + attr)
          }.bind(this))

          optAttributes = optAttributes.concat(attributes)

          var table = include.daoFactory.tableName
          var as = include.as
          var tableLeft = ((include.association.associationType === 'BelongsTo') ? include.as : tableName)
          var attrLeft = 'id'
          var tableRight = ((include.association.associationType === 'BelongsTo') ? tableName : include.as)
          var attrRight = include.association.identifier
          joinQuery += " LEFT OUTER JOIN " + this.quoteIdentifier(table) + " AS " + this.quoteIdentifier(as) + " ON " + this.quoteIdentifier(tableLeft) + "." + this.quoteIdentifier(attrLeft) + " = " + this.quoteIdentifier(tableRight) + "." + this.quoteIdentifier(attrRight) + ""

        }.bind(this))

        options.attributes = optAttributes.join(', ')
      }

      var query = "SELECT " + options.attributes + " FROM " + options.table
      query += joinQuery

      if (options.hasOwnProperty('where')) {
        options.where = this.getWhereConditions(options.where, tableName)
        query += " WHERE " + options.where
      }

      if (options.group) {
        options.group = Array.isArray(options.group) ? options.group.map(function(t) { return this.quoteIdentifiers(t)}.bind(this)).join(', ') : qa(options.group)
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

    incrementQuery: function(tableName, attrValueHash, where) {
      attrValueHash = Utils.removeNullValuesFromHash(attrValueHash, this.options.omitNull)

      var query  = "UPDATE <%= table %> SET <%= values %> WHERE <%= where %>"
        , values = []

      for (var key in attrValueHash) {
        var value = attrValueHash[key]
        values.push(this.quoteIdentifier(key) + "=" + this.quoteIdentifier(key) + "+ " + this.escape(value))
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

          if (dataType.defaultValue !== undefined) {
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

      return hashToWhereConditions.call(this, hash).replace(/\\'/g, "''");
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

    replaceBooleanDefaults: function(sql) {
      return sql.replace(/DEFAULT '?false'?/g, "DEFAULT 0").replace(/DEFAULT '?true'?/g, "DEFAULT 1")
    },

    quoteIdentifier: function(identifier, force) {
      return Utils.addTicks(identifier, "`")
    },

    quoteIdentifiers: function(identifiers, force) {
      return identifiers.split('.').map(function(v) { return this.quoteIdentifier(v, force) }.bind(this)).join('.')
    },

    escape: function(value) {
      if (value instanceof Date) {
        value = Utils.toSqlDate(value)
      }

      if (typeof value === 'string') {
        return "'" + value.replace(/'/g, "''") + "'";
      } else if (typeof value === 'boolean') {
        return value ? 1 : 0; // SQLite has no type boolean
      } else if (value === null || value === undefined) {
        return 'NULL';
      } else {
        return value;
      }
    }

  }

  return Utils._.extend({}, MySqlQueryGenerator, QueryGenerator)
})()
