'use strict';

var Utils = require('./utils')
  , _ = require('lodash')
  , DataTypes = require('./data-types')
  , SQLiteQueryInterface = require('./dialects/sqlite/query-interface')
  , MSSSQLQueryInterface = require('./dialects/mssql/query-interface')
  , MySQLQueryInterface = require('./dialects/mysql/query-interface')
  , Transaction = require('./transaction')
  , Promise = require('./promise')
  , QueryTypes = require('./query-types');

/*
 * The interface that Sequelize uses to talk to all databases
 * @class QueryInterface
**/
var QueryInterface = function(sequelize) {
  this.sequelize = sequelize;
  this.QueryGenerator = this.sequelize.dialect.QueryGenerator;
};

QueryInterface.prototype.createSchema = function(schema, options) {
  options = options || {};
  var sql = this.QueryGenerator.createSchema(schema);
  return this.sequelize.query(sql, options);
};

QueryInterface.prototype.dropSchema = function(schema, options) {
  options = options || {};
  var sql = this.QueryGenerator.dropSchema(schema);
  return this.sequelize.query(sql, options);
};

QueryInterface.prototype.dropAllSchemas = function(options) {
  options = options || {};

  var self = this;
  if (!this.QueryGenerator._dialect.supports.schemas) {
    return this.sequelize.drop(options);
  } else {
    return this.showAllSchemas(options).map(function(schemaName) {
      return self.dropSchema(schemaName, options);
    });
  }
};

QueryInterface.prototype.showAllSchemas = function(options) {
  var self = this;

  options = _.assign({}, options, {
    raw: true,
    type: this.sequelize.QueryTypes.SELECT,
    logging: false
  });

  var showSchemasSql = self.QueryGenerator.showSchemasQuery();

  return this.sequelize.query(showSchemasSql, options).then(function(schemaNames) {
    return Utils._.flatten(
      Utils._.map(schemaNames, function(value) {
        return (!!value.schema_name ? value.schema_name : value);
      })
    );
  });
};

QueryInterface.prototype.databaseVersion = function(options) {
  return this.sequelize.query(
    this.QueryGenerator.versionQuery(),
    _.assign({}, options, { type: QueryTypes.VERSION })
  );
};

QueryInterface.prototype.createTable = function(tableName, attributes, options, model) {
  var keys = Object.keys(attributes)
    , keyLen = keys.length
    , self = this
    , sql = ''
    , i = 0;

  options = options || {};

  attributes = Utils._.mapValues(attributes, function(attribute) {
    if (!Utils._.isPlainObject(attribute)) {
      attribute = { type: attribute, allowNull: true };
    }

    attribute = self.sequelize.normalizeAttribute(attribute);

    return attribute;
  });

  // Postgres requires a special SQL command for enums
  if (self.sequelize.options.dialect === 'postgres') {
    var promises = [];

    for (i = 0; i < keyLen; i++) {
      if (attributes[keys[i]].type instanceof DataTypes.ENUM) {
        sql = self.QueryGenerator.pgListEnums(tableName, attributes[keys[i]].field || keys[i], options);
        promises.push(self.sequelize.query(
          sql,
          _.assign({}, options, { plain: true, raw: true, type: QueryTypes.SELECT })
        ));
      }
    }

    return Promise.all(promises).then(function(results) {
      var promises = []
        , enumIdx = 0;

      for (i = 0; i < keyLen; i++) {
        if (attributes[keys[i]].type instanceof DataTypes.ENUM) {
          // If the enum type doesn't exist then create it
          if (!results[enumIdx]) {
            sql = self.QueryGenerator.pgEnum(tableName, attributes[keys[i]].field || keys[i], attributes[keys[i]], options);
            promises.push(self.sequelize.query(
              sql,
              _.assign({}, options, { raw: true })
            ));
          } else if (!!results[enumIdx] && !!model) {
            var enumVals = self.QueryGenerator.fromArray(results[enumIdx].enum_value)
              , vals = model.rawAttributes[keys[i]].values;

            vals.forEach(function(value, idx) {
              // reset out after/before options since it's for every enum value
              options.before = null;
              options.after = null;

              if (enumVals.indexOf(value) === -1) {
                if (!!vals[idx + 1]) {
                  options.before = vals[idx + 1];
                }
                else if (!!vals[idx - 1]) {
                  options.after = vals[idx - 1];
                }
                options.supportsSearchPath = false;
                promises.push(self.sequelize.query(self.QueryGenerator.pgEnumAdd(tableName, keys[i], value, options), options));
              }
            });
            enumIdx++;
          }
        }
      }

      if (!tableName.schema &&
        (options.schema || (!!model && model.$schema))) {
        tableName = self.QueryGenerator.addSchema({
          tableName: tableName,
          $schema: (!!model && model.$schema) || options.schema
        });
      }

      attributes = self.QueryGenerator.attributesToSQL(attributes, {
        context: 'createTable'
      });
      sql = self.QueryGenerator.createTableQuery(tableName, attributes, options);

      return Promise.all(promises).then(function() {
        return self.sequelize.query(sql, options);
      });
    });
  } else {
    if (!tableName.schema &&
      (options.schema || (!!model && model.$schema))) {
      tableName = self.QueryGenerator.addSchema({
        tableName: tableName,
        $schema: (!!model && model.$schema) || options.schema
      });
    }

    attributes = self.QueryGenerator.attributesToSQL(attributes, {
      context: 'createTable'
    });
    sql = self.QueryGenerator.createTableQuery(tableName, attributes, options);

    return self.sequelize.query(sql, options);
  }
};

QueryInterface.prototype.dropTable = function(tableName, options) {
  // if we're forcing we should be cascading unless explicitly stated otherwise
  options = options || {};
  options.cascade = options.cascade || options.force || false;

  var sql = this.QueryGenerator.dropTableQuery(tableName, options)
    , self = this;

  return this.sequelize.query(sql, options).then(function() {
    var promises = [];

    // Since postgres has a special case for enums, we should drop the related
    // enum type within the table and attribute
    if (self.sequelize.options.dialect === 'postgres') {
      var instanceTable = self.sequelize.modelManager.getModel(tableName, { attribute: 'tableName' });

      if (!!instanceTable) {
        var getTableName = (!options || !options.schema || options.schema === 'public' ? '' : options.schema + '_') + tableName;

        var keys = Object.keys(instanceTable.rawAttributes)
          , keyLen = keys.length
          , i = 0;

        for (i = 0; i < keyLen; i++) {
          if (instanceTable.rawAttributes[keys[i]].type instanceof DataTypes.ENUM) {
            sql = self.QueryGenerator.pgEnumDrop(getTableName, keys[i]);
            options.supportsSearchPath = false;
            promises.push(self.sequelize.query(sql, _.assign({}, options, { raw: true })));
          }
        }
      }
    }

    return Promise.all(promises).get(0);
  });
};

QueryInterface.prototype.dropAllTables = function(options) {
  var self = this
    , skip;

  options = options || {};
  skip = options.skip || [];

  var dropAllTables = function(tableNames) {
    return Promise.each(tableNames, function(tableName) {
      // if tableName is not in the Array of tables names then dont drop it
      if (skip.indexOf(tableName.tableName || tableName) === -1) {
        return self.dropTable(tableName, _.assign({}, options, { cascade: true }) );
      }
    });
  };

  return self.showAllTables(options).then(function(tableNames) {
    if (self.sequelize.options.dialect === 'sqlite') {
      return self.sequelize.query('PRAGMA foreign_keys;', options).then(function(result) {
        var foreignKeysAreEnabled = result.foreign_keys === 1;

        if (foreignKeysAreEnabled) {
          return self.sequelize.query('PRAGMA foreign_keys = OFF', options).then(function() {
            return dropAllTables(tableNames).then(function() {
              return self.sequelize.query('PRAGMA foreign_keys = ON', options);
            });
          });
        } else {
          return dropAllTables(tableNames);
        }
      });
    } else {
      return self.getForeignKeysForTables(tableNames, options).then(function(foreignKeys) {
        var promises = [];

        tableNames.forEach(function(tableName) {
          var normalizedTableName = tableName;
          if (Utils._.isObject(tableName)) {
             normalizedTableName = tableName.schema + '.' + tableName.tableName;
          }

          foreignKeys[normalizedTableName].forEach(function(foreignKey) {
            var sql = self.QueryGenerator.dropForeignKeyQuery(tableName, foreignKey);
            promises.push(self.sequelize.query(sql, options));
          });
        });

        return Promise.all(promises).then(function() {
          return dropAllTables(tableNames);
        });
      });
    }
  });
};

QueryInterface.prototype.dropAllEnums = function(options) {
  if (this.sequelize.getDialect() !== 'postgres') {
    return Promise.resolve();
  }

  options = options || {};

  var self = this;

  return this.pgListEnums(options).map(function(result) {
    return self.sequelize.query(
      self.QueryGenerator.pgEnumDrop(null, null, self.QueryGenerator.pgEscapeAndQuote(result.enum_name)),
      _.assign({}, options, { raw: true })
    );
  });
};

QueryInterface.prototype.pgListEnums = function (tableName, options) {
  options = options || {};
  var sql = this.QueryGenerator.pgListEnums(tableName);
  return this.sequelize.query(sql, _.assign({}, options, { plain: false, raw: true, type: QueryTypes.SELECT }));
};

QueryInterface.prototype.renameTable = function(before, after, options) {
  options = options || {};
  var sql = this.QueryGenerator.renameTableQuery(before, after);
  return this.sequelize.query(sql, options);
};

QueryInterface.prototype.showAllTables = function(options) {
  var self = this;
  options = _.assign({}, options, {
    raw: true,
    type: QueryTypes.SHOWTABLES
  });

  var showTablesSql = self.QueryGenerator.showTablesQuery();
  return self.sequelize.query(showTablesSql, options).then(function(tableNames) {
    return Utils._.flatten(tableNames);
  });
};

QueryInterface.prototype.describeTable = function(tableName, options) {
  var schema = null
    , schemaDelimiter = null;

  if (typeof options === 'string') {
    schema = options;
  } else if (typeof options === 'object' && options !== null) {
    schema = options.schema || null;
    schemaDelimiter = options.schemaDelimiter || null;
  }

  if (typeof tableName === 'object' && tableName !== null) {
    schema = tableName.schema;
    tableName = tableName.tableName;
  }

  var sql = this.QueryGenerator.describeTableQuery(tableName, schema, schemaDelimiter);

  return this.sequelize.query(
    sql,
    _.assign({}, options, { type: QueryTypes.DESCRIBE })
  ).then(function(data) {
    // If no data is returned from the query, then the table name may be wrong.
    // Query generators that use information_schema for retrieving table info will just return an empty result set,
    // it will not throw an error like built-ins do (e.g. DESCRIBE on MySql).
    if (Utils._.isEmpty(data)) {
      return Promise.reject('No description found for "' + tableName + '" table. Check the table name and schema; remember, they _are_ case sensitive.');
    } else {
      return Promise.resolve(data);
    }
  });
};

QueryInterface.prototype.addColumn = function(table, key, attribute, options) {
  if (!table || !key || !attribute) {
    throw new Error('addColumn takes atleast 3 arguments (table, attribute name, attribute definition)');
  }

  options = options || {};
  attribute = this.sequelize.normalizeAttribute(attribute);
  return this.sequelize.query(this.QueryGenerator.addColumnQuery(table, key, attribute), options);
};

QueryInterface.prototype.removeColumn = function(tableName, attributeName, options) {
  options = options || {};
  switch (this.sequelize.options.dialect) {
    case 'sqlite':
      // sqlite needs some special treatment as it cannot drop a column
      return SQLiteQueryInterface.removeColumn.call(this, tableName, attributeName, options);
    case 'mssql':
      // mssql needs special treatment as it cannot drop a column with a default or foreign key constraint
      return MSSSQLQueryInterface.removeColumn.call(this, tableName, attributeName, options);
    case 'mysql':
    case 'mariadb':
      // mysql/maria needs special treatment as it cannot drop a column with a foreign key constraint
      return MySQLQueryInterface.removeColumn.call(this, tableName, attributeName, options);
    default:
        var sql = this.QueryGenerator.removeColumnQuery(tableName, attributeName);
        return this.sequelize.query(sql, options);
  }
};

QueryInterface.prototype.changeColumn = function(tableName, attributeName, dataTypeOrOptions, options) {
  var attributes = {};
  options = options || {};

  if (Utils._.values(DataTypes).indexOf(dataTypeOrOptions) > -1) {
    attributes[attributeName] = { type: dataTypeOrOptions, allowNull: true };
  } else {
    attributes[attributeName] = dataTypeOrOptions;
  }

  attributes[attributeName].type = this.sequelize.normalizeDataType(attributes[attributeName].type);

  if (this.sequelize.options.dialect === 'sqlite') {
    // sqlite needs some special treatment as it cannot change a column
    return SQLiteQueryInterface.changeColumn.call(this, tableName, attributes, options);
  } else {
    var query = this.QueryGenerator.attributesToSQL(attributes)
      , sql = this.QueryGenerator.changeColumnQuery(tableName, query);

    return this.sequelize.query(sql, options);
  }
};

QueryInterface.prototype.renameColumn = function(tableName, attrNameBefore, attrNameAfter, options) {
  options = options || {};
  return this.describeTable(tableName, options).then(function(data) {
    data = data[attrNameBefore] || {};

    var _options = {};

    _options[attrNameAfter] = {
      attribute: attrNameAfter,
      type: data.type,
      allowNull: data.allowNull,
      defaultValue: data.defaultValue
    };

    // fix: a not-null column cannot have null as default value
    if (data.defaultValue === null && !data.allowNull) {
      delete _options[attrNameAfter].defaultValue;
    }

    if (this.sequelize.options.dialect === 'sqlite') {
      // sqlite needs some special treatment as it cannot rename a column
      return SQLiteQueryInterface.renameColumn.call(this, tableName, attrNameBefore, attrNameAfter, options);
    } else {
      var sql = this.QueryGenerator.renameColumnQuery(
        tableName,
        attrNameBefore,
        this.QueryGenerator.attributesToSQL(_options)
      );
      return this.sequelize.query(sql, options);
    }
  }.bind(this));
};

QueryInterface.prototype.addIndex = function(tableName, attributes, options, rawTablename) {
  // Support for passing tableName, attributes, options or tableName, options (with a fields param which is the attributes)
  if (!Array.isArray(attributes)) {
    rawTablename = options;
    options = attributes;
    attributes = options.fields;
  }
  // testhint argsConform.end

  if (!rawTablename) {
    // Map for backwards compat
    rawTablename = tableName;
  }

  options = options || {};
  options.fields = attributes;
  var sql = this.QueryGenerator.addIndexQuery(tableName, options, rawTablename);
  return this.sequelize.query(sql, _.assign({}, options, { supportsSearchPath: false }));
};

QueryInterface.prototype.showIndex = function(tableName, options) {
  var sql = this.QueryGenerator.showIndexesQuery(tableName, options);
  return this.sequelize.query(sql, _.assign({}, options, { type: QueryTypes.SHOWINDEXES }));
};

QueryInterface.prototype.nameIndexes = function(indexes, rawTablename) {
  return this.QueryGenerator.nameIndexes(indexes, rawTablename);
};

QueryInterface.prototype.getForeignKeysForTables = function(tableNames, options) {
  var self = this;
  options = options || {};

  if (tableNames.length === 0) {
    return Promise.resolve({});
  }

  return Promise.map(tableNames, function(tableName) {
    return self.sequelize.query(self.QueryGenerator.getForeignKeysQuery(tableName, self.sequelize.config.database), options).get(0);
  }).then(function(results) {
    var result = {};

    tableNames.forEach(function(tableName, i) {
      if (Utils._.isObject(tableName)) {
        tableName = tableName.schema + '.' + tableName.tableName;
      }

      result[tableName] = Utils._.compact(results[i]).map(function(r) {
        return r.constraint_name;
      });
    });

    return result;
  });
};

QueryInterface.prototype.removeIndex = function(tableName, indexNameOrAttributes, options) {
  options = options || {};
  var sql = this.QueryGenerator.removeIndexQuery(tableName, indexNameOrAttributes);
  return this.sequelize.query(sql, options);
};

QueryInterface.prototype.insert = function(instance, tableName, values, options) {
  options = options || {};
  options.hasTrigger = instance && instance.Model.options.hasTrigger;
  var sql = this.QueryGenerator.insertQuery(tableName, values, instance && instance.Model.rawAttributes, options);

  options.type = QueryTypes.INSERT;
  options.instance = instance;

  return this.sequelize.query(sql, options).then(function(result) {
    if (instance) result.isNewRecord = false;
    return result;
  });
};

QueryInterface.prototype.upsert = function(tableName, valuesByField, updateValues, where, model, options) {
  var wheres = []
    , indexFields
    , indexes = []
    , attributes = Object.keys(valuesByField);

  if (!Utils._.isEmpty(where)) {
    wheres.push(where);
  }

  // Lets combine uniquekeys and indexes into one
  indexes = Utils._.map(model.options.uniqueKeys, function (value) {
    return value.fields;
  });

  Utils._.each(model.options.indexes, function (value) {
    if (value.unique === true) {
      // fields in the index may both the strings or objects with an attribute property - lets sanitize that
      indexFields = Utils._.map(value.fields, function (field) {
        if (Utils._.isPlainObject(field)) {
          return field.attribute;
        }
        return field;
      });
      indexes.push(indexFields);
    }
  });

  indexes.forEach(function (index) {
    if (Utils._.intersection(attributes, index).length === index.length) {
      where = {};
      index.forEach(function (field) {
        where[field] = valuesByField[field];
      });
      wheres.push(where);
    }
  });

  where = { $or: wheres };

  options.type = QueryTypes.UPSERT;
  options.raw = true;

  var sql = this.QueryGenerator.upsertQuery(tableName, valuesByField, updateValues, where, model.rawAttributes, options);
  return this.sequelize.query(sql, options).then(function (rowCount) {
    if (rowCount === undefined) {
      return rowCount;
    }

    // MySQL returns 1 for inserted, 2 for updated http://dev.mysql.com/doc/refman/5.0/en/insert-on-duplicate.html. Postgres has been modded to do the same

    return rowCount === 1;
  });
};

QueryInterface.prototype.bulkInsert = function(tableName, records, options, attributes) {
  options = options || {};
  options.type = QueryTypes.INSERT;
  var sql = this.QueryGenerator.bulkInsertQuery(tableName, records, options, attributes);
  return this.sequelize.query(sql, options);
};

QueryInterface.prototype.update = function(instance, tableName, values, identifier, options) {
  options = options || {};
  options.hasTrigger = !!(instance && instance.$modelOptions && instance.$modelOptions.hasTrigger);


  var self = this
    , restrict = false
    , sql = self.QueryGenerator.updateQuery(tableName, values, identifier, options, instance.Model.rawAttributes);


  options.type = QueryTypes.UPDATE;

  // Check for a restrict field
  if (!!instance.Model && !!instance.Model.associations) {
    var keys = Object.keys(instance.Model.associations)
      , length = keys.length;

    for (var i = 0; i < length; i++) {
      if (instance.Model.associations[keys[i]].options && instance.Model.associations[keys[i]].options.onUpdate && instance.Model.associations[keys[i]].options.onUpdate === 'restrict') {
        restrict = true;
      }
    }
  }

  options.instance = instance;
  return this.sequelize.query(sql, options);
};

QueryInterface.prototype.bulkUpdate = function(tableName, values, identifier, options, attributes) {
  var sql = this.QueryGenerator.updateQuery(tableName, values, identifier, options, attributes)
    , table = Utils._.isObject(tableName) ? tableName : { tableName: tableName }
    , model = Utils._.find(this.sequelize.modelManager.models, { tableName: table.tableName });

  options = options || {};
  options.model = model;
  return this.sequelize.query(sql, options);
};

QueryInterface.prototype.delete = function(instance, tableName, identifier, options) {
  var self = this
    , cascades = []
    , sql = self.QueryGenerator.deleteQuery(tableName, identifier, null, instance.Model);

  options = options || {};

  // Check for a restrict field
  if (!!instance.Model && !!instance.Model.associations) {
    var keys = Object.keys(instance.Model.associations)
      , length = keys.length
      , association;

    for (var i = 0; i < length; i++) {
      association = instance.Model.associations[keys[i]];
      if (association.options && association.options.onDelete &&
        association.options.onDelete.toLowerCase() === 'cascade' &&
        association.options.useHooks === true) {
        cascades.push(association.accessors.get);
      }
    }
  }

  return Promise.each(cascades, function (cascade) {
    return instance[cascade](options).then(function (instances) {
      // Check for hasOne relationship with non-existing associate ("has zero")
      if (!instances) {
        return Promise.resolve();
      }

      if (!Array.isArray(instances)) instances = [instances];

      return Promise.each(instances, function (instance) {
        return instance.destroy(options);
      });
    });
  }).then(function () {
    options.instance = instance;
    return self.sequelize.query(sql, options);
  });
};

QueryInterface.prototype.bulkDelete = function(tableName, identifier, options, model) {
  var sql = this.QueryGenerator.deleteQuery(tableName, identifier, Utils._.defaults(options || {}, {limit: null}), model);
  return this.sequelize.query(sql, options);
};

QueryInterface.prototype.select = function(model, tableName, options) {
  options = options || {};
  options.type = QueryTypes.SELECT;
  options.model = model;

  return this.sequelize.query(
    this.QueryGenerator.selectQuery(tableName, options, model),
    options
  );
};

QueryInterface.prototype.increment = function(instance, tableName, values, identifier, options) {
  var sql = this.QueryGenerator.incrementQuery(tableName, values, identifier, options.attributes);

  options = options || {};

  options.type = QueryTypes.UPDATE;
  options.instance = instance;
  return this.sequelize.query(sql, options);
};

QueryInterface.prototype.rawSelect = function(tableName, options, attributeSelector, Model) {
  if (options.schema) {
    tableName = this.QueryGenerator.addSchema({
      tableName: tableName,
      $schema: options.schema
    });
  }

  options = _.defaults(options || {}, {
    raw: true,
    plain: true,
    type: QueryTypes.SELECT
  });

  var sql = this.QueryGenerator.selectQuery(tableName, options, Model);

  if (attributeSelector === undefined) {
    throw new Error('Please pass an attribute selector!');
  }

  return this.sequelize.query(sql, options).then(function(data) {
    if (!options.plain) {
      return data;
    }

    var result = data ? data[attributeSelector] : null;

    if (options && options.dataType) {
      var dataType = options.dataType;

      if (dataType instanceof DataTypes.DECIMAL || dataType instanceof DataTypes.FLOAT) {
        result = parseFloat(result);
      } else if (dataType instanceof DataTypes.INTEGER || dataType instanceof DataTypes.BIGINT) {
        result = parseInt(result, 10);
      } else if (dataType instanceof DataTypes.DATE) {
        if (!Utils._.isNull(result) && !Utils._.isDate(result)) {
          result = new Date(result);
        }
      } else if (dataType instanceof DataTypes.STRING) {
        // Nothing to do, result is already a string.
      }
    }

    return result;
  });
};

QueryInterface.prototype.createTrigger = function(tableName, triggerName, timingType, fireOnArray, functionName, functionParams, optionsArray, options) {
  var sql = this.QueryGenerator.createTrigger(tableName, triggerName, timingType, fireOnArray, functionName, functionParams, optionsArray);
  options = options || {};
  if (sql) {
    return this.sequelize.query(sql, options);
  } else {
    return Promise.resolve();
  }
};

QueryInterface.prototype.dropTrigger = function(tableName, triggerName, options) {
  var sql = this.QueryGenerator.dropTrigger(tableName, triggerName);
  options = options || {};

  if (sql) {
    return this.sequelize.query(sql, options);
  } else {
    return Promise.resolve();
  }
};

QueryInterface.prototype.renameTrigger = function(tableName, oldTriggerName, newTriggerName, options) {
  var sql = this.QueryGenerator.renameTrigger(tableName, oldTriggerName, newTriggerName);
  options = options || {};

  if (sql) {
    return this.sequelize.query(sql, options);
  } else {
    return Promise.resolve();
  }
};

QueryInterface.prototype.createFunction = function(functionName, params, returnType, language, body, options) {
  var sql = this.QueryGenerator.createFunction(functionName, params, returnType, language, body, options);
  options = options || {};

  if (sql) {
    return this.sequelize.query(sql, options);
  } else {
    return Promise.resolve();
  }
};

QueryInterface.prototype.dropFunction = function(functionName, params, options) {
  var sql = this.QueryGenerator.dropFunction(functionName, params);
  options = options || {};

  if (sql) {
    return this.sequelize.query(sql, options);
  } else {
    return Promise.resolve();
  }
};

QueryInterface.prototype.renameFunction = function(oldFunctionName, params, newFunctionName, options) {
  var sql = this.QueryGenerator.renameFunction(oldFunctionName, params, newFunctionName);
  options = options || {};

  if (sql) {
    return this.sequelize.query(sql, options);
  } else {
    return Promise.resolve();
  }
};

// Helper methods useful for querying

/**
 * Escape an identifier (e.g. a table or attribute name). If force is true,
 * the identifier will be quoted even if the `quoteIdentifiers` option is
 * false.
 */
QueryInterface.prototype.quoteIdentifier = function(identifier, force) {
  return this.QueryGenerator.quoteIdentifier(identifier, force);
};

QueryInterface.prototype.quoteTable = function(identifier) {
  return this.QueryGenerator.quoteTable(identifier);
};

/**
 * Split an identifier into .-separated tokens and quote each part.
 * If force is true, the identifier will be quoted even if the
 * `quoteIdentifiers` option is false.
 */
QueryInterface.prototype.quoteIdentifiers = function(identifiers, force) {
  return this.QueryGenerator.quoteIdentifiers(identifiers, force);
};

/**
 * Escape a value (e.g. a string, number or date)
 */
QueryInterface.prototype.escape = function(value) {
  return this.QueryGenerator.escape(value);
};

QueryInterface.prototype.setAutocommit = function(transaction, value, options) {
  if (!transaction || !(transaction instanceof Transaction)) {
    throw new Error('Unable to set autocommit for a transaction without transaction object!');
  }
  if (transaction.parent) {
    // Not possible to set a seperate isolation level for savepoints
    return Promise.resolve();
  }

  options = _.assign({}, options, {
    transaction: transaction.parent || transaction
  });

  var sql = this.QueryGenerator.setAutocommitQuery(value, {
    parent: transaction.parent
  });

  if (!sql) return Promise.resolve();

  return this.sequelize.query(sql, options);
};

QueryInterface.prototype.setIsolationLevel = function(transaction, value, options) {
  if (!transaction || !(transaction instanceof Transaction)) {
    throw new Error('Unable to set isolation level for a transaction without transaction object!');
  }
  if (transaction.parent) {
    // Not possible to set a seperate isolation level for savepoints
    return Promise.resolve();
  }

  options = _.assign({}, options, {
    transaction: transaction.parent || transaction
  });

  var sql = this.QueryGenerator.setIsolationLevelQuery(value, {
    parent: transaction.parent
  });

  if (!sql) return Promise.resolve();

  return this.sequelize.query(sql, options);
};

QueryInterface.prototype.startTransaction = function(transaction, options) {
  if (!transaction || !(transaction instanceof Transaction)) {
    throw new Error('Unable to start a transaction without transaction object!');
  }

  options = _.assign({}, options, {
    transaction: transaction.parent || transaction
  });

  var sql = this.QueryGenerator.startTransactionQuery(transaction);

  return this.sequelize.query(sql, options);
};

QueryInterface.prototype.deferConstraints = function (transaction, options) {
  options = _.assign({}, options, {
    transaction: transaction.parent || transaction
  });

  var sql = this.QueryGenerator.deferConstraintsQuery(options);

  if (sql) {
    return this.sequelize.query(sql, options);
  }

  return Promise.resolve();
};

QueryInterface.prototype.commitTransaction = function(transaction, options) {
  if (!transaction || !(transaction instanceof Transaction)) {
    throw new Error('Unable to commit a transaction without transaction object!');
  }
  if (transaction.parent) {
    // Savepoints cannot be committed
    return Promise.resolve();
  }

  options = _.assign({}, options, {
    transaction: transaction.parent || transaction,
    supportsSearchPath: false
  });

  var sql = this.QueryGenerator.commitTransactionQuery(transaction);
  var promise = this.sequelize.query(sql, options);

  transaction.finished = 'commit';

  return promise;
};

QueryInterface.prototype.rollbackTransaction = function(transaction, options) {
  if (!transaction || !(transaction instanceof Transaction)) {
    throw new Error('Unable to rollback a transaction without transaction object!');
  }

  options = _.assign({}, options, {
    transaction: transaction.parent || transaction,
    supportsSearchPath: false
  });

  var sql = this.QueryGenerator.rollbackTransactionQuery(transaction);
  var promise = this.sequelize.query(sql, options);

  transaction.finished = 'rollback';

  return promise;
};

module.exports = QueryInterface;
