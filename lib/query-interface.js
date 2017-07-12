'use strict';

const Utils = require('./utils');
const _ = require('lodash');
const DataTypes = require('./data-types');
const SQLiteQueryInterface = require('./dialects/sqlite/query-interface');
const MSSSQLQueryInterface = require('./dialects/mssql/query-interface');
const MySQLQueryInterface = require('./dialects/mysql/query-interface');
const Transaction = require('./transaction');
const Promise = require('./promise');
const QueryTypes = require('./query-types');

/**
 * The interface that Sequelize uses to talk to all databases
 * @class QueryInterface
 * @private
 */
class QueryInterface {
  constructor(sequelize) {
    this.sequelize = sequelize;
    this.QueryGenerator = this.sequelize.dialect.QueryGenerator;
  }

  createSchema(schema, options) {
    options = options || {};
    const sql = this.QueryGenerator.createSchema(schema);
    return this.sequelize.query(sql, options);
  }

  dropSchema(schema, options) {
    options = options || {};
    const sql = this.QueryGenerator.dropSchema(schema);
    return this.sequelize.query(sql, options);
  }

  dropAllSchemas(options) {
    options = options || {};

    if (!this.QueryGenerator._dialect.supports.schemas) {
      return this.sequelize.drop(options);
    } else {
      return this.showAllSchemas(options).map(schemaName => this.dropSchema(schemaName, options));
    }
  }

  showAllSchemas(options) {

    options = _.assign({}, options, {
      raw: true,
      type: this.sequelize.QueryTypes.SELECT
    });

    const showSchemasSql = this.QueryGenerator.showSchemasQuery();

    return this.sequelize.query(showSchemasSql, options).then(schemaNames => Utils._.flatten(
      Utils._.map(schemaNames, value => value.schema_name ? value.schema_name : value)
    ));
  }

  databaseVersion(options) {
    return this.sequelize.query(
      this.QueryGenerator.versionQuery(),
      _.assign({}, options, { type: QueryTypes.VERSION })
    );
  }

  createTable(tableName, attributes, options, model) {
    const keys = Object.keys(attributes);
    const keyLen = keys.length;
    let sql = '';
    let i = 0;

    options = _.clone(options) || {};

    attributes = Utils._.mapValues(attributes, attribute => {
      if (!Utils._.isPlainObject(attribute)) {
        attribute = { type: attribute, allowNull: true };
      }

      attribute = this.sequelize.normalizeAttribute(attribute);

      return attribute;
    });

    // Postgres requires a special SQL command for enums
    if (this.sequelize.options.dialect === 'postgres') {
      const promises = [];

      for (i = 0; i < keyLen; i++) {
        if (attributes[keys[i]].type instanceof DataTypes.ENUM) {
          sql = this.QueryGenerator.pgListEnums(tableName, attributes[keys[i]].field || keys[i], options);
          promises.push(this.sequelize.query(
            sql,
            _.assign({}, options, { plain: true, raw: true, type: QueryTypes.SELECT })
          ));
        }
      }

      return Promise.all(promises).then(results => {
        const promises = [];
        let enumIdx = 0;

        for (i = 0; i < keyLen; i++) {
          if (attributes[keys[i]].type instanceof DataTypes.ENUM) {
            // If the enum type doesn't exist then create it
            if (!results[enumIdx]) {
              sql = this.QueryGenerator.pgEnum(tableName, attributes[keys[i]].field || keys[i], attributes[keys[i]], options);
              promises.push(this.sequelize.query(
                sql,
                _.assign({}, options, { raw: true })
              ));
            } else if (!!results[enumIdx] && !!model) {
              const enumVals = this.QueryGenerator.fromArray(results[enumIdx].enum_value);
              const vals = model.rawAttributes[keys[i]].values;

              vals.forEach((value, idx) => {
                // reset out after/before options since it's for every enum value
                const valueOptions = _.clone(options);
                valueOptions.before = null;
                valueOptions.after = null;

                if (enumVals.indexOf(value) === -1) {
                  if (vals[idx + 1]) {
                    valueOptions.before = vals[idx + 1];
                  }
                  else if (vals[idx - 1]) {
                    valueOptions.after = vals[idx - 1];
                  }
                  valueOptions.supportsSearchPath = false;
                  promises.push(this.sequelize.query(this.QueryGenerator.pgEnumAdd(tableName, keys[i], value, valueOptions), valueOptions));
                }
              });
              enumIdx++;
            }
          }
        }

        if (!tableName.schema &&
          (options.schema || !!model && model._schema)) {
          tableName = this.QueryGenerator.addSchema({
            tableName,
            _schema: !!model && model._schema || options.schema
          });
        }

        attributes = this.QueryGenerator.attributesToSQL(attributes, {
          context: 'createTable'
        });
        sql = this.QueryGenerator.createTableQuery(tableName, attributes, options);

        return Promise.all(promises).then(() => {
          return this.sequelize.query(sql, options);
        });
      });
    } else {
      if (!tableName.schema &&
        (options.schema || !!model && model._schema)) {
        tableName = this.QueryGenerator.addSchema({
          tableName,
          _schema: !!model && model._schema || options.schema
        });
      }

      attributes = this.QueryGenerator.attributesToSQL(attributes, {
        context: 'createTable'
      });
      sql = this.QueryGenerator.createTableQuery(tableName, attributes, options);

      return this.sequelize.query(sql, options);
    }
  }

  dropTable(tableName, options) {
    // if we're forcing we should be cascading unless explicitly stated otherwise
    options = _.clone(options) || {};
    options.cascade = options.cascade || options.force || false;

    let sql = this.QueryGenerator.dropTableQuery(tableName, options);

    return this.sequelize.query(sql, options).then(() => {
      const promises = [];

      // Since postgres has a special case for enums, we should drop the related
      // enum type within the table and attribute
      if (this.sequelize.options.dialect === 'postgres') {
        const instanceTable = this.sequelize.modelManager.getModel(tableName, { attribute: 'tableName' });

        if (instanceTable) {
          const getTableName = (!options || !options.schema || options.schema === 'public' ? '' : options.schema + '_') + tableName;

          const keys = Object.keys(instanceTable.rawAttributes);
          const keyLen = keys.length;

          for (let i = 0; i < keyLen; i++) {
            if (instanceTable.rawAttributes[keys[i]].type instanceof DataTypes.ENUM) {
              sql = this.QueryGenerator.pgEnumDrop(getTableName, keys[i]);
              options.supportsSearchPath = false;
              promises.push(this.sequelize.query(sql, _.assign({}, options, { raw: true })));
            }
          }
        }
      }

      return Promise.all(promises).get(0);
    });
  }

  dropAllTables(options) {

    options = options || {};
    const skip = options.skip || [];

    const dropAllTables = tableNames => Promise.each(tableNames, tableName => {
      // if tableName is not in the Array of tables names then dont drop it
      if (skip.indexOf(tableName.tableName || tableName) === -1) {
        return this.dropTable(tableName, _.assign({}, options, { cascade: true }) );
      }
    });

    return this.showAllTables(options).then(tableNames => {
      if (this.sequelize.options.dialect === 'sqlite') {
        return this.sequelize.query('PRAGMA foreign_keys;', options).then(result => {
          const foreignKeysAreEnabled = result.foreign_keys === 1;

          if (foreignKeysAreEnabled) {
            return this.sequelize.query('PRAGMA foreign_keys = OFF', options)
              .then(() => dropAllTables(tableNames))
              .then(() => this.sequelize.query('PRAGMA foreign_keys = ON', options));
          } else {
            return dropAllTables(tableNames);
          }
        });
      } else {
        return this.getForeignKeysForTables(tableNames, options).then(foreignKeys => {
          const promises = [];

          tableNames.forEach(tableName => {
            let normalizedTableName = tableName;
            if (Utils._.isObject(tableName)) {
              normalizedTableName = tableName.schema + '.' + tableName.tableName;
            }

            foreignKeys[normalizedTableName].forEach(foreignKey => {
              const sql = this.QueryGenerator.dropForeignKeyQuery(tableName, foreignKey);
              promises.push(this.sequelize.query(sql, options));
            });
          });

          return Promise.all(promises).then(() => dropAllTables(tableNames));
        });
      }
    });
  }

  dropAllEnums(options) {
    if (this.sequelize.getDialect() !== 'postgres') {
      return Promise.resolve();
    }

    options = options || {};

    return this.pgListEnums(null, options).map(result => this.sequelize.query(
      this.QueryGenerator.pgEnumDrop(null, null, this.QueryGenerator.pgEscapeAndQuote(result.enum_name)),
      _.assign({}, options, { raw: true })
    ));
  }

  pgListEnums(tableName, options) {
    options = options || {};
    const sql = this.QueryGenerator.pgListEnums(tableName);
    return this.sequelize.query(sql, _.assign({}, options, { plain: false, raw: true, type: QueryTypes.SELECT }));
  }

  renameTable(before, after, options) {
    options = options || {};
    const sql = this.QueryGenerator.renameTableQuery(before, after);
    return this.sequelize.query(sql, options);
  }

  showAllTables(options) {
    options = _.assign({}, options, {
      raw: true,
      type: QueryTypes.SHOWTABLES
    });

    const showTablesSql = this.QueryGenerator.showTablesQuery();
    return this.sequelize.query(showTablesSql, options).then(tableNames => Utils._.flatten(tableNames));
  }

  describeTable(tableName, options) {
    let schema = null;
    let schemaDelimiter = null;

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

    const sql = this.QueryGenerator.describeTableQuery(tableName, schema, schemaDelimiter);

    return this.sequelize.query(
      sql,
      _.assign({}, options, { type: QueryTypes.DESCRIBE })
    ).then(data => {
      // If no data is returned from the query, then the table name may be wrong.
      // Query generators that use information_schema for retrieving table info will just return an empty result set,
      // it will not throw an error like built-ins do (e.g. DESCRIBE on MySql).
      if (Utils._.isEmpty(data)) {
        return Promise.reject('No description found for "' + tableName + '" table. Check the table name and schema; remember, they _are_ case sensitive.');
      } else {
        return Promise.resolve(data);
      }
    });
  }

  addColumn(table, key, attribute, options) {
    if (!table || !key || !attribute) {
      throw new Error('addColumn takes atleast 3 arguments (table, attribute name, attribute definition)');
    }

    options = options || {};
    attribute = this.sequelize.normalizeAttribute(attribute);
    return this.sequelize.query(this.QueryGenerator.addColumnQuery(table, key, attribute), options);
  }

  removeColumn(tableName, attributeName, options) {
    options = options || {};
    switch (this.sequelize.options.dialect) {
      case 'sqlite':
        // sqlite needs some special treatment as it cannot drop a column
        return SQLiteQueryInterface.removeColumn.call(this, tableName, attributeName, options);
      case 'mssql':
        // mssql needs special treatment as it cannot drop a column with a default or foreign key constraint
        return MSSSQLQueryInterface.removeColumn.call(this, tableName, attributeName, options);
      case 'mysql':
        // mysql needs special treatment as it cannot drop a column with a foreign key constraint
        return MySQLQueryInterface.removeColumn.call(this, tableName, attributeName, options);
      default:
        return this.sequelize.query(this.QueryGenerator.removeColumnQuery(tableName, attributeName), options);
    }
  }

  changeColumn(tableName, attributeName, dataTypeOrOptions, options) {
    const attributes = {};
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
      const query = this.QueryGenerator.attributesToSQL(attributes);
      const sql = this.QueryGenerator.changeColumnQuery(tableName, query);

      return this.sequelize.query(sql, options);
    }
  }

  renameColumn(tableName, attrNameBefore, attrNameAfter, options) {
    options = options || {};
    return this.describeTable(tableName, options).then(data => {
      if (!data[attrNameBefore]) {
        throw new Error('Table ' + tableName + ' doesn\'t have the column ' + attrNameBefore);
      }

      data = data[attrNameBefore] || {};

      const _options = {};

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
        const sql = this.QueryGenerator.renameColumnQuery(
          tableName,
          attrNameBefore,
          this.QueryGenerator.attributesToSQL(_options)
        );
        return this.sequelize.query(sql, options);
      }
    });
  }

  addIndex(tableName, attributes, options, rawTablename) {
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

    options = Utils.cloneDeep(options);
    options.fields = attributes;
    const sql = this.QueryGenerator.addIndexQuery(tableName, options, rawTablename);
    return this.sequelize.query(sql, _.assign({}, options, { supportsSearchPath: false }));
  }

  showIndex(tableName, options) {
    const sql = this.QueryGenerator.showIndexesQuery(tableName, options);
    return this.sequelize.query(sql, _.assign({}, options, { type: QueryTypes.SHOWINDEXES }));
  }

  nameIndexes(indexes, rawTablename) {
    return this.QueryGenerator.nameIndexes(indexes, rawTablename);
  }

  getForeignKeysForTables(tableNames, options) {
    options = options || {};

    if (tableNames.length === 0) {
      return Promise.resolve({});
    }

    return Promise.map(tableNames, tableName =>
      this.sequelize.query(this.QueryGenerator.getForeignKeysQuery(tableName, this.sequelize.config.database), options).get(0)
    ).then(results => {
      const result = {};

      tableNames.forEach((tableName, i) => {
        if (Utils._.isObject(tableName)) {
          tableName = tableName.schema + '.' + tableName.tableName;
        }

        result[tableName] = Utils._.compact(results[i]).map(r => r.constraint_name);
      });

      return result;
    });
  }

  removeIndex(tableName, indexNameOrAttributes, options) {
    options = options || {};
    const sql = this.QueryGenerator.removeIndexQuery(tableName, indexNameOrAttributes);
    return this.sequelize.query(sql, options);
  }

  addConstraint(tableName, attributes, options, rawTablename) {
    if (!Array.isArray(attributes)) {
      rawTablename = options;
      options = attributes;
      attributes = options.fields;
    }

    if (!options.type) {
      throw new Error('Constraint type must be specified through options.type');
    }

    if (!rawTablename) {
      // Map for backwards compat
      rawTablename = tableName;
    }

    options = Utils.cloneDeep(options);
    options.fields = attributes;

    if (this.sequelize.dialect.name === 'sqlite') {
      return SQLiteQueryInterface.addConstraint.call(this, tableName, options, rawTablename);
    } else {
      const sql = this.QueryGenerator.addConstraintQuery(tableName, options, rawTablename);
      return this.sequelize.query(sql, options);
    }
  }

  showConstraint(tableName, options) {
    const sql = this.QueryGenerator.showConstraintsQuery(tableName, options);
    return this.sequelize.query(sql, Object.assign({}, options, { type: QueryTypes.SHOWCONSTRAINTS }));
  }

  removeConstraint(tableName, constraintName, options) {
    options = options || {};

    switch (this.sequelize.options.dialect) {
      case 'mysql':
        //Mysql does not support DROP CONSTRAINT. Instead DROP PRIMARY, FOREIGN KEY, INDEX should be used
        return MySQLQueryInterface.removeConstraint.call(this, tableName, constraintName, options);
      case 'sqlite':
        return SQLiteQueryInterface.removeConstraint.call(this, tableName, constraintName, options);
      default:
        const sql = this.QueryGenerator.removeConstraintQuery(tableName, constraintName);
        return this.sequelize.query(sql, options);
    }
  }

  insert(instance, tableName, values, options) {
    options = Utils.cloneDeep(options);
    options.hasTrigger = instance && instance.constructor.options.hasTrigger;
    const sql = this.QueryGenerator.insertQuery(tableName, values, instance && instance.constructor.rawAttributes, options);

    options.type = QueryTypes.INSERT;
    options.instance = instance;

    return this.sequelize.query(sql, options).then(results => {
      if (instance) results[0].isNewRecord = false;
      return results;
    });
  }

  upsert(tableName, valuesByField, updateValues, where, model, options) {
    const wheres = [];
    const attributes = Object.keys(valuesByField);
    let indexes = [];
    let indexFields;

    options = _.clone(options);

    if (!Utils._.isEmpty(where)) {
      wheres.push(where);
    }

    // Lets combine uniquekeys and indexes into one
    indexes = Utils._.map(model.options.uniqueKeys, value => {
      return value.fields;
    });

    Utils._.each(model.options.indexes, value => {
      if (value.unique) {
        // fields in the index may both the strings or objects with an attribute property - lets sanitize that
        indexFields = Utils._.map(value.fields, field => {
          if (Utils._.isPlainObject(field)) {
            return field.attribute;
          }
          return field;
        });
        indexes.push(indexFields);
      }
    });

    for (const index of indexes) {
      if (Utils._.intersection(attributes, index).length === index.length) {
        where = {};
        for (const field of index) {
          where[field] = valuesByField[field];
        }
        wheres.push(where);
      }
    }

    where = { $or: wheres };

    options.type = QueryTypes.UPSERT;
    options.raw = true;

    const sql = this.QueryGenerator.upsertQuery(tableName, valuesByField, updateValues, where, model, options);
    return this.sequelize.query(sql, options).then(rowCount => {
      if (rowCount === undefined) {
        return rowCount;
      }

      // MySQL returns 1 for inserted, 2 for updated http://dev.mysql.com/doc/refman/5.0/en/insert-on-duplicate.html. Postgres has been modded to do the same

      return rowCount === 1;
    });
  }

  bulkInsert(tableName, records, options, attributes) {
    options = _.clone(options) || {};
    options.type = QueryTypes.INSERT;
    const sql = this.QueryGenerator.bulkInsertQuery(tableName, records, options, attributes);
    return this.sequelize.query(sql, options).then(results => results[0]);
  }

  update(instance, tableName, values, identifier, options) {
    options = _.clone(options || {});
    options.hasTrigger = !!(instance && instance._modelOptions && instance._modelOptions.hasTrigger);

    const sql = this.QueryGenerator.updateQuery(tableName, values, identifier, options, instance.constructor.rawAttributes);

    options.type = QueryTypes.UPDATE;

    options.instance = instance;
    return this.sequelize.query(sql, options);
  }

  bulkUpdate(tableName, values, identifier, options, attributes) {
    options = Utils.cloneDeep(options);
    if (typeof identifier === 'object') identifier = Utils.cloneDeep(identifier);

    const sql = this.QueryGenerator.updateQuery(tableName, values, identifier, options, attributes);
    const table = Utils._.isObject(tableName) ? tableName : { tableName };
    const model = Utils._.find(this.sequelize.modelManager.models, { tableName: table.tableName });

    options.model = model;
    return this.sequelize.query(sql, options);
  }

  delete(instance, tableName, identifier, options) {
    const cascades = [];
    const sql = this.QueryGenerator.deleteQuery(tableName, identifier, null, instance.constructor);

    options = _.clone(options) || {};

    // Check for a restrict field
    if (!!instance.constructor && !!instance.constructor.associations) {
      const keys = Object.keys(instance.constructor.associations);
      const length = keys.length;
      let association;

      for (let i = 0; i < length; i++) {
        association = instance.constructor.associations[keys[i]];
        if (association.options && association.options.onDelete &&
          association.options.onDelete.toLowerCase() === 'cascade' &&
          association.options.useHooks === true) {
          cascades.push(association.accessors.get);
        }
      }
    }

    return Promise.each(cascades, cascade => {
      return instance[cascade](options).then(instances => {
        // Check for hasOne relationship with non-existing associate ("has zero")
        if (!instances) {
          return Promise.resolve();
        }

        if (!Array.isArray(instances)) instances = [instances];

        return Promise.each(instances, instance => instance.destroy(options));
      });
    }).then(() => {
      options.instance = instance;
      return this.sequelize.query(sql, options);
    });
  }

  bulkDelete(tableName, identifier, options, model) {
    options = Utils.cloneDeep(options);
    options = _.defaults(options, {limit: null});
    if (typeof identifier === 'object') identifier = Utils.cloneDeep(identifier);

    const sql = this.QueryGenerator.deleteQuery(tableName, identifier, options, model);
    return this.sequelize.query(sql, options);
  }

  select(model, tableName, options) {
    options = Utils.cloneDeep(options);
    options.type = QueryTypes.SELECT;
    options.model = model;

    return this.sequelize.query(
      this.QueryGenerator.selectQuery(tableName, options, model),
      options
    );
  }

  increment(model, tableName, values, identifier, options) {
    options = Utils.cloneDeep(options);

    const sql = this.QueryGenerator.arithmeticQuery('+', tableName, values, identifier, options, options.attributes);

    options.type = QueryTypes.UPDATE;
    options.model = model;

    return this.sequelize.query(sql, options);
  }

  decrement(instance, tableName, values, identifier, options) {
    const sql = this.QueryGenerator.arithmeticQuery('-', tableName, values, identifier, options, options.attributes);

    options = _.clone(options) || {};

    options.type = QueryTypes.UPDATE;
    options.instance = instance;
    return this.sequelize.query(sql, options);
  }

  rawSelect(tableName, options, attributeSelector, Model) {
    if (options.schema) {
      tableName = this.QueryGenerator.addSchema({
        tableName,
        _schema: options.schema
      });
    }

    options = Utils.cloneDeep(options);
    options = _.defaults(options, {
      raw: true,
      plain: true,
      type: QueryTypes.SELECT
    });

    const sql = this.QueryGenerator.selectQuery(tableName, options, Model);

    if (attributeSelector === undefined) {
      throw new Error('Please pass an attribute selector!');
    }

    return this.sequelize.query(sql, options).then(data => {
      if (!options.plain) {
        return data;
      }

      let result = data ? data[attributeSelector] : null;

      if (options && options.dataType) {
        const dataType = options.dataType;

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
  }

  createTrigger(tableName, triggerName, timingType, fireOnArray, functionName, functionParams, optionsArray, options) {
    const sql = this.QueryGenerator.createTrigger(tableName, triggerName, timingType, fireOnArray, functionName, functionParams, optionsArray);
    options = options || {};
    if (sql) {
      return this.sequelize.query(sql, options);
    } else {
      return Promise.resolve();
    }
  }

  dropTrigger(tableName, triggerName, options) {
    const sql = this.QueryGenerator.dropTrigger(tableName, triggerName);
    options = options || {};

    if (sql) {
      return this.sequelize.query(sql, options);
    } else {
      return Promise.resolve();
    }
  }

  renameTrigger(tableName, oldTriggerName, newTriggerName, options) {
    const sql = this.QueryGenerator.renameTrigger(tableName, oldTriggerName, newTriggerName);
    options = options || {};

    if (sql) {
      return this.sequelize.query(sql, options);
    } else {
      return Promise.resolve();
    }
  }

  createFunction(functionName, params, returnType, language, body, options) {
    const sql = this.QueryGenerator.createFunction(functionName, params, returnType, language, body, options);
    options = options || {};

    if (sql) {
      return this.sequelize.query(sql, options);
    } else {
      return Promise.resolve();
    }
  }

  dropFunction(functionName, params, options) {
    const sql = this.QueryGenerator.dropFunction(functionName, params);
    options = options || {};

    if (sql) {
      return this.sequelize.query(sql, options);
    } else {
      return Promise.resolve();
    }
  }

  renameFunction(oldFunctionName, params, newFunctionName, options) {
    const sql = this.QueryGenerator.renameFunction(oldFunctionName, params, newFunctionName);
    options = options || {};

    if (sql) {
      return this.sequelize.query(sql, options);
    } else {
      return Promise.resolve();
    }
  }

  // Helper methods useful for querying

  /**
   * Escape an identifier (e.g. a table or attribute name). If force is true,
   * the identifier will be quoted even if the `quoteIdentifiers` option is
   * false.
   * @private
   */
  quoteIdentifier(identifier, force) {
    return this.QueryGenerator.quoteIdentifier(identifier, force);
  }

  quoteTable(identifier) {
    return this.QueryGenerator.quoteTable(identifier);
  }

  /**
   * Split an identifier into .-separated tokens and quote each part.
   * If force is true, the identifier will be quoted even if the
   * `quoteIdentifiers` option is false.
   * @private
   */
  quoteIdentifiers(identifiers, force) {
    return this.QueryGenerator.quoteIdentifiers(identifiers, force);
  }

  /**
   * Escape a value (e.g. a string, number or date)
   * @private
   */
  escape(value) {
    return this.QueryGenerator.escape(value);
  }

  setAutocommit(transaction, value, options) {
    if (!transaction || !(transaction instanceof Transaction)) {
      throw new Error('Unable to set autocommit for a transaction without transaction object!');
    }
    if (transaction.parent) {
      // Not possible to set a separate isolation level for savepoints
      return Promise.resolve();
    }

    options = _.assign({}, options, {
      transaction: transaction.parent || transaction
    });

    const sql = this.QueryGenerator.setAutocommitQuery(value, {
      parent: transaction.parent
    });

    if (!sql) return Promise.resolve();

    return this.sequelize.query(sql, options);
  }

  setIsolationLevel(transaction, value, options) {
    if (!transaction || !(transaction instanceof Transaction)) {
      throw new Error('Unable to set isolation level for a transaction without transaction object!');
    }

    if (transaction.parent || !value) {
      // Not possible to set a separate isolation level for savepoints
      return Promise.resolve();
    }

    options = _.assign({}, options, {
      transaction: transaction.parent || transaction
    });

    const sql = this.QueryGenerator.setIsolationLevelQuery(value, {
      parent: transaction.parent
    });

    if (!sql) return Promise.resolve();

    return this.sequelize.query(sql, options);
  }

  startTransaction(transaction, options) {
    if (!transaction || !(transaction instanceof Transaction)) {
      throw new Error('Unable to start a transaction without transaction object!');
    }

    options = _.assign({}, options, {
      transaction: transaction.parent || transaction
    });
    options.transaction.name = transaction.parent ? transaction.name : undefined;
    const sql = this.QueryGenerator.startTransactionQuery(transaction);

    return this.sequelize.query(sql, options);
  }

  deferConstraints(transaction, options) {
    options = _.assign({}, options, {
      transaction: transaction.parent || transaction
    });

    const sql = this.QueryGenerator.deferConstraintsQuery(options);

    if (sql) {
      return this.sequelize.query(sql, options);
    }

    return Promise.resolve();
  }

  commitTransaction(transaction, options) {
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

    const sql = this.QueryGenerator.commitTransactionQuery(transaction);
    const promise = this.sequelize.query(sql, options);

    transaction.finished = 'commit';

    return promise;
  }

  rollbackTransaction(transaction, options) {
    if (!transaction || !(transaction instanceof Transaction)) {
      throw new Error('Unable to rollback a transaction without transaction object!');
    }

    options = _.assign({}, options, {
      transaction: transaction.parent || transaction,
      supportsSearchPath: false
    });
    options.transaction.name = transaction.parent ? transaction.name : undefined;
    const sql = this.QueryGenerator.rollbackTransactionQuery(transaction);
    const promise = this.sequelize.query(sql, options);

    transaction.finished = 'rollback';

    return promise;
  }
}

module.exports = QueryInterface;
module.exports.QueryInterface = QueryInterface;
module.exports.default = QueryInterface;
