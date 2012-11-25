var Utils = require("../../utils")
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

      return Utils._.template(query)(values).trim() + ";"
    },

    showTablesQuery: function() {
      return "SELECT name FROM sqlite_master WHERE type='table' and name!='sqlite_sequence';"
    },

    insertQuery: function(tableName, attrValueHash) {
      attrValueHash = Utils.removeNullValuesFromHash(attrValueHash, this.options.omitNull)

      var query = "INSERT INTO <%= table %> (<%= attributes %>) VALUES (<%= values %>);";

      var replacements  = {
        table: Utils.addTicks(tableName),
        attributes: Utils._.keys(attrValueHash).map(function(attr){return Utils.addTicks(attr)}).join(","),
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

    attributesToSQL: function(attributes) {
      var result = {}

      for (var name in attributes) {
        var dataType = attributes[name]

        if(Utils.isHash(dataType)) {
          var template     = "<%= type %>"
            , replacements = { type: dataType.type }

          if (dataType.hasOwnProperty('allowNull') && !dataType.allowNull && !dataType.primaryKey) {
            template += " NOT NULL"
          }

          if(dataType.defaultValue != undefined) {
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
    }
  }

  return Utils._.extend(MySqlQueryGenerator, QueryGenerator)
})()
