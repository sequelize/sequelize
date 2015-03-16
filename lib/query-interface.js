'use strict';

var Utils = require(__dirname + '/utils')
  , DataTypes = require(__dirname + '/data-types')
  , SQLiteQueryInterface = require(__dirname + '/dialects/sqlite/query-interface')
  , Transaction = require(__dirname + '/transaction')
  , Promise = require(__dirname + '/promise')
  , QueryTypes = require('./query-types');

module.exports = (function() {
  /*
   * The interface that Sequelize uses to talk to all databases
   * @class QueryInterface
  **/
  var QueryInterface = function(sequelize) {
    this.sequelize = sequelize;
    this.QueryGenerator = this.sequelize.dialect.QueryGenerator;
  };

  QueryInterface.prototype.createSchema = function(schema) {
    var sql = this.QueryGenerator.createSchema(schema);
    return this.sequelize.query(sql, null, {logging: this.sequelize.options.logging});
  };

  QueryInterface.prototype.dropSchema = function(schema) {
    var sql = this.QueryGenerator.dropSchema(schema);
    return this.sequelize.query(sql, null, {logging: this.sequelize.options.logging});
  };

  QueryInterface.prototype.dropAllSchemas = function() {
    var self = this;

    if (!this.QueryGenerator._dialect.supports.schemas) {
      return this.sequelize.drop();
    } else {
      return this.showAllSchemas().map(function(schemaName, index, length) {
        return self.dropSchema(schemaName);
      });
    }
  };

  QueryInterface.prototype.showAllSchemas = function(options) {
    var self = this;

    options = Utils._.extend({
      raw: true,
      type: this.sequelize.QueryTypes.SELECT
    }, options || {});

    var showSchemasSql = self.QueryGenerator.showSchemasQuery();

    return this.sequelize.query(showSchemasSql, options).then(function(schemaNames) {
      return Utils._.flatten(
        Utils._.map(schemaNames, function(value) {
          return (!!value.schema_name ? value.schema_name : value);
        })
      );
    });
  };

  QueryInterface.prototype.databaseVersion = function() {
    return this.sequelize.query(this.QueryGenerator.versionQuery(), null, {
      raw: true,
      type: QueryTypes.VERSION
    });
  };

  QueryInterface.prototype.createTable = function(tableName, attributes, options) {
    var keys = Object.keys(attributes)
      , keyLen = keys.length
      , self = this
      , sql = ''
      , i = 0;

    attributes = Utils._.mapValues(attributes, function(attribute, name) {
      if (!Utils._.isPlainObject(attribute)) {
        attribute = { type: attribute, allowNull: true };
      }

      attribute.type = self.sequelize.normalizeDataType(attribute.type);

      if (attribute.hasOwnProperty('defaultValue')) {
        if (typeof attribute.defaultValue === "function" && (
            attribute.defaultValue === DataTypes.NOW ||
            attribute.defaultValue === DataTypes.UUIDV4 ||
            attribute.defaultValue === DataTypes.UUIDV4 
        )) {
          attribute.defaultValue = new attribute.defaultValue();
        }
      }

      if (attribute.type instanceof DataTypes.ENUM) {
        // The ENUM is a special case where the type is an object containing the values
        attribute.values = attribute.values || attribute.type.values || [];

        if (!attribute.values.length) {
          throw new Error('Values for ENUM haven\'t been defined.');
        }
      }

      return attribute;
    });

    options = Utils._.extend({
      logging: this.sequelize.options.logging,
    }, options || {});

    // Postgres requires a special SQL command for enums
    if (self.sequelize.options.dialect === 'postgres') {
      var promises = []
        // For backwards-compatibility, public schemas don't need to
        // explicitly state their schema when creating a new enum type
        , getTableName = (!options || !options.schema || options.schema === 'public' ? '' : options.schema + '_') + tableName;

      for (i = 0; i < keyLen; i++) {
        if (attributes[keys[i]].type instanceof DataTypes.ENUM) {
          sql = self.QueryGenerator.pgListEnums(getTableName, keys[i], options);
          promises.push(self.sequelize.query(sql, null, { plain: true, raw: true, type: QueryTypes.SELECT, logging: options.logging }));
        }
      }

      return Promise.all(promises).then(function(results) {
        var promises = []
          // Find the table that we're trying to create throgh DAOFactoryManager
          , daoTable = self.sequelize.daoFactoryManager.daos.filter(function(dao) { return dao.tableName === tableName; })
          , enumIdx = 0;

        daoTable = daoTable.length > 0 ? daoTable[0] : null;

        for (i = 0; i < keyLen; i++) {
          if (attributes[keys[i]].type instanceof DataTypes.ENUM) {
            // If the enum type doesn't exist then create it
            if (!results[enumIdx]) {
              sql = self.QueryGenerator.pgEnum(getTableName, keys[i], attributes[keys[i]], options);
              promises.push(self.sequelize.query(sql, null, { raw: true, logging: options.logging }));
            } else if (!!results[enumIdx] && !!daoTable) {
              var enumVals = self.QueryGenerator.fromArray(results[enumIdx].enum_value)
                , vals = daoTable.rawAttributes[keys[i]].values;

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

                  promises.push(self.sequelize.query(self.QueryGenerator.pgEnumAdd(getTableName, keys[i], value, options)));
                }
              });
              enumIdx++;
            }
          }
        }

        if (!tableName.schema && options.schema) {
          tableName = self.QueryGenerator.addSchema({
            tableName: tableName,
            schema: options.schema
          });
        }

        attributes = self.QueryGenerator.attributesToSQL(attributes, {
          context: 'createTable'
        });
        sql = self.QueryGenerator.createTableQuery(tableName, attributes, options);

        return Promise.all(promises).then(function() {
          return self.sequelize.query(sql, null, options);
        });
      });
    } else {
      if (!tableName.schema && options.schema) {
        tableName = self.QueryGenerator.addSchema({
          tableName: tableName,
          schema: options.schema
        });
      }

      attributes = self.QueryGenerator.attributesToSQL(attributes, {
        context: 'createTable'
      });
      sql = self.QueryGenerator.createTableQuery(tableName, attributes, options);

      return self.sequelize.query(sql, null, options);
    }
  };

  QueryInterface.prototype.dropTable = function(tableName, options) {
    // if we're forcing we should be cascading unless explicitly stated otherwise
    options = options || {};
    options.cascade = options.cascade || options.force || false;

    var sql = this.QueryGenerator.dropTableQuery(tableName, options)
      , self = this;

    return this.sequelize.query(sql, null, options).then(function() {
      var promises = [];

      // Since postgres has a special case for enums, we should drop the related
      // enum type within the table and attribute
      if (self.sequelize.options.dialect === 'postgres') {
        // Find the table that we're trying to drop
        var daoTable = self.sequelize.daoFactoryManager.getDAO(tableName, { attribute: 'tableName' });

        if (!!daoTable) {
          var getTableName = (!options || !options.schema || options.schema === 'public' ? '' : options.schema + '_') + tableName;

          var keys = Object.keys(daoTable.rawAttributes)
            , keyLen = keys.length
            , i = 0;

          for (i = 0; i < keyLen; i++) {
            if (daoTable.rawAttributes[keys[i]].type instanceof DataTypes.ENUM) {
              promises.push(self.sequelize.query(self.QueryGenerator.pgEnumDrop(getTableName, keys[i]), null, {logging: options.logging, raw: true}));
            }
          }
        }
      }

      return Promise.all(promises).get(0);
    });
  };

  QueryInterface.prototype.dropAllTables = function(options) {
    var self = this;

    options = options || {};

    var dropAllTables = function(tableNames) {
      return Utils.Promise.reduce(tableNames, function(total, tableName) {
        // if tableName is not in the Array of tables names then dont drop it
        if (skip.indexOf(tableName.tableName || tableName) === -1) {
          return self.dropTable(tableName, { cascade: true });
        }
      }, null);
    };

    var skip = options.skip || [];
    return self.showAllTables().then(function(tableNames) {
      if (self.sequelize.options.dialect === 'sqlite') {
        return self.sequelize.query('PRAGMA foreign_keys;').then(function(result) {
          var foreignKeysAreEnabled = result.foreign_keys === 1;

          if (foreignKeysAreEnabled) {
            return self.sequelize.query('PRAGMA foreign_keys = OFF').then(function() {
              return dropAllTables(tableNames).then(function() {
                return self.sequelize.query('PRAGMA foreign_keys = ON');
              });
            });
          } else {
            return dropAllTables(tableNames);
          }
        });
      } else {
        return self.getForeignKeysForTables(tableNames).then(function(foreignKeys) {
          var promises = [];

          tableNames.forEach(function(tableName) {
            var normalizedTableName = tableName;
            if (Utils._.isObject(tableName)) {
               normalizedTableName = tableName.schema + '.' + tableName.tableName;
            }

            foreignKeys[normalizedTableName].forEach(function(foreignKey) {
              var sql = self.QueryGenerator.dropForeignKeyQuery(tableName, foreignKey);
              promises.push(self.sequelize.query(sql));
            });
          });

          return Utils.Promise.all(promises).then(function() {
            return dropAllTables(tableNames);
          });
        });
      }
    });
  };

  QueryInterface.prototype.dropAllEnums = function(options) {
    if (this.sequelize.getDialect() !== 'postgres') {
      return Utils.Promise.resolve();
    }

    options = options || {};

    var self = this
      , sql = this.QueryGenerator.pgListEnums();

    return this.sequelize.query(sql, null, { plain: false, raw: true, type: QueryTypes.SELECT, logging: options.logging }).map(function(result) {
      return self.sequelize.query(
        self.QueryGenerator.pgEnumDrop(null, null, self.QueryGenerator.pgEscapeAndQuote(result.enum_name)),
        null,
        {logging: options.logging, raw: true}
      );
    });
  };

  QueryInterface.prototype.renameTable = function(before, after) {
    var sql = this.QueryGenerator.renameTableQuery(before, after);
    return this.sequelize.query(sql, null, {logging: this.sequelize.options.logging});
  };

  QueryInterface.prototype.showAllTables = function(options) {
    var self = this;
    options = Utils._.extend({
      raw: true,
      type: QueryTypes.SHOWTABLES
    }, options || {});

    var showTablesSql = self.QueryGenerator.showTablesQuery();
    return self.sequelize.query(showTablesSql, null, options).then(function(tableNames) {
      return Utils._.flatten(tableNames);
    });
  };

  QueryInterface.prototype.describeTable = function(tableName, options) {
    var schema = null
      , schemaDelimiter = null;

    if (typeof options === 'string') {
      schema = options;
    } else if (typeof options === 'object') {
      schema = options.schema || null;
      schemaDelimiter = options.schemaDelimiter || null;
    }

    if (typeof tableName === 'object') {
      schema = tableName.schema;
      tableName = tableName.tableName;
    }

    var sql = this.QueryGenerator.describeTableQuery(tableName, schema, schemaDelimiter);

    return this.sequelize.query(sql, { type: QueryTypes.DESCRIBE }).then(function(data) {
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

  QueryInterface.prototype.addColumn = function(table, key, attribute) {
    attribute = this.sequelize.normalizeAttribute(attribute);
    return this.sequelize.query(this.QueryGenerator.addColumnQuery(table, key, attribute), null, {logging: this.sequelize.options.logging});
  };

  QueryInterface.prototype.removeColumn = function(tableName, attributeName) {
    if (this.sequelize.options.dialect === 'sqlite') {
      // sqlite needs some special treatment as it cannot drop a column
      return SQLiteQueryInterface.removeColumn.call(this, tableName, attributeName);
    } else {
      var sql = this.QueryGenerator.removeColumnQuery(tableName, attributeName);
      return this.sequelize.query(sql, null, {logging: this.sequelize.options.logging});
    }
  };

  QueryInterface.prototype.changeColumn = function(tableName, attributeName, dataTypeOrOptions) {
    var attributes = {};

    if (Utils._.values(DataTypes).indexOf(dataTypeOrOptions) > -1) {
      attributes[attributeName] = { type: dataTypeOrOptions, allowNull: true };
    } else {
      attributes[attributeName] = dataTypeOrOptions;
    }

    attributes[attributeName].type = this.sequelize.normalizeDataType(attributes[attributeName].type);

    if (this.sequelize.options.dialect === 'sqlite') {
      // sqlite needs some special treatment as it cannot change a column
      return SQLiteQueryInterface.changeColumn.call(this, tableName, attributes);
    } else {
      var options = this.QueryGenerator.attributesToSQL(attributes)
        , sql = this.QueryGenerator.changeColumnQuery(tableName, options);

      return this.sequelize.query(sql, null, {logging: this.sequelize.options.logging});
    }
  };

  QueryInterface.prototype.renameColumn = function(tableName, attrNameBefore, attrNameAfter) {
    return this.describeTable(tableName).then(function(data) {
      data = data[attrNameBefore] || {};

      var options = {};

      options[attrNameAfter] = {
        attribute: attrNameAfter,
        type: data.type,
        allowNull: data.allowNull,
        defaultValue: data.defaultValue
      };

      // fix: a not-null column cannot have null as default value
      if (data.defaultValue === null && !data.allowNull) {
        delete options[attrNameAfter].defaultValue;
      }

      if (this.sequelize.options.dialect === 'sqlite') {
        // sqlite needs some special treatment as it cannot rename a column
        return SQLiteQueryInterface.renameColumn.call(this, tableName, attrNameBefore, attrNameAfter);
      } else {
        var sql = this.QueryGenerator.renameColumnQuery(
          tableName,
          attrNameBefore,
          this.QueryGenerator.attributesToSQL(options)
        );
        return this.sequelize.query(sql, null, {logging: this.sequelize.options.logging});
      }
    }.bind(this));
  };

  QueryInterface.prototype.addIndex = function(tableName, _attributes, _options, _rawTablename) {
    var attributes, options, rawTablename;

    // Support for passing tableName, attributes, options or tableName, options (with a fields param which is the attributes)
    if (Array.isArray(_attributes)) {
      attributes = _attributes;
      options = _options;

      rawTablename = _rawTablename;
    } else {
      // Support for passing an options object with a fields attribute instead of attributes, options
      options = _attributes;
      attributes = options.fields;

      rawTablename = _options;
    }

    if (!rawTablename) {
      // Map for backwards compat
      rawTablename = tableName;
    }

    options = options || {};
    var sql = this.QueryGenerator.addIndexQuery(tableName, attributes, options, rawTablename);
    return this.sequelize.query(sql, null, {logging: options.hasOwnProperty('logging') ? options.logging : this.sequelize.options.logging});
  };

  QueryInterface.prototype.showIndex = function(tableName, options) {
    var sql = this.QueryGenerator.showIndexesQuery(tableName, options);
    options = options || {};
    return this.sequelize.query(sql, null, {
      logging: options.hasOwnProperty('logging') ? options.logging : this.sequelize.options.logging,
      type: QueryTypes.SHOWINDEXES
    });
  };

  QueryInterface.prototype.nameIndexes = function(indexes, rawTablename) {
    return this.QueryGenerator.nameIndexes(indexes, rawTablename);
  };

  QueryInterface.prototype.getForeignKeysForTables = function(tableNames) {
    var self = this;

    if (tableNames.length === 0) {
      return Utils.Promise.resolve({});
    }

    return Utils.Promise.map(tableNames, function(tableName) {
      return self.sequelize.query(self.QueryGenerator.getForeignKeysQuery(tableName, self.sequelize.config.database)).get(0);
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

  QueryInterface.prototype.removeIndex = function(tableName, indexNameOrAttributes) {
    var sql = this.QueryGenerator.removeIndexQuery(tableName, indexNameOrAttributes);
    return this.sequelize.query(sql, null, {logging: this.sequelize.options.logging});
  };

  QueryInterface.prototype.insert = function(dao, tableName, values, options) {
    var sql = this.QueryGenerator.insertQuery(tableName, values, dao && dao.Model.rawAttributes, options);

    options.type = QueryTypes.INSERT;
    return this.sequelize.query(sql, dao, options).then(function(result) {
      if (dao) result.isNewRecord = false;
      return result;
    });
  };

  QueryInterface.prototype.upsert = function(tableName, values, model, options) {
    var wheres = []
      , where
      , indexFields
      , indexes = []
      , updateValues
      , attributes = Object.keys(values);

    where = {};
    for (var i = 0; i < model.primaryKeyAttributes.length; i++) {
      var key = model.primaryKeyAttributes[i];
      if(key in values){
        where[key] = values[key];
      }
    }

    if (!Utils._.isEmpty(where)) {
      wheres.push(where);
    }

    // Lets combine uniquekeys and indexes into one
    indexes = Utils._.map(model.options.uniqueKeys, function (value, key) {
      return value.fields;
    });

    Utils._.each(model.options.indexes, function (value, key) {
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
          where[field] = values[field];
        });
        wheres.push(where);
      }
    });

    where = this.sequelize.or.apply(this.sequelize, wheres);

    options.type = QueryTypes.UPSERT;
    options.raw = true;


    if (model._timestampAttributes.createdAt) {
      // If we are updating an existing row, we shouldn't set createdAt
      updateValues = Utils.cloneDeep(values);

      delete updateValues[model._timestampAttributes.createdAt];
    } else {
      updateValues = values;
    }

    var sql = this.QueryGenerator.upsertQuery(tableName, values, updateValues, where, model.rawAttributes, options);
    return this.sequelize.query(sql, null, options).then(function (rowCount) {
      if (rowCount === undefined) {
        return rowCount;
      }

      // MySQL returns 1 for inserted, 2 for updated http://dev.mysql.com/doc/refman/5.0/en/insert-on-duplicate.html. Postgres has been modded to do the same

      return rowCount === 1;
    });
  };

  QueryInterface.prototype.bulkInsert = function(tableName, records, options, attributes) {
    options.type = QueryTypes.INSERT;
    var sql = this.QueryGenerator.bulkInsertQuery(tableName, records, options, attributes);
    return this.sequelize.query(sql, null, options);
  };

  QueryInterface.prototype.update = function(dao, tableName, values, identifier, options) {
    var self = this
      , restrict = false
      , sql = self.QueryGenerator.updateQuery(tableName, values, identifier, options, dao.Model.rawAttributes);

    options = options || {};
    options.type = QueryTypes.UPDATE;

    // Check for a restrict field
    if (!!dao.Model && !!dao.Model.associations) {
      var keys = Object.keys(dao.Model.associations)
        , length = keys.length;

      for (var i = 0; i < length; i++) {
        if (dao.Model.associations[keys[i]].options && dao.Model.associations[keys[i]].options.onUpdate && dao.Model.associations[keys[i]].options.onUpdate === 'restrict') {
          restrict = true;
        }
      }
    }

    return this.sequelize.query(sql, dao, options);
  };

  QueryInterface.prototype.bulkUpdate = function(tableName, values, identifier, options, attributes) {
    var sql = this.QueryGenerator.updateQuery(tableName, values, identifier, options, attributes)
      , table = Utils._.isObject(tableName) ? tableName : { tableName: tableName }
      , daoTable = Utils._.find(this.sequelize.daoFactoryManager.daos, { tableName: table.tableName });

    return this.sequelize.query(sql, daoTable, options);
  };

  QueryInterface.prototype.delete = function(dao, tableName, identifier, options) {
    var self = this
      , cascades = []
      , sql = self.QueryGenerator.deleteQuery(tableName, identifier, null, dao.Model);

    // Check for a restrict field
    if (!!dao.Model && !!dao.Model.associations) {
      var keys = Object.keys(dao.Model.associations)
        , length = keys.length;

      for (var i = 0; i < length; i++) {
        if (dao.Model.associations[keys[i]].options && dao.Model.associations[keys[i]].options.onDelete) {
          if (dao.Model.associations[keys[i]].options.onDelete === 'cascade' && dao.Model.associations[keys[i]].options.useHooks === true) {
            cascades.push(dao.Model.associations[keys[i]].accessors.get);
          }
        }
      }
    }

    return Promise.reduce(cascades, function (memo, cascade) {
      return dao[cascade]().then(function (instances) {
        if (!Array.isArray(instances)) instances = [instances];
        
        return Promise.reduce(instances, function (memo, instance) {
          return instance.destroy();
        }, []);
      });
    }, []).then(function () {
      return self.sequelize.query(sql, dao, options);
    });
  };

  QueryInterface.prototype.bulkDelete = function(tableName, identifier, options, model) {
    var sql = this.QueryGenerator.deleteQuery(tableName, identifier, Utils._.defaults(options || {}, {limit: null}), model);
    return this.sequelize.query(sql, null, options);
  };

  QueryInterface.prototype.select = function(model, tableName, options, queryOptions) {
    options = options || {};

    // See if we need to merge options and model.scopeObj
    // we're doing this on the QueryInterface level because it's a bridge between
    // sequelize and the databases
    if (model.options.defaultScope && Object.keys(model.options.defaultScope).length > 0) {
      if (!!options) {
        Utils.injectScope.call(model, options, true);
      }

      var scopeObj = buildScope.call(model);
      Object.keys(scopeObj).forEach(function(method) {
        if (typeof scopeObj[method] === 'number' || !Utils._.isEmpty(scopeObj[method])) {
          options[method] = scopeObj[method];
        }
      });
    }

    options.lock = queryOptions.lock;
    options.subQuery = queryOptions.subQuery;

    var sql = this.QueryGenerator.selectQuery(tableName, options, model);
    queryOptions = Utils._.extend({}, queryOptions, {
      type: QueryTypes.SELECT,
      include: options.include,
      includeNames: options.includeNames,
      includeMap: options.includeMap,
      hasSingleAssociation: options.hasSingleAssociation,
      hasMultiAssociation: options.hasMultiAssociation,
      attributes: options.attributes,
      originalAttributes: options.originalAttributes,
    });

    return this.sequelize.query(sql, model, queryOptions);
  };

  QueryInterface.prototype.increment = function(dao, tableName, values, identifier, options) {
    var sql = this.QueryGenerator.incrementQuery(tableName, values, identifier, options.attributes);
    return this.sequelize.query(sql, dao, options);
  };

  QueryInterface.prototype.rawSelect = function(tableName, options, attributeSelector, Model) {
    if (options.schema) {
      tableName = this.QueryGenerator.addSchema({
        tableName: tableName,
        schema: options.schema
      });
    }

    options.plain = options.plain === undefined ? true : options.plain;

    var sql = this.QueryGenerator.selectQuery(tableName, options, Model)
      , queryOptions = Utils._.extend({ transaction: options.transaction, plain: options.plain }, { raw: true, type: QueryTypes.SELECT })
      , self = this;

    if (attributeSelector === undefined) {
      throw new Error('Please pass an attribute selector!');
    }

    return this.sequelize.query(sql, null, queryOptions).then(function(data) {
      if (!queryOptions.plain) {
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

  QueryInterface.prototype.createTrigger = function(tableName, triggerName, timingType, fireOnArray,
      functionName, functionParams, optionsArray) {
    var sql = this.QueryGenerator.createTrigger(tableName, triggerName, timingType, fireOnArray, functionName
      , functionParams, optionsArray);
    if (sql) {
      return this.sequelize.query(sql, null, {logging: this.sequelize.options.logging});
    } else {
      return Utils.Promise.resolve();
    }
  };

  QueryInterface.prototype.dropTrigger = function(tableName, triggerName) {
    var sql = this.QueryGenerator.dropTrigger(tableName, triggerName);
    if (sql) {
      return this.sequelize.query(sql, null, {logging: this.sequelize.options.logging});
    } else {
      return Utils.Promise.resolve();
    }
  };

  QueryInterface.prototype.renameTrigger = function(tableName, oldTriggerName, newTriggerName) {
    var sql = this.QueryGenerator.renameTrigger(tableName, oldTriggerName, newTriggerName);
    if (sql) {
      return this.sequelize.query(sql, null, {logging: this.sequelize.options.logging});
    } else {
      return Utils.Promise.resolve();
    }
  };

  QueryInterface.prototype.createFunction = function(functionName, params, returnType, language, body, options) {
    var sql = this.QueryGenerator.createFunction(functionName, params, returnType, language, body, options);
    if (sql) {
      return this.sequelize.query(sql, null, {logging: this.sequelize.options.logging});
    } else {
      return Utils.Promise.resolve();
    }
  };

  QueryInterface.prototype.dropFunction = function(functionName, params) {
    var sql = this.QueryGenerator.dropFunction(functionName, params);
    if (sql) {
      return this.sequelize.query(sql, null, {logging: this.sequelize.options.logging});
    } else {
      return Utils.Promise.resolve();
    }
  };

  QueryInterface.prototype.renameFunction = function(oldFunctionName, params, newFunctionName) {
    var sql = this.QueryGenerator.renameFunction(oldFunctionName, params, newFunctionName);
    if (sql) {
      return this.sequelize.query(sql, null, {logging: this.sequelize.options.logging});
    } else {
      return Utils.Promise.resolve();
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

    options = Utils._.extend({
      parent: options.transaction
    }, options || {});

    var sql = this.QueryGenerator.setAutocommitQuery(value, options);
    if (sql) {
      return this.sequelize.query(sql, null, { transaction: transaction });
    } else {
      return Utils.Promise.resolve();
    }
  };

  QueryInterface.prototype.setIsolationLevel = function(transaction, value, options) {
    if (!transaction || !(transaction instanceof Transaction)) {
      throw new Error('Unable to set isolation level for a transaction without transaction object!');
    }

    options = Utils._.extend({
      parent: options.transaction
    }, options || {});

    var sql = this.QueryGenerator.setIsolationLevelQuery(value, options);

    if (sql) {
      return this.sequelize.query(sql, null, { transaction: transaction });
    } else {
      return Utils.Promise.resolve();
    }
  };

  QueryInterface.prototype.startTransaction = function(transaction, options) {
    if (!transaction || !(transaction instanceof Transaction)) {
      throw new Error('Unable to start a transaction without transaction object!');
    }

    options = Utils._.extend({
      transaction: transaction,
      parent: options.transaction
    }, options || {});

    var sql = this.QueryGenerator.startTransactionQuery(transaction, options);
    return this.sequelize.query(sql, null, options);
  };

  QueryInterface.prototype.commitTransaction = function(transaction, options) {
    if (!transaction || !(transaction instanceof Transaction)) {
      throw new Error('Unable to commit a transaction without transaction object!');
    }

    options = Utils._.extend({
      transaction: transaction,
      parent: options.transaction
    }, options || {});

    var sql = this.QueryGenerator.commitTransactionQuery(options);

    if (sql) {
      return this.sequelize.query(sql, null, options);
    } else {
      return Utils.Promise.resolve();
    }
  };

  QueryInterface.prototype.rollbackTransaction = function(transaction, options) {
    if (!transaction || !(transaction instanceof Transaction)) {
      throw new Error('Unable to rollback a transaction without transaction object!');
    }

    options = Utils._.extend({
      transaction: transaction,
      parent: options.transaction
    }, options || {});

    var sql = this.QueryGenerator.rollbackTransactionQuery(transaction, options);
    return this.sequelize.query(sql, null, options);
  };

  // private

  var buildScope = function() {
    var smart;

    // Use smartWhere to convert several {where} objects into a single where object
    smart = Utils.smartWhere(this.scopeObj.where || [], this.daoFactoryManager.sequelize.options.dialect);
    smart = Utils.compileSmartWhere.call(this, smart, this.daoFactoryManager.sequelize.options.dialect);
    return {limit: this.scopeObj.limit || null, offset: this.scopeObj.offset || null, where: smart, order: (this.scopeObj.order || []).join(', ')};
  };

  return QueryInterface;
})();
