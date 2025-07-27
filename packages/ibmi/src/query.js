'use strict';

import {
  AbstractQuery,
  ConnectionRefusedError,
  DatabaseError,
  EmptyResultError,
  ForeignKeyConstraintError,
  UniqueConstraintError,
  UnknownConstraintError,
} from '@sequelize/core';
import { logger } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/logger.js';

const debug = logger.debugContext('sql:ibmi');

export class IBMiQuery extends AbstractQuery {
  getInsertIdField() {
    return 'id';
  }

  async run(sql, parameters) {
    this.sql = sql.replace(/;$/, '');

    const complete = this._logQuery(sql, debug, parameters);

    let results;
    try {
      results = await this.connection.query(this.sql, parameters);
    } catch (error) {
      throw this.formatError(error);
    }

    complete();

    // parse the results to the format sequelize expects
    for (const result of results) {
      for (const column of results.columns) {
        const value = result[column.name];
        if (value == null) {
          continue;
        }

        const parse = this.sequelize.dialect.getParserForDatabaseDataType(column.dataType);
        if (parse) {
          result[column.name] = parse(value);
        }
      }
    }

    return this.formatResults(results);
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
    if (this.isInsertQuery() || this.isUpdateQuery() || this.isUpsertQuery()) {
      if (this.instance && this.instance.dataValues) {
        if (this.isInsertQuery() && !this.isUpsertQuery() && data.length === 0) {
          throw new EmptyResultError();
        }

        if (this.options.returning && Array.isArray(data) && data[0]) {
          for (const attributeOrColumnName of Object.keys(data[0])) {
            const modelDefinition = this.model.modelDefinition;
            const attribute = modelDefinition.columns.get(attributeOrColumnName);
            const updatedValue = this._parseDatabaseValue(
              data[0][attributeOrColumnName],
              attribute?.type,
            );

            this.instance.set(attribute?.attributeName ?? attributeOrColumnName, updatedValue, {
              raw: true,
              comesFromDatabase: true,
            });
          }
        }
      }

      if (this.isUpsertQuery()) {
        return [this.instance, null];
      }

      return [
        this.instance || (data && ((this.options.plain && data[0]) || data)) || undefined,
        data.count,
      ];
    }

    if (this.isSelectQuery()) {
      return this.handleSelectQuery(data);
    }

    if (this.isShowIndexesQuery()) {
      return this.handleShowIndexesQuery(data);
    }

    if (this.isDescribeQuery()) {
      const result = {};

      for (const _result of data) {
        const enumRegex = /^enum/i;
        result[_result.COLUMN_NAME] = {
          type: enumRegex.test(_result.Type)
            ? _result.Type.replace(enumRegex, 'ENUM')
            : _result.DATA_TYPE.toUpperCase(),
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

    if (this.isDeleteQuery()) {
      return data.count;
    }

    if (this.isBulkUpdateQuery()) {
      return this.options.returning ? this.handleSelectQuery(data) : data.count;
    }

    if (this.isShowConstraintsQuery()) {
      return data;
    }

    if (this.isRawQuery()) {
      // MySQL returns row data and metadata (affected rows etc) in a single object - let's standarize it, sorta
      return [data, data];
    }

    return this.instance;
  }

  handleInsertQuery(results, metaData) {
    if (this.instance) {
      // add the inserted row id to the instance
      const autoIncrementAttribute = this.model.autoIncrementAttribute.field;
      let id = null;

      id ||= results && results[autoIncrementAttribute];
      id ||= metaData && metaData[autoIncrementAttribute];

      this.instance[this.model.autoIncrementAttribute] = id;
    }
  }

  handleShowIndexesQuery(data) {
    const indexes = Object.create(null);

    data.forEach(item => {
      if (Object.hasOwn(indexes, item.NAME)) {
        indexes[item.NAME].fields.push({
          attribute: item.COLUMN_NAME,
          length: undefined,
          order: undefined,
          collate: undefined,
        });
      } else {
        indexes[item.NAME] = {
          primary: item.CONSTRAINT_TYPE === 'PRIMARY KEY',
          fields: [
            {
              attribute: item.COLUMN_NAME,
              length: undefined,
              order: undefined,
              collate: undefined,
            },
          ],
          name: item.NAME,
          tableName: item.TABLE_NAME,
          unique: item.CONSTRAINT_TYPE === 'PRIMARY KEY' || item.CONSTRAINT_TYPE === 'UNIQUE',
          type: item.CONSTRAINT_TYPE,
        };
      }
    });

    return Object.values(indexes);
  }

  formatError(err) {
    // Db2 for i uses the `odbc` connector. The `odbc` connector returns a list
    // of odbc errors, each of which has a code and a state. To determine the
    // type of SequelizeError, check the code and create the associated error.
    // Error codes can be found at:
    // https://www.ibm.com/support/knowledgecenter/ssw_ibm_i_72/rzala/rzalaccl.htm

    // some errors occur outside of ODBC (e.g. connection errors)
    if (err.toString().includes('Error connecting to the database')) {
      return new ConnectionRefusedError(err);
    }

    if (Object.hasOwn(err, 'odbcErrors') && err.odbcErrors.length > 0) {
      const odbcError = err.odbcErrors[0];
      const foreignKeyConstraintCodes = [
        -530, // The insert or update value of a foreign key is invalid.
        -531, // The update or delete of a parent key is prevented by a NO ACTION update or delete rule.
        -532, // The update or delete of a parent key is prevented by a NO ACTION update or delete rule.
      ];
      const uniqueConstraintCodes = [
        -803, // A violation of the constraint imposed by a unique index or a unique constraint occurred.
      ];

      /**
       * Check for ODBC connection errors by looking at the SQL state. This will allow for an IPL
       * on the IBM i to be detected and the connection to be re-established.
       */
      if (odbcError.state === '08S01') {
        return new ConnectionRefusedError(err);
      }

      if (foreignKeyConstraintCodes.includes(odbcError.code)) {
        return new ForeignKeyConstraintError({
          cause: err,
          sql: {},
          fields: {},
        });
      }

      if (uniqueConstraintCodes.includes(odbcError.code)) {
        return new UniqueConstraintError({
          errors: err.odbcErrors,
          cause: err,
          sql: {},
          fields: {},
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
            return new UnknownConstraintError({
              cause: err,
              constraint: constraintName,
            });
          }
        }
      }

      return new DatabaseError(odbcError);
    }

    return err;
  }
}
