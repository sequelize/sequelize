var Utils     = require("../../utils")
  , DataTypes = require("../../data-types")
  , util      = require("util")

module.exports = (function() {
  var QueryGenerator = {
    dialect: 'mysql',
    addSchema: function(opts) {
      var tableName
      var schema        = (!!opts && !!opts.options && !!opts.options.schema ? opts.options.schema : undefined)
      var schemaDelimiter  = (!!opts && !!opts.options && !!opts.options.schemaDelimiter ? opts.options.schemaDelimiter : undefined)

      if (!!opts && !!opts.tableName) {
        tableName = opts.tableName
      }
      else if (typeof opts === "string") {
        tableName = opts
      }

      if (!schema || schema.toString().trim() === "") {
        return tableName
      }

      return this.quoteIdentifier(schema + (!schemaDelimiter ? '.' : schemaDelimiter) + tableName, false)
    },

    createSchema: function() {
      var query = "SHOW TABLES"
      return Utils._.template(query)({})
    },

    dropSchema: function(tableName, options) {
      return QueryGenerator.dropTableQuery(tableName, options)
    },

    showSchemasQuery: function() {
      return "SHOW TABLES"
    },

    createTableQuery: function(tableName, attributes, options) {
      options = Utils._.extend({
        engine: 'InnoDB',
        charset: null
      }, options || {})

      var query   = "CREATE TABLE IF NOT EXISTS <%= table %> (<%= attributes%>)<%= comment %> ENGINE=<%= engine %> <%= charset %> <%= collation %>"
        , primaryKeys = []
        , foreignKeys = {}
        , attrStr = []

      for (var attr in attributes) {
        if (attributes.hasOwnProperty(attr)) {
          var dataType = attributes[attr]

          if (Utils._.includes(dataType, 'PRIMARY KEY')) {
            primaryKeys.push(attr)
            attrStr.push(this.quoteIdentifier(attr) + " " + dataType.replace(/PRIMARY KEY/, ''))
          } else if (Utils._.includes(dataType, 'REFERENCES')) {
            // MySQL doesn't support inline REFERENCES declarations: move to the end
            var m = dataType.match(/^(.+) (REFERENCES.*)$/)
            attrStr.push(this.quoteIdentifier(attr) + " " + m[1])
            foreignKeys[attr] = m[2]
          } else {
            attrStr.push(this.quoteIdentifier(attr) + " " + dataType)
          }
        }
      }

      var values = {
        table: this.quoteIdentifier(tableName),
        attributes: attrStr.join(", "),
        comment: options.comment && Utils._.isString(options.comment) ? " COMMENT " + this.escape(options.comment) : "",
        engine: options.engine,
        charset: (options.charset ? "DEFAULT CHARSET=" + options.charset : ""),
        collation: (options.collate ? "COLLATE " + options.collate : "")
      }
      , pkString = primaryKeys.map(function(pk) { return this.quoteIdentifier(pk) }.bind(this)).join(", ")

      if (pkString.length > 0) {
        values.attributes += ", PRIMARY KEY (" + pkString + ")"
      }

      for (var fkey in foreignKeys) {
        if(foreignKeys.hasOwnProperty(fkey)) {
          values.attributes += ", FOREIGN KEY (" + this.quoteIdentifier(fkey) + ") " + foreignKeys[fkey]
        }
      }

      return Utils._.template(query)(values).trim() + ";"
    },

    dropTableQuery: function(tableName, options) {
      options = options || {}

      var query = "DROP TABLE IF EXISTS <%= table %>;"

      return Utils._.template(query)({
        table: this.quoteIdentifier(tableName)
      })
    },

    renameTableQuery: function(before, after) {
      var query = "RENAME TABLE `<%= before %>` TO `<%= after %>`;"
      return Utils._.template(query)({ before: before, after: after })
    },

    showTablesQuery: function() {
      return 'SHOW TABLES;'
    },

    addColumnQuery: function(tableName, attributes) {
      var query      = "ALTER TABLE `<%= tableName %>` ADD <%= attributes %>;"
        , attrString = []

      for (var attrName in attributes) {
        var definition = attributes[attrName]

        attrString.push(Utils._.template('`<%= attrName %>` <%= definition %>')({
          attrName: attrName,
          definition: definition
        }))
      }

      return Utils._.template(query)({ tableName: tableName, attributes: attrString.join(', ') })
    },

    removeColumnQuery: function(tableName, attributeName) {
      var query = "ALTER TABLE `<%= tableName %>` DROP `<%= attributeName %>`;"
      return Utils._.template(query)({ tableName: tableName, attributeName: attributeName })
    },

    changeColumnQuery: function(tableName, attributes) {
      var query      = "ALTER TABLE `<%= tableName %>` CHANGE <%= attributes %>;"
      var attrString = []

      for (var attrName in attributes) {
        var definition = attributes[attrName]

        attrString.push(Utils._.template('`<%= attrName %>` `<%= attrName %>` <%= definition %>')({
          attrName: attrName,
          definition: definition
        }))
      }

      return Utils._.template(query)({ tableName: tableName, attributes: attrString.join(', ') })
    },

    renameColumnQuery: function(tableName, attrBefore, attributes) {
      var query      = "ALTER TABLE `<%= tableName %>` CHANGE <%= attributes %>;"
      var attrString = []

      for (var attrName in attributes) {
        var definition = attributes[attrName]

        attrString.push(Utils._.template('`<%= before %>` `<%= after %>` <%= definition %>')({
          before: attrBefore,
          after: attrName,
          definition: definition
        }))
      }

      return Utils._.template(query)({ tableName: tableName, attributes: attrString.join(', ') })
    },

    insertQuery: function(tableName, attrValueHash) {
      attrValueHash = Utils.removeNullValuesFromHash(attrValueHash, this.options.omitNull)

      var table = this.quoteIdentifier(tableName)
      var attributes = Object.keys(attrValueHash).map(function(attr){return this.quoteIdentifier(attr)}.bind(this)).join(",")
      var values = Utils._.values(attrValueHash).map(function(v) { return this.escape(v) }.bind(this)).join(",")

      var query = "INSERT INTO " + table + " (" + attributes + ") VALUES (" + values + ");"

      return query
    },

    bulkInsertQuery: function(tableName, attrValueHashes) {
      var tuples = []

      Utils._.forEach(attrValueHashes, function(attrValueHash) {
        tuples.push("(" +
          Utils._.values(attrValueHash).map(function(v) { return this.escape(v) }.bind(this)).join(",") +
        ")")
      }.bind(this))

      var table      = this.quoteIdentifier(tableName)
      var attributes = Object.keys(attrValueHashes[0]).map(function(attr){return this.quoteIdentifier(attr)}.bind(this)).join(",")

      var query  = "INSERT INTO " + table + " (" + attributes + ") VALUES " + tuples.join(",") + ";"

      return query
    },

    updateQuery: function(tableName, attrValueHash, where, options) {
      attrValueHash = Utils.removeNullValuesFromHash(attrValueHash, this.options.omitNull, options)

      var values = []

      for (var key in attrValueHash) {
        var value  = attrValueHash[key]
          , _value = this.escape(value)

        values.push(this.quoteIdentifier(key) + "=" + _value)
      }

      var query = "UPDATE " + this.quoteIdentifier(tableName) +
                  " SET " + values.join(",") +
                  " WHERE " + this.getWhereConditions(where)

      return query
    },

    deleteQuery: function(tableName, where, options) {
      options = options || {}

      var table = this.quoteIdentifier(tableName)
      if (options.truncate === true) {
        // Truncate does not allow LIMIT and WHERE
        return "TRUNCATE " + table
      }

      where = this.getWhereConditions(where)
      var limit = ""

      if(Utils._.isUndefined(options.limit)) {
        options.limit = 1;
      }

      if(!!options.limit) {
        limit = " LIMIT " + this.escape(options.limit)
      }

      return "DELETE FROM " + table + " WHERE " + where + limit
    },

    bulkDeleteQuery: function(tableName, where, options) {
      options = options || {}

      var table = this.quoteIdentifier(tableName)
      where = this.getWhereConditions(where)

      var query = "DELETE FROM " + table + " WHERE " + where

      return query
    },

    incrementQuery: function (tableName, attrValueHash, where, options) {
      attrValueHash = Utils.removeNullValuesFromHash(attrValueHash, this.options.omitNull)

      var values = []

      for (var key in attrValueHash) {
        var value  = attrValueHash[key]
          , _value = this.escape(value)

        values.push(this.quoteIdentifier(key) + "=" + this.quoteIdentifier(key) + " + " + _value)
      }

      options = options || {}
      for (var key in options) {
        var value = options[key];
        values.push(this.quoteIdentifier(key) + "=" + this.escape(value))
      }

      var table = this.quoteIdentifier(tableName)
      values = values.join(",")
      where = this.getWhereConditions(where)

      var query = "UPDATE " + table + " SET " + values + " WHERE " + where

      return query
    },

    addIndexQuery: function(tableName, attributes, options) {
      var transformedAttributes = attributes.map(function(attribute) {
        if(typeof attribute === 'string') {
          return attribute
        } else {
          var result = ""

          if (!attribute.attribute) {
            throw new Error('The following index attribute has no attribute: ' + util.inspect(attribute))
          }

          result += attribute.attribute

          if (attribute.length) {
            result += '(' + attribute.length + ')'
          }

          if (attribute.order) {
            result += ' ' + attribute.order
          }

          return result
        }
      }.bind(this))

      var onlyAttributeNames = attributes.map(function(attribute) {
        return (typeof attribute === 'string') ? attribute : attribute.attribute
      }.bind(this))

      options = Utils._.extend({
        indicesType: null,
        indexName: Utils._.underscored(tableName + '_' + onlyAttributeNames.join('_')),
        parser: null
      }, options || {})

      return Utils._.compact([
        "CREATE", options.indicesType, "INDEX", options.indexName,
        (options.indexType ? ('USING ' + options.indexType) : undefined),
        "ON", tableName, '(' + transformedAttributes.join(', ') + ')',
        (options.parser ? "WITH PARSER " + options.parser : undefined)
      ]).join(' ')
    },

    showIndexQuery: function(tableName, options) {
      var sql = "SHOW INDEX FROM `<%= tableName %>`<%= options %>"
      return Utils._.template(sql)({
        tableName: tableName,
        options: (options || {}).database ? ' FROM `' + options.database + '`' : ''
      })
    },

    removeIndexQuery: function(tableName, indexNameOrAttributes) {
      var sql       = "DROP INDEX <%= indexName %> ON <%= tableName %>"
        , indexName = indexNameOrAttributes

      if (typeof indexName !== 'string') {
        indexName = Utils._.underscored(tableName + '_' + indexNameOrAttributes.join('_'))
      }

      return Utils._.template(sql)({ tableName: tableName, indexName: indexName })
    },

    /**
     * Returns a query that starts a transaction.
     *
     * @param  {Boolean} value A boolean that states whether autocommit shall be done or not.
     * @return {String}        The generated sql query.
     */
    setAutocommitQuery: function(value) {
      return "SET autocommit = " + (!!value ? 1 : 0) + ";"
    },

    setIsolationLevelQuery: function(value) {
      return "SET SESSION TRANSACTION ISOLATION LEVEL " + value + ";"
    },

    /**
     * Returns a query that starts a transaction.
     *
     * @param  {Object} options An object with options.
     * @return {String}         The generated sql query.
     */
    startTransactionQuery: function(options) {
      return "START TRANSACTION;"
    },

    commitTransactionQuery: function(options) {
      return "COMMIT;"
    },

    rollbackTransactionQuery: function(options) {
      return "ROLLBACK;"
    },

    attributesToSQL: function(attributes) {
      var result = {}

      for (var name in attributes) {
        var dataType = attributes[name]

        if (Utils.isHash(dataType)) {
          var template

          if (dataType.type.toString() === DataTypes.ENUM.toString()) {
            if (Array.isArray(dataType.values) && (dataType.values.length > 0)) {
              template = "ENUM(" + Utils._.map(dataType.values, function(value) {
                return this.escape(value)
              }.bind(this)).join(", ") + ")"
            } else {
              throw new Error('Values for ENUM haven\'t been defined.')
            }
          } else {
            template = dataType.type.toString();
          }

          if (dataType.hasOwnProperty('allowNull') && (!dataType.allowNull)) {
            template += " NOT NULL"
          }

          if (dataType.autoIncrement) {
            template += " auto_increment"
          }

          // Blobs/texts cannot have a defaultValue
          if (dataType.type !== "TEXT" && dataType.type._binary !== true && Utils.defaultValueSchemable(dataType.defaultValue)) {
            template += " DEFAULT " + this.escape(dataType.defaultValue)
          }

          if (dataType.unique) {
            template += " UNIQUE"
          }

          if (dataType.primaryKey) {
            template += " PRIMARY KEY"
          }

          if(dataType.references) {
            template += " REFERENCES " + this.quoteIdentifier(dataType.references)

            if(dataType.referencesKey) {
              template += " (" + this.quoteIdentifier(dataType.referencesKey) + ")"
            } else {
              template += " (" + this.quoteIdentifier('id') + ")"
            }

            if(dataType.onDelete) {
              template += " ON DELETE " + dataType.onDelete.toUpperCase()
            }

            if(dataType.onUpdate) {
              template += " ON UPDATE " + dataType.onUpdate.toUpperCase()
            }

          }

          if (dataType.comment && Utils._.isString(dataType.comment) && dataType.comment.length) {
            template += " COMMENT " + this.escape(dataType.comment)
          }

          result[name] = template
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

          if (definition && (definition.indexOf('auto_increment') > -1)) {
            fields.push(name)
          }
        }
      }

      return fields
    },

    addLimitAndOffset: function(options, query){
      if (options.offset && !options.limit) {
        query += " LIMIT " + options.offset + ", " + 18440000000000000000;
      } else if (options.limit && !(options.include && (options.limit === 1))) {
        if (options.offset) {
          query += " LIMIT " + options.offset + ", " + options.limit
        } else {
          query += " LIMIT " + options.limit
        }
      }
      return query;
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
      return "SELECT CONSTRAINT_NAME as constraint_name FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE where TABLE_NAME = '" + tableName + "' AND CONSTRAINT_NAME!='PRIMARY' AND CONSTRAINT_SCHEMA='" + schemaName + "' AND REFERENCED_TABLE_NAME IS NOT NULL;"
    },

    /**
     * Generates an SQL query that removes a foreign key from a table.
     *
     * @param  {String} tableName  The name of the table.
     * @param  {String} foreignKey The name of the foreign key constraint.
     * @return {String}            The generated sql query.
     */
    dropForeignKeyQuery: function(tableName, foreignKey) {
      return 'ALTER TABLE ' + this.quoteIdentifier(tableName) + ' DROP FOREIGN KEY ' + this.quoteIdentifier(foreignKey) + ';'
    }
  }

  return Utils._.extend(Utils._.clone(require("../abstract/query-generator")), QueryGenerator)
})()
