var Utils = require("./utils")

var QueryGenerator = module.exports = {
  /*
    Returns a query for creating a table.
    Attributes should have the format: {attributeName: type, attr2: type2} --> {title: 'VARCHAR(255)'}
  */
  createTableQuery: function(tableName, attributes, options) {
    options = options || {}
    
    var query   = "CREATE TABLE IF NOT EXISTS `<%= table %>` (<%= attributes%>);"
      , attrStr = Utils._.map(attributes, function(dataType, attr) { return Utils.addTicks(attr) + " " + dataType}).join(", ")
      , values  = {table: tableName, attributes: attrStr}
    
    return  Utils._.template(query)(values)
  },
  
  dropTableQuery: function(tableName, options) {
    options = options || {}
    
    var query = "DROP TABLE IF EXISTS `<%= table %>`;"
    
    return Utils._.template(query)({table: tableName})
  },
  
  selectQuery: function(tableName, options) {
    options = options || {}
    options.table = tableName
    options.attributes = options.attributes || '*'
    
    var query = "SELECT <%= attributes %> FROM `<%= table %>`"
    
    if(options.where) {
      if(Utils.isHash(options.where))
        options.where = QueryGenerator.hashToWhereConditions(values.where)
      else if(typeof options.where == 'number')
        options.where = Utils.addTicks('id') + "=" + options.where
      query += " WHERE <%= where %>"
    }
    if(options.order) query += " ORDER BY <%= order %>"
    if(options.group) query += " GROUP BY <%= group %>"
    if(options.limit) {
      if(options.offset) query += " LIMIT <%= offset %>, <%= limit %>"
      else query += " LIMIT <%= limit %>"
    }
    
    query += ";"
    
    return Utils._.template(query)(options)
  },
  
  // TODO
  insertQuery: function(tableName, attributes, values) {
    // query = "INSERT INTO `%{table}` (%{fields}) VALUES (%{values})"
  },

  // TODO
  updateQuery: function(tableName, values, where) {
    // if(Sequelize.Helper.Hash.isHash(values.values))
    //   values.values = Sequelize.Helper.SQL.hashToWhereConditions(values.values)
    //   
    // query = "UPDATE `%{table}` SET %{values} WHERE `id`=%{id}"
  },
  
  // TODO
  deleteQuery: function(tableName, where) {
    // if(Sequelize.Helper.Hash.isHash(values.where))
    //   values.where = Sequelize.Helper.SQL.hashToWhereConditions(values.where)
    //   
    // query = "DELETE FROM `%{table}` WHERE %{where}"
    // if(typeof values.limit == 'undefined') query += " LIMIT 1"
    // else if(values.limit != null) query += " LIMIT " + values.limit
  },
  
  
  
  
  
  
  /*
    Takes a hash and transforms it into a mysql where condition: {key: value, key2: value2} ==> key=value AND key2=value2
    The values are transformed by the relevant datatype.
  */
  hashToWhereConditions: function(hash) {
    return Utils._.map(hash, function(value, key) {
      var dataType = Utils.getDataTypeForValue(value)
        , _value   = Utils.transformValueByDataType(value, dataType)
        , _key     = Utils.addTicks(key)
      
      return (_value == 'NULL') ? _key + " IS NULL" : [_key, _value].join("=")
    }).join(" AND ")
  }
}