var Utils  = require("./utils")
  , client = new (require("mysql").Client)()

var QueryGenerator = module.exports = {
  /*
    Returns a query for creating a table.
    Attributes should have the format: {attributeName: type, attr2: type2} --> {title: 'VARCHAR(255)'}
  */
  createTableQuery: function(tableName, attributes, options) {
    options = options || {}
    
    var query   = "CREATE TABLE IF NOT EXISTS <%= table %> (<%= attributes%>);"
      , attrStr = Utils._.map(attributes, function(dataType, attr) { return Utils.addTicks(attr) + " " + dataType}).join(", ")
      , values  = {table: Utils.addTicks(tableName), attributes: attrStr}
    
    return  Utils._.template(query)(values)
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
    options.table = Utils.addTicks(tableName)
    options.attributes = options.attributes && options.attributes.map(function(attr){return Utils.addTicks(attr)}).join(", ")
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
  
  /*
    Returns an insert into command. Parameters: table name + hash of attribute-value-pairs.
  */
  insertQuery: function(tableName, attrValueHash) {
    var query = "INSERT INTO <%= table %> (<%= attributes %>) VALUES (<%= values %>);"
    
    var replacements  = {
      table: Utils.addTicks(tableName),
      attributes: Utils._.keys(attrValueHash).map(function(attr){return Utils.addTicks(attr)}).join(","),
      values: Utils._.values(attrValueHash).map(function(value){
        return client.escape((value instanceof Date) ? Utils.toSqlDate(value) : value)
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
        return Utils.addTicks(key) + "=" + client.escape((value instanceof Date) ? Utils.toSqlDate(value) : value)
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
      limit: client.escape(options.limit)
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
      result = Utils.addTicks('id') + "=" + client.escape(smth)
    else if(typeof smth == "string")
      result = smth
    
    return result
  },
  
  /*
    Takes a hash and transforms it into a mysql where condition: {key: value, key2: value2} ==> key=value AND key2=value2
    The values are transformed by the relevant datatype.
  */
  hashToWhereConditions: function(hash) {
    return Utils._.map(hash, function(value, key) {
      var _value = client.escape(value)
        , _key   = Utils.addTicks(key)
      
      return (_value == 'NULL') ? _key + " IS NULL" : [_key, _value].join("=")
    }).join(" AND ")
  }
}