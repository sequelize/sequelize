var Utils  = require("./utils")

var QueryGenerator = module.exports = {
  /*
    Returns a query for creating a table.
    Attributes should have the format: {attributeName: type, attr2: type2} --> {title: 'VARCHAR(255)'}
  */
  createTableQuery: function(tableName, attributes, options) {
    options = options || {}

    var query   = "CREATE TABLE IF NOT EXISTS <%= table %> (<%= attributes%>) ENGINE=<%= engine %> <%= charset %>"
      , primaryKeys = []
      , attrStr = Utils._.map(attributes, function(dataType, attr) {
          var dt = dataType
          if (Utils._.includes(dt, 'PRIMARY KEY')) {
            primaryKeys.push(attr)
            return Utils.addTicks(attr) + " " + dt.replace(/PRIMARY KEY/, '')
          } else {
            return Utils.addTicks(attr) + " " + dt
          }
        }).join(", ")
      , values  = {
          table: Utils.addTicks(tableName),
          attributes: attrStr,
          engine: options.engine || 'InnoDB',
          charset: (options.charset ? "DEFAULT CHARSET=" + options.charset : "")
        }
      , pkString = primaryKeys.map(function(pk) {return Utils.addTicks(pk)}).join(", ")

    if(pkString.length > 0) values.attributes += ", PRIMARY KEY (" + pkString + ")"

    return Utils._.template(query)(values).trim() + ";"
  },

  dropTableQuery: function(tableName, options) {
    options = options || {}

    var query = "DROP TABLE IF EXISTS <%= table %>;"

    return Utils._.template(query)({table: Utils.addTicks(tableName)})
  },

  /*
    Returns a query for selecting elements in the database <tableName>.
    Options:
      - attributes -> An array of attributes (e.g. ['name', 'birthday']). Default: *
      - where -> A hash with conditions (e.g. {name: 'foo'})
                 OR an ID as integer
                 OR a string with conditions (e.g. 'name="foo"').
                 If you use a string, you have to escape it on your own.
      - order -> e.g. 'id DESC'
      - group
      - limit -> The maximum count you want to get.
      - offset -> An offset value to start from. Only useable with limit!
  */
  selectQuery: function(tableName, options) {
    options = options || {}
    options.table = Array.isArray(tableName) ? tableName.map(function(tbl){return Utils.addTicks(tbl)}).join(", ") : Utils.addTicks(tableName)
    options.attributes = options.attributes && options.attributes.map(function(attr){return attr.indexOf(Utils.TICK_CHAR)<0 ? Utils.addTicks(attr) : attr}).join(", ")
    options.attributes = options.attributes || '*'

    var query = "SELECT <%= attributes %> FROM <%= table %>"

    if(options.where) {
      options.where = QueryGenerator.getWhereConditions(options.where)
      query += " WHERE <%= where %>"
    }
    if(options.order) query += " ORDER BY <%= order %>"
    if(options.group) {
      options.group = Utils.addTicks(options.group)
      query += " GROUP BY <%= group %>"
    }
    if(options.limit) {
      if(options.offset) query += " LIMIT <%= offset %>, <%= limit %>"
      else query += " LIMIT <%= limit %>"
    }

    query += ";"

    return Utils._.template(query)(options)
  },

  countQuery: function(tableName, options) {
    return QueryGenerator.selectQuery(tableName, options).replace("*", "count(*)")
  },
  maxQuery: function(tableName, field,options) {
    return QueryGenerator.selectQuery(tableName ,options).replace("*", "max("+field+") as max")
  },
  minQuery: function(tableName, field,options) {
    return QueryGenerator.selectQuery(tableName ,options).replace("*", "min("+field+") as min")
  },
  /*
    Returns an insert into command. Parameters: table name + hash of attribute-value-pairs.
  */
  insertQuery: function(tableName, attrValueHash) {
    var query = "INSERT INTO <%= table %> (<%= attributes %>) VALUES (<%= values %>);"

    var replacements  = {
      table: Utils.addTicks(tableName),
      attributes: Utils._.keys(attrValueHash).map(function(attr){return Utils.addTicks(attr)}).join(","),
      values: Utils._.values(attrValueHash).map(function(value){
        return Utils.escape((value instanceof Date) ? Utils.toSqlDate(value) : value)
      }).join(",")
    }

    return Utils._.template(query)(replacements)
  },

  /*
    Returns an update query.
    Parameters:
      - tableName -> Name of the table
      - values -> A hash with attribute-value-pairs
      - where -> A hash with conditions (e.g. {name: 'foo'})
                 OR an ID as integer
                 OR a string with conditions (e.g. 'name="foo"').
                 If you use a string, you have to escape it on your own.
  */
  updateQuery: function(tableName, values, where) {
    var query = "UPDATE <%= table %> SET <%= values %> WHERE <%= where %>"
    var replacements = {
      table: Utils.addTicks(tableName),
      values: Utils._.map(values, function(value, key){
        return Utils.addTicks(key) + "=" + Utils.escape((value instanceof Date) ? Utils.toSqlDate(value) : value)
      }).join(","),
      where: QueryGenerator.getWhereConditions(where)
    }

    return Utils._.template(query)(replacements)
  },

  /*
    Returns a deletion query.
    Parameters:
      - tableName -> Name of the table
      - where -> A hash with conditions (e.g. {name: 'foo'})
                 OR an ID as integer
                 OR a string with conditions (e.g. 'name="foo"').
                 If you use a string, you have to escape it on your own.
    Options:
      - limit -> Maximaum count of lines to delete
  */
  deleteQuery: function(tableName, where, options) {
    options = options || {}
    options.limit = options.limit || 1

    var query = "DELETE FROM <%= table %> WHERE <%= where %> LIMIT <%= limit %>"
    var replacements = {
      table: Utils.addTicks(tableName),
      where: QueryGenerator.getWhereConditions(where),
      limit: Utils.escape(options.limit)
    }

    return Utils._.template(query)(replacements)
  },

  /*
    Takes something and transforms it into values of a where condition.
  */
  getWhereConditions: function(smth) {
    var result = null

    if(Utils.isHash(smth))
      result = QueryGenerator.hashToWhereConditions(smth)
    else if(typeof smth == 'number')
      result = Utils.addTicks('id') + "=" + Utils.escape(smth)
    else if(typeof smth == "string")
      result = smth
    else if(Array.isArray(smth))
      result = Utils.format(smth)

    return result
  },

  /*
    Takes a hash and transforms it into a mysql where condition: {key: value, key2: value2} ==> key=value AND key2=value2
    The values are transformed by the relevant datatype.
  */
  hashToWhereConditions: function(hash) {
    return Utils._.map(hash, function(value, key) {
      //handle qualified key names
      var _key = key.split('.').map(function(col){return Utils.addTicks(col)}).join(".") 
      var _value = null

      if(Array.isArray(value)) {
        _value = "(" + Utils._.map(value, function(subvalue) {
          return Utils.escape(subvalue);
        }).join(',') + ")"

        return [_key, _value].join(" IN ")
      } 
      else if (typeof value == 'object') {
        //using as sentinel for join column => value
        _value = value.join.split('.').map(function(col){return Utils.addTicks(col)}).join(".") 
        return [_key, _value].join("=")
      } else {
        _value = Utils.escape(value)
        return (_value == 'NULL') ? _key + " IS NULL" : [_key, _value].join("=")
      }
    }).join(" AND ")
  }
}
