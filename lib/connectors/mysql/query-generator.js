var Utils = require("../../utils")

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

  renameTableQuery: function(before, after) {
    var query = "RENAME TABLE `<%= before %>` TO `<%= after %>`;"
    return Utils._.template(query)({ before: before, after: after })
  },

  addColumnQuery: function(tableName, attributes) {
    var query      = "ALTER TABLE `<%= tableName %>` ADD <%= attributes %>;"
      , attrString = Utils._.map(attributes, function(definition, attributeName) {
          return Utils._.template('`<%= attributeName %>` <%= definition %>')({
            attributeName: attributeName,
            definition: definition
          })
        }).join(', ')

    return Utils._.template(query)({ tableName: tableName, attributes: attrString })
  },

  removeColumnQuery: function(tableName, attributeName) {
    var query = "ALTER TABLE `<%= tableName %>` DROP `<%= attributeName %>`;"
    return Utils._.template(query)({ tableName: tableName, attributeName: attributeName })
  },

  changeColumnQuery: function(tableName, attributes) {
    var query      = "ALTER TABLE `<%= tableName %>` CHANGE <%= attributes %>;"
    var attrString = Utils._.map(attributes, function(definition, attributeName) {
      return Utils._.template('`<%= attributeName %>` `<%= attributeName %>` <%= definition %>')({
        attributeName: attributeName,
        definition: definition
      })
    }).join(', ')

    return Utils._.template(query)({ tableName: tableName, attributes: attrString })
  },

  renameColumnQuery: function(tableName, attrBefore, attributes) {
    var query      = "ALTER TABLE `<%= tableName %>` CHANGE <%= attributes %>;"
    var attrString = Utils._.map(attributes, function(definition, attributeName) {
      return Utils._.template('`<%= before %>` `<%= after %>` <%= definition %>')({
        before: attrBefore,
        after: attributeName,
        definition: definition
      })
    }).join(', ')

    return Utils._.template(query)({ tableName: tableName, attributes: attrString })
  },

  selectQuery: function(tableName, options) {
    options = options || {}
    options.table = Utils.addTicks(tableName)
    options.attributes = options.attributes && options.attributes.map(function(attr){
      if(Array.isArray(attr) && attr.length == 2)
        return [attr[0], Utils.addTicks(attr[1])].join(' as ')
      else
        return Utils.addTicks(attr)
    }).join(", ")
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

  addIndexQuery: function(tableName, attributes, options) {
    // var sql = [
    //   "CREATE <%= indicesType %> INDEX <%= name %>",
    //   "<%= indexType %> ON <%= tableName %> <%= columns %>",
    //   "<%= parser %>"
    // ].join(' ')

    // return Utils._.template(sql)({
    //   indicesType: options.indicesType || '',
    //   name: options.indexName,
    //   indexType: options.indexType ? 'USING ' + options.indexType : undefined,

    // })

    /*
      CREATE [UNIQUE|FULLTEXT|SPATIAL] INDEX index_name
        [USING index_type]
        ON tbl_name (index_col_name,...)
        [WITH PARSER parser_name]

      index_col_name:
        col_name [(length)] [ASC | DESC]
  */

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
      var _key   = Utils.addTicks(key)
        , _value = null

      if(Array.isArray(value)) {
        _value = "(" + Utils._.map(value, function(subvalue) {
          return Utils.escape(subvalue);
        }).join(',') + ")"

        return [_key, _value].join(" IN ")
      } else {
        _value = Utils.escape(value)
        return (_value == 'NULL') ? _key + " IS NULL" : [_key, _value].join("=")
      }
    }).join(" AND ")
  }
}
QueryGenerator = Utils._.extend(Utils._.clone(require("../query-generator")), QueryGenerator)
