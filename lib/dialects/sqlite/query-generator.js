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
        where: this.getWhereConditions(where),
        limit: Utils.escape(options.limit)
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
