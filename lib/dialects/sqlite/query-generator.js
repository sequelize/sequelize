var Utils = require("../../utils")
  , util  = require("util")

var escape = function(str) {
  if (typeof str === 'string') {
    return "'" + str.replace(/'/g, "''") + "'"
  } else if(str === null) {
    return 'NULL'
  } else {
    return str
  }
};

module.exports = (function() {
  var QueryGenerator = {
    createTableQuery: function(tableName, attributes, options) {
      options = options || {}

      var query       = "CREATE TABLE IF NOT EXISTS <%= table %> (<%= attributes%>)"
        , primaryKeys = []
        , attrStr     = Utils._.map(attributes, function(dataType, attr) {
            if (Utils._.includes(dataType, 'PRIMARY KEY')) {
              primaryKeys.push(attr)
              return Utils.addTicks(attr) + " " + dataType
            } else {
              return Utils.addTicks(attr) + " " + dataType
            }
          }).join(", ")
        , values = {
            table: Utils.addTicks(tableName),
            attributes: attrStr,
            charset: (options.charset ? "DEFAULT CHARSET=" + options.charset : "")
          }

      return Utils._.template(query)(values).trim() + ";"
    },

    showTablesQuery: function() {
      return "SELECT name FROM sqlite_master WHERE type='table';"
    },

    insertQuery: function(tableName, attrValueHash) {
      var query = "INSERT INTO <%= table %> (<%= attributes %>) VALUES (<%= values %>);";

      var replacements  = {
        table: Utils.addTicks(tableName),
        attributes: Utils._.keys(attrValueHash).map(function(attr){return Utils.addTicks(attr)}).join(","),
        values: Utils._.values(attrValueHash).map(function(value){

          //SQLite has no type boolean :
          if (typeof value === "boolean") {
            value = value ? 1 : 0;
          }

          return escape((value instanceof Date) ? Utils.toSqlDate(value) : value)
        }).join(",")
      }

      return Utils._.template(query)(replacements)
    },

    updateQuery: function(tableName, values, where) {
      var query = "UPDATE <%= table %> SET <%= values %> WHERE <%= where %>"
      var replacements = {
        table: Utils.addTicks(tableName),
        values: Utils._.map(values, function(value, key){
          return Utils.addTicks(key) + "=" + escape((value instanceof Date) ? Utils.toSqlDate(value) : value)
        }).join(","),
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

      Utils._.map(attributes, function(dataType, name) {
        if(Utils.isHash(dataType)) {
          var template     = "<%= type %>"
            , replacements = { type: dataType.type }

          if(dataType.hasOwnProperty('allowNull') && !dataType.allowNull && !dataType.primaryKey)
            template += " NOT NULL"

          if(dataType.defaultValue != undefined) {
            template += " DEFAULT <%= defaultValue %>"
            replacements.defaultValue = Utils.escape(dataType.defaultValue)
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
        var isAutoIncrementField = (definition && (definition.indexOf('INTEGER PRIMARY KEY') == 0))
        return isAutoIncrementField ? name : null
      })

      return Utils._.compact(fields)
    }
  }

  var MySqlQueryGenerator = Utils._.extend(
    Utils._.clone(require("../query-generator")),
    Utils._.clone(require("../mysql/query-generator"))
  )

  return Utils._.extend(MySqlQueryGenerator, QueryGenerator)
})()
