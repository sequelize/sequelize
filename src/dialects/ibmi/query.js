'use strict';

const _ = require('lodash');
const { AbstractQuery } = require('../abstract/query');
const parserStore = require('../parserStore')('ibmi');
const sequelizeErrors = require('../../errors');
const { logger } = require('../../utils/logger');

const debug = logger.debugContext('sql:ibmi');

export class IBMiQuery extends AbstractQuery {
  getInsertIdField() {
    return 'id';
  }

  async run(sql, parameters) {
    const stacktrace = new Error().stack;
    this.sql = sql.replace(/;$/, '');

    return new Promise((resolve, reject) => {
      const complete = this._logQuery(sql, debug, parameters);
      this.connection.query(this.sql, parameters, (error, results) => {

        if (error) {
          const formattedError = this.formatError(error, stacktrace);
          reject(formattedError);

          return;
        }

        complete();

        // parse the results to the format sequelize expects
        for (const result of results) {
          for (const column of results.columns) {
            const typeId = column.dataType;
            const parse = parserStore.get(typeId);
            const value = result[column.name];
            if (value !== null && parse) {
              result[column.name] = parse(value);
            }
          }
        }

        resolve(results);
      });
    })
      .then(results => this.formatResults(results));
  }

  /**
   * High level function that handles the results of a query execution.
   *
   *
   * Example:
   *  query.formatResults([
   *    {
   *      id: 1,              // this is from the main table
   *      attr2: 'snafu',     // this is from the main table
   *      Tasks.id: 1,        // this is from the associated table
   *      Tasks.title: 'task' // this is from the associated table
   *    }
   *  ])
   *
   * @param {Array} data - The result of the query execution.
   * @private
   */
  formatResults(data) {
    let result = this.instance;

    if (this.isInsertQuery() || this.isUpdateQuery() || this.isUpsertQuery()) {
      if (this.instance && this.instance.dataValues) {
        for (const key in data[0]) {
          if (Object.prototype.hasOwnProperty.call(data[0], key)) {
            const record = data[0][key];

            const attr = _.find(this.model.rawAttributes, attribute => attribute.fieldName === key || attribute.field === key);

            this.instance.dataValues[attr && attr.fieldName || key] = record;
          }
        }
      }

      if (this.isUpsertQuery()) {
        return [
          this.instance,
          null,
        ];
      }

      return [
        this.instance || data && (this.options.plain && data[0] || data) || undefined,
        data.count,
      ];
    }

    if (this.isSelectQuery()) {
      return this.handleSelectQuery(data);
    }

    if (this.isShowTablesQuery()) {
      return this.handleShowTablesQuery(data);
    }

    if (this.isShowIndexesQuery()) {
      return this.handleShowIndexesQuery(data);
    }

    if (this.isDescribeQuery()) {
      result = {};

      for (const _result of data) {
        const enumRegex = /^enum/i;
        result[_result.COLUMN_NAME] = {
          type: enumRegex.test(_result.Type) ? _result.Type.replace(enumRegex, 'ENUM') : _result.DATA_TYPE.toUpperCase(),
          allowNull: _result.IS_NULLABLE === 'Y',
          defaultValue: _result.COLUMN_DEFAULT,
          primaryKey: _result.CONSTRAINT_TYPE === 'PRIMARY KEY',
          autoIncrement: _result.IS_GENERATED !== 'IDENTITY_GENERATION',
        };
      }

      return result;
    }

    if (this.isCallQuery()) {
      return data[0];
    }

    if (this.isBulkUpdateQuery() || this.isBulkDeleteQuery() || this.isUpsertQuery()) {
      return data.count;
    }

    if (this.isVersionQuery()) {
      return data[0].VERSION;
    }

    if (this.isForeignKeysQuery()) {
      return data;
    }

    if (this.isInsertQuery(data)) {
      // insert queries can't call count, because they are actually select queries wrapped around insert queries to get the inserted id. Need to count the number of results instead.
      return [result, data.length];
    }

    if (this.isUpdateQuery()) {
      return [result, data.count];
    }

    if (this.isShowConstraintsQuery()) {
      return data;
    }

    if (this.isRawQuery()) {
      // MySQL returns row data and metadata (affected rows etc) in a single object - let's standarize it, sorta
      return [data, data];
    }

    if (this.isShowIndexesQuery()) {
      return data;
    }

    return result;
  }

  handleInsertQuery(results, metaData) {
    if (this.instance) {
      // add the inserted row id to the instance
      const autoIncrementAttribute = this.model.autoIncrementAttribute.field;
      let id = null;

      id = id || results && results[autoIncrementAttribute];
      id = id || metaData && metaData[autoIncrementAttribute];

      this.instance[this.model.autoIncrementAttribute] = id;
    }
  }

  handleShowIndexesQuery(data) {

    const indexes = Object.create(null);

    data.forEach(item => {

      if (Object.prototype.hasOwnProperty.call(indexes, item.NAME)) {
        indexes[item.NAME].fields.push({ attribute: item.COLUMN_NAME, length: undefined, order: undefined, collate: undefined });
      } else {
        indexes[item.NAME] = {
          primary: item.CONSTRAINT_TYPE === 'PRIMARY KEY',
          fields: [{ attribute: item.COLUMN_NAME, length: undefined, order: undefined, collate: undefined }],
          name: item.NAME,
          tableName: item.TABLE_NAME,
          unique: item.CONSTRAINT_TYPE === 'PRIMARY KEY' || item.CONSTRAINT_TYPE === 'UNIQUE',
          type: item.CONSTRAINT_TYPE,
        };
      }
    });

    return Object.values(indexes);
  }

  formatError(err, stacktrace) {

    // Db2 for i uses the `odbc` connector. The `odbc` connector returns a list
    // of odbc errors, each of which has a code and a state. To determine the
    // type of SequelizeError, check the code and create the associated error.
    // Error codes can be found at:
    // https://www.ibm.com/support/knowledgecenter/ssw_ibm_i_72/rzala/rzalaccl.htm

    // some errors occur outside of ODBC (e.g. connection errors)
    if (err.toString().includes('Error connecting to the database')) {
      return new sequelizeErrors.ConnectionRefusedError(err);
    }

    if (Object.prototype.hasOwnProperty.call(err, 'odbcErrors') && err.odbcErrors.length > 0) {
      const odbcError = err.odbcErrors[0];
      const foreignKeyConstraintCodes = [
        -530, // The insert or update value of a foreign key is invalid.
        -531, // The update or delete of a parent key is prevented by a NO ACTION update or delete rule.
        -532, // The update or delete of a parent key is prevented by a NO ACTION update or delete rule.
      ];
      const uniqueConstraintCodes = [
        -803, // A violation of the constraint imposed by a unique index or a unique constraint occurred.
      ];

      if (foreignKeyConstraintCodes.includes(odbcError.code)) {
        return new sequelizeErrors.ForeignKeyConstraintError({
          cause: err,
          sql: {},
          fields: {},
          stack: stacktrace,
        });
      }

      if (uniqueConstraintCodes.includes(odbcError.code)) {
        return new sequelizeErrors.UniqueConstraintError({
          errors: err.odbcErrors,
          cause: err,
          sql: {},
          fields: {},
          stack: stacktrace,
        });
      }

      if (odbcError.code === -204) {
        let constraintName;
        let type;
        const constraintNameRegex = /"([^)]+?)" in [^]+? type (\*\w+?) not found./;
        const constraintNameRegexMatches = odbcError.message.match(constraintNameRegex);
        if (constraintNameRegexMatches && constraintNameRegexMatches.length === 3) {
          constraintName = constraintNameRegexMatches[1];
          type = constraintNameRegexMatches[2];

          if (type === '*N') {
            return new sequelizeErrors.UnknownConstraintError({
              cause: err,
              constraint: constraintName,
            });
          }
        }
      }

      return new sequelizeErrors.DatabaseError(odbcError, { stack: stacktrace });
    }

    return err;
  }
}
