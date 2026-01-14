// Copyright (c) 2025, Oracle and/or its affiliates. All rights reserved

import {
  AbstractQuery,
  DatabaseError,
  ForeignKeyConstraintError,
  UniqueConstraintError,
  UnknownConstraintError,
  ValidationErrorItem,
} from '@sequelize/core';
import { logger } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/logger.js';
import { nameIndex } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/string.js';
import extend from 'lodash/extend';
import isPlainObject from 'lodash/isPlainObject';
import mapKeys from 'lodash/mapKeys';
import mapValues from 'lodash/mapValues';
import reduce from 'lodash/reduce';
import toPairs from 'lodash/toPairs';
import oracledb from 'oracledb';

const debug = logger.debugContext('sql:oracle');

export class OracleQuery extends AbstractQuery {
  constructor(connection, sequelize, options) {
    super(connection, sequelize, options);
    this.options = extend(
      {
        // eslint-disable-next-line no-console
        logging: console.log,
        plain: false,
        raw: false,
      },
      options || {},
    );

    this.checkLoggingOption();
    this.outFormat = options.outFormat || oracledb.OBJECT;
  }

  getInsertIdField() {
    return 'id';
  }

  getExecOptions() {
    const execOpts = { outFormat: this.outFormat, autoCommit: this.autoCommit };

    if (this.model && this.isSelectQuery()) {
      const fInfo = {};
      const keys = Object.keys(this.model.tableAttributes);
      for (const key of keys) {
        const keyValue = this.model.tableAttributes[key];
        if (keyValue.type.getDataTypeId() === 'DECIMAL') {
          fInfo[key] = { type: oracledb.STRING };
        }

        // Fetching BIGINT as string since, node-oracledb doesn't support JS BIGINT yet
        if (keyValue.type.getDataTypeId() === 'BIGINT') {
          fInfo[key] = { type: oracledb.STRING };
        }
      }

      if (fInfo) {
        execOpts.fetchInfo = fInfo;
      }
    }

    return execOpts;
  }

  /**
   * convert binding values for unsupported
   * types in connector library
   *
   * @param {string} bindingDictionary a string representing the key to scan
   * @private
   */
  _convertBindAttributes(bindingDictionary) {
    if (this.model && this.options[bindingDictionary]) {
      // check against model if we have some BIGINT
      const keys = Object.keys(this.model.tableAttributes);
      for (const key of keys) {
        const keyValue = this.model.tableAttributes[key];
        if (keyValue.type.getDataTypeId() === 'BIGINT') {
          const oldBinding = this.options[bindingDictionary][key];
          if (oldBinding) {
            this.options[bindingDictionary][key] = {
              ...oldBinding,
              type: oracledb.STRING,
              maxSize: 10_000_000, // TOTALLY ARBITRARY Number to prevent query failure
            };
          }
        }
      }
    }
  }

  async run(sql, parameters) {
    // We set the oracledb
    const complete = this._logQuery(sql, debug, parameters);
    const outParameters = [];
    const bindParameters = [];
    const bindDef = [];

    // eslint-disable-next-line unicorn/prefer-regexp-test
    if (!sql.match(/END;$/)) {
      this.sql = sql.replace(/; *$/, '');
    } else {
      this.sql = sql;
    }

    // When this.options.bindAttributes exists then it is an insertQuery/upsertQuery
    // So we insert the return bind direction and type
    if (
      this.options.outBindAttributes &&
      (Array.isArray(parameters) || isPlainObject(parameters))
    ) {
      this._convertBindAttributes('outBindAttributes');
      outParameters.push(...Object.values(this.options.outBindAttributes));
      // For upsertQuery we need to push the bindDef for isUpdate
      if (this.isUpsertQuery()) {
        outParameters.push({ dir: oracledb.BIND_OUT });
      }
    }

    this.bindParameters = outParameters;
    // construct input binds from parameters for single row insert execute call
    // ex: [3, 4,...]
    if (Array.isArray(parameters) || isPlainObject(parameters)) {
      if (this.options.executeMany) {
        // Constructing BindDefs for ExecuteMany call
        // Building the bindDef for in and out binds
        this._convertBindAttributes('inbindAttributes');
        bindDef.push(...Object.values(this.options.inbindAttributes));
        // eslint-disable-next-line unicorn/no-array-push-push
        bindDef.push(...outParameters);
        this.bindParameters = parameters;
      } else {
        Object.values(parameters).forEach(value => {
          bindParameters.push(value);
        });
        bindParameters.push(...outParameters);
        Object.assign(this.bindParameters, bindParameters);
      }
    }

    // TRANSACTION SUPPORT
    if (this.sql.startsWith('BEGIN TRANSACTION')) {
      this.autocommit = false;

      // eslint-disable-next-line unicorn/no-useless-promise-resolve-reject
      return Promise.resolve();
    }

    if (this.sql.startsWith('SET AUTOCOMMIT ON')) {
      this.autocommit = true;

      // eslint-disable-next-line unicorn/no-useless-promise-resolve-reject
      return Promise.resolve();
    }

    if (this.sql.startsWith('SET AUTOCOMMIT OFF')) {
      this.autocommit = false;

      // eslint-disable-next-line unicorn/no-useless-promise-resolve-reject
      return Promise.resolve();
    }

    if (this.sql.startsWith('DECLARE x NUMBER')) {
      // Calling a stored procedure for bulkInsert with NO attributes, returns nothing
      if (this.autoCommit === undefined) {
        if (this.connection.uuid) {
          this.autoCommit = false;
        } else {
          this.autoCommit = true;
        }
      }

      try {
        await this.connection.execute(this.sql, this.bindParameters, {
          autoCommit: this.autoCommit,
        });

        return Object.create(null);
      } catch (error) {
        throw this.formatError(error);
      } finally {
        complete();
      }
    }

    if (this.sql.startsWith('BEGIN')) {
      // Call to stored procedures - BEGIN TRANSACTION has been treated before
      if (this.autoCommit === undefined) {
        if (this.connection.uuid) {
          this.autoCommit = false;
        } else {
          this.autoCommit = true;
        }
      }

      try {
        const result = await this.connection.execute(this.sql, this.bindParameters, {
          outFormat: this.outFormat,
          autoCommit: this.autoCommit,
        });

        return this.formatResults(result);
      } catch (error) {
        throw this.formatError(error);
      } finally {
        complete();
      }
    }

    if (this.sql.startsWith('COMMIT TRANSACTION')) {
      try {
        await this.connection.commit();

        return Object.create(null);
      } catch (error) {
        throw this.formatError(error);
      } finally {
        complete();
      }
    }

    if (this.sql.startsWith('ROLLBACK TRANSACTION')) {
      try {
        await this.connection.rollback();

        return Object.create(null);
      } catch (error) {
        throw this.formatError(error);
      } finally {
        complete();
      }
    }

    if (this.sql.startsWith('SET TRANSACTION')) {
      try {
        await this.connection.execute(this.sql, [], { autoCommit: false });

        return Object.create(null);
      } catch (error) {
        throw this.formatError(error);
      } finally {
        complete();
      }
    }

    // QUERY SUPPORT
    // As Oracle does everything in transaction, if autoCommit is not defined, we set it to true
    if (this.autoCommit === undefined) {
      if (this.connection.uuid) {
        this.autoCommit = false;
      } else {
        this.autoCommit = true;
      }
    }

    // inbind parameters added byname. merge them
    if ('inputParameters' in this.options && this.options.inputParameters !== null) {
      Object.assign(this.bindParameters, this.options.inputParameters);
    }

    const execOpts = this.getExecOptions();
    if (this.options.executeMany && bindDef.length > 0) {
      execOpts.bindDefs = bindDef;
    }

    const executePromise = this.options.executeMany
      ? this.connection.executeMany(this.sql, this.bindParameters, execOpts)
      : this.connection.execute(this.sql, this.bindParameters, execOpts);
    try {
      const result = await executePromise;

      return this.formatResults(result);
    } catch (error) {
      throw this.formatError(error);
    } finally {
      complete();
    }
  }

  /**
   * The parameters to query.run function are built here
   *
   * @param {string} sql
   * @param {Array} values
   * @param {string} dialect
   */
  static formatBindParameters(sql, values, dialect) {
    const replacementFunc = (match, key, values) => {
      if (values[key] !== undefined) {
        return `:${key}`;
      }

      return undefined;
    };

    sql = AbstractQuery.formatBindParameters(sql, values, dialect, replacementFunc)[0];

    return [sql, values];
  }

  /**
   * Building the attribute map by matching the column names received
   * from DB and the one in rawAttributes
   * to sequelize format
   *
   * @param {object} attrsMap
   * @param {object} rawAttributes
   * @private
   */
  _getAttributeMap(attrsMap, rawAttributes) {
    attrsMap = Object.assign(
      attrsMap,
      reduce(
        rawAttributes,
        (mp, _, key) => {
          const catalogKey = this.sequelize.queryInterface.queryGenerator.getCatalogName(key);
          mp[catalogKey] = key;

          return mp;
        },
        {},
      ),
    );
  }

  /**
   * Process rows received from the DB.
   * Use parse function to parse the returned value
   * to sequelize format
   *
   * @param {Array} rows
   * @private
   */
  _processRows(rows) {
    let result = rows;
    let attrsMap = {};

    // When quoteIdentifiers is false we need to map the DB column names
    // To the one in attribute list
    if (this.sequelize.options.quoteIdentifiers === false) {
      // Building the attribute map from this.options.attributes
      // Needed in case of an aggregate function
      attrsMap = reduce(
        this.options.attributes,
        (mp, v) => {
          // Aggregate function is of form
          // Fn {fn: 'min', min}, so we have the name in index one of the object
          if (typeof v === 'object') {
            v = v[1];
          }

          const catalogv = this.sequelize.queryInterface.queryGenerator.getCatalogName(v);
          mp[catalogv] = v;

          return mp;
        },
        {},
      );

      // Building the attribute map by matching the column names received
      // from DB and the one in model.rawAttributes
      if (this.model) {
        const modelDefinition = this.model.modelDefinition;
        this._getAttributeMap(attrsMap, modelDefinition.rawAttributes);
      }

      // If aliasesmapping exists we update the attribute map
      if (this.options.aliasesMapping) {
        const obj = Object.fromEntries(this.options.aliasesMapping);
        rows = rows.map(row =>
          toPairs(row).reduce((acc, [key, value]) => {
            const mapping = Object.values(obj).find(element => {
              const catalogElement =
                this.sequelize.queryInterface.queryGenerator.getCatalogName(element);

              return catalogElement === key;
            });
            if (mapping) {
              acc[mapping || key] = value;
            }

            return acc;
          }, {}),
        );
      }

      // Modify the keys into the format that sequelize expects
      result = rows.map(row => {
        return mapKeys(row, (value, key) => {
          const targetAttr = attrsMap[key];
          if (typeof targetAttr === 'string' && targetAttr !== key) {
            return targetAttr;
          }

          return key;
        });
      });
    }

    // We parse the value received from the DB based on its datatype
    if (this.model) {
      const modelDefinition = this.model.modelDefinition;
      result = result.map(row => {
        return mapValues(row, (value, key) => {
          if (modelDefinition.rawAttributes[key] && modelDefinition.rawAttributes[key].type) {
            let typeid = modelDefinition.rawAttributes[key].type.toLocaleString();
            if (modelDefinition.rawAttributes[key].type.getDataTypeId() === 'JSON') {
              value = JSON.parse(value);
            }

            // For some types, the "name" of the type is returned with the length, we remove it
            // For Boolean we skip this because BOOLEAN is mapped to CHAR(1) and we dont' want to
            // remove the (1) for BOOLEAN
            if (
              typeid.includes('(') &&
              modelDefinition.rawAttributes[key].type.getDataTypeId() !== 'BOOLEAN'
            ) {
              typeid = typeid.slice(0, typeid.indexOf('('));
            }

            const parser = this.sequelize.dialect.getParserForDatabaseDataType(typeid);
            if (value !== null && parser) {
              value = parser(value);
            }
          }

          return value;
        });
      });
    }

    return result;
  }

  /**
   * High level function that handles the results of a query execution.
   * Example:
   * Oracle format :
   * { rows: //All rows
     [ [ 'Oracle Database 11g Enterprise Edition Release 11.2.0.1.0 - 64bit Production' ],
       [ 'PL/SQL Release 11.2.0.1.0 - Production' ],
       [ 'CORE\t11.2.0.1.0\tProduction' ],
       [ 'TNS for 64-bit Windows: Version 11.2.0.1.0 - Production' ],
       [ 'NLSRTL Version 11.2.0.1.0 - Production' ] ],
    resultSet: undefined,
    outBinds: undefined, //Used for dbms_put.line
    rowsAffected: undefined, //Number of rows affected
    metaData: [ { name: 'BANNER' } ] }
  *
  * @param {Array} data - The result of the query execution.
  */
  formatResults(data) {
    let result = this.instance;
    if (this.isInsertQuery(data)) {
      let insertData;
      if (data.outBinds) {
        const keys = Object.keys(this.options.outBindAttributes);
        insertData = data.outBinds;
        // For one row insert out bind array is 1D array
        // we convert it to 2D array for uniformity
        if (this.instance) {
          insertData = [insertData];
        }

        // Mapping the bind parameter to their values
        const res = insertData.map(row => {
          const obj = {};
          row.forEach((element, index) => {
            obj[keys[index]] = element[0];
          });

          return obj;
        });
        insertData = res;
        // For bulk insert this.insert is undefined
        // we map result to res, for one row insert
        // result needs to be this.instance
        if (!this.instance) {
          result = res;
        }
      }

      this.handleInsertQuery(insertData);

      return [result, data.rowsAffected];
    }

    if (this.isDescribeQuery()) {
      result = {};
      // Getting the table name on which we are doing describe query
      const table = Object.keys(this.sequelize.models);
      const modelAttributes = {};
      // Get the model raw attributes
      if (this.sequelize.models && table.length > 0) {
        this._getAttributeMap(
          modelAttributes,
          this.sequelize.models[table[0]].modelDefinition.rawAttributes,
        );
      }

      data.rows.forEach(_result => {
        if (_result.Default) {
          _result.Default = _result.Default.replace(`('`, '')
            .replace(`')`, '')
            // eslint-disable-next-line unicorn/prefer-string-replace-all
            .replace(/'/g, ''); /* jshint ignore: line */
        }

        // no need to add additional entries for column already in.
        if (!(modelAttributes[_result.COLUMN_NAME] in result) && !(_result.COLUMN_NAME in result)) {
          let key = modelAttributes[_result.COLUMN_NAME];
          if (!key) {
            key = _result.COLUMN_NAME;
          }

          result[key] = {
            type: _result.DATA_TYPE.toUpperCase(),
            // eslint-disable-next-line no-unneeded-ternary
            allowNull: _result.NULLABLE === 'N' ? false : true,
            defaultValue: undefined,
            primaryKey: _result.CONSTRAINT_TYPE === 'P',
          };
        }
      });
    } else if (this.isShowIndexesQuery()) {
      result = this.handleShowIndexesQuery(data.rows);
    } else if (this.isSelectQuery()) {
      const rows = data.rows;
      const result = this._processRows(rows);

      return this.handleSelectQuery(result);
    } else if (this.isCallQuery()) {
      result = data.rows[0];
    } else if (this.isUpdateQuery()) {
      result = [result, data.rowsAffected];
    } else if (this.isBulkUpdateQuery()) {
      result = data.rowsAffected;
    } else if (this.isDeleteQuery()) {
      result = data.rowsAffected;
    } else if (this.isUpsertQuery()) {
      // Upsert Query, will return nothing
      data = data.outBinds;
      const keys = Object.keys(this.options.outBindAttributes);
      const obj = {};
      for (const k in keys) {
        obj[keys[k]] = data[k];
      }

      // eslint-disable-next-line unicorn/prefer-at
      obj.isUpdate = data[data.length - 1];
      data = obj;
      // eslint-disable-next-line eqeqeq
      result = [{ isNewRecord: data.isUpdate, value: data }, data.isUpdate == 0];
    } else if (this.isShowConstraintsQuery()) {
      result = this.handleShowConstraintsQuery(data);
    } else if (this.isRawQuery()) {
      // If data.rows exists then it is a select query
      // Hence we would have two components
      // metaData and rows and we return them
      // as [data.rows, data.metaData]
      // Else it is result of update/upsert/insert query
      // and it has no rows so we return [data, data]
      if (data && data.rows) {
        return [data.rows, data.metaData];
      }

      return [data, data];
    }

    return result;
  }

  handleShowConstraintsQuery(data) {
    // Convert snake_case keys to camelCase as its generated by stored procedure
    return data.rows.map(result => {
      const constraint = {};
      for (const key in result) {
        constraint[key] = result[key];
      }

      return constraint;
    });
  }

  formatError(err) {
    let match;
    // ORA-00001: unique constraint (USER.XXXXXXX) violated
    match = err.message.match(/unique constraint ([\s\S]*) violated/);
    if (match && match.length > 1) {
      match[1] = match[1].replace('(', '').replace(')', '').split('.')[1]; // As we get (SEQUELIZE.UNIQNAME), we replace to have UNIQNAME
      const errors = [];
      let fields = [];
      let message = 'Validation error';
      let uniqueKey = null;

      if (this.model) {
        const uniqueKeys = this.model.getIndexes();

        uniqueKey = uniqueKeys.find(key => {
          // We check directly AND with quotes -> "a"" === a || "a" === "a"
          return (
            key.name.toUpperCase() === match[1].toUpperCase() ||
            key.name.toUpperCase() === `"${match[1].toUpperCase()}"`
          );
        });

        if (uniqueKey) {
          fields = uniqueKey.fields;
        }

        // eslint-disable-next-line no-implicit-coercion
        if (uniqueKey && !!uniqueKey.msg) {
          message = uniqueKey.msg;
        }

        fields.forEach(field => {
          errors.push(
            new ValidationErrorItem(
              this.getUniqueConstraintErrorMessage(field),
              'unique violation',
              field,
              null,
            ),
          );
        });
      }

      return new UniqueConstraintError({
        message,
        errors,
        cause: err,
        fields,
      });
    }

    // ORA-02291: integrity constraint (string.string) violated - parent key not found / ORA-02292: integrity constraint (string.string) violated - child record found
    match = err.message.match(/^ORA-(02291|02292):[^()]*\(([^()]+)\)/);
    if (match && match.length > 2) {
      const constraintFull = match[2];
      const constraintName = constraintFull.includes('.')
        ? constraintFull.split('.').pop() // Remove schema prefix
        : constraintFull;

      return new ForeignKeyConstraintError({
        fields: null,
        index: constraintName,
        cause: err,
      });
    }

    // ORA-02443: Cannot drop constraint  - nonexistent constraint
    match = err.message.match(/ORA-02443/);
    if (match && match.length > 0) {
      return new UnknownConstraintError(match[1]);
    }

    return new DatabaseError(err);
  }

  isShowIndexesQuery() {
    // eslint-disable-next-line unicorn/prefer-includes
    return this.sql.indexOf('SELECT i.index_name,i.table_name, i.column_name, u.uniqueness') > -1;
  }

  isSelectCountQuery() {
    return this.sql.toUpperCase().includes('SELECT COUNT(');
  }

  handleShowIndexesQuery(data) {
    const acc = [];

    // We first treat the datas
    data.forEach(indexRecord => {
      // We create the object
      if (!acc[indexRecord.INDEX_NAME]) {
        acc[indexRecord.INDEX_NAME] = {
          unique: indexRecord.UNIQUENESS === 'UNIQUE',
          primary: indexRecord.CONSTRAINT_TYPE === 'P',
          name: indexRecord.INDEX_NAME,
          tableName: indexRecord.TABLE_NAME.toLowerCase(),
          type: undefined,
        };
        acc[indexRecord.INDEX_NAME].fields = [];
      }

      // We create the fields
      acc[indexRecord.INDEX_NAME].fields.push({
        name: indexRecord.COLUMN_NAME,
        length: undefined,
        order: indexRecord.DESCEND,
        collate: undefined,
      });
    });

    const returnIndexes = [];
    const accKeys = Object.keys(acc);
    for (const accKey of accKeys) {
      const columns = {};
      columns.fields = acc[accKey].fields;
      columns.unique = acc[accKey].unique;
      // We are generating index field name in the format sequelize expects
      // to avoid creating a unique index on auto-generated index name
      // eslint-disable-next-line unicorn/prefer-regexp-test
      if (acc[accKey].name.match(/SYS_C[0-9]*/)) {
        acc[accKey].name = nameIndex(columns, acc[accKey].tableName).name;
      }

      // eslint-disable-next-line array-callback-return
      acc[accKey].fields.map(field => {
        field.attribute = field.name;
        delete field.name;
      });
      returnIndexes.push(acc[accKey]);
    }

    return returnIndexes;
  }

  handleInsertQuery(results, metaData) {
    if (this.instance && results && results.length > 0) {
      if ('pkReturnVal' in results[0]) {
        // The PK of the table is a reserved word (ex : uuid), we have to change the name in the result for the model to find the value correctly
        results[0][this.model.primaryKeyAttribute] = results[0].pkReturnVal;
        delete results[0].pkReturnVal;
      }

      // add the inserted row id to the instance
      const modelDefinition = this.model.modelDefinition;
      const autoIncrementField = modelDefinition.autoIncrementAttributeName;
      let id = null;
      let autoIncrementAlias = null;

      if (
        Object.hasOwn(modelDefinition.rawAttributes, autoIncrementField) &&
        modelDefinition.rawAttributes[autoIncrementField].field !== undefined
      ) {
        autoIncrementAlias = modelDefinition.rawAttributes[autoIncrementField].field;
      }

      id = id || (results && results[0][this.getInsertIdField()]);
      id = id || (metaData && metaData[this.getInsertIdField()]);
      id = id || (results && results[0][autoIncrementField]);
      id = id || (autoIncrementAlias && results && results[0][autoIncrementAlias]);

      this.instance[autoIncrementField] = id;
    }
  }
}
