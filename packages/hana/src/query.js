import * as PromiseModule from '@sap/hana-client/extension/Promise.js';
import {
  AbstractQuery,
  DatabaseError,
  ForeignKeyConstraintError,
  QueryTypes,
  UniqueConstraintError,
  UnknownConstraintError,
  ValidationErrorItem,
} from '@sequelize/core';
import { logger } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/logger.js';
import { find } from '@sequelize/utils';
import forOwn from 'lodash/forOwn';
import zipObject from 'lodash/zipObject';

const ERR_SQL_MANY_PRIMARY_KEY = 294;
const ERR_SQL_UNIQUE_VIOLATED = 301;
const ERR_SQL_INV_OBJ_NAME = 397;
const ERR_SQL_FK_NOT_FOUND = 461;
const ERR_SQL_FK_ON_UPDATE_DELETE_FAILED = 462;

const debug = logger.debugContext('sql:hana');

function stringifyIfBigint(value) {
  if (typeof value === 'bigint') {
    return value.toString();
  }

  return value;
}

export class HanaQuery extends AbstractQuery {
  async run(sql, parameters) {
    this.sql = sql;

    const { connection } = this;

    const complete = this._logQuery(sql, debug, parameters);

    const parametersEscaped = [];
    if (Array.isArray(parameters)) {
      for (const param of parameters) {
        const value = stringifyIfBigint(param);
        parametersEscaped.push(value);
      }
    }

    return this._runPromise(sql, parametersEscaped, connection, complete);
  }

  async _runPromise(sql, parameters, connection, complete) {
    try {
      const stmt = await PromiseModule.prepare(connection, sql);
      const result = await PromiseModule.exec(stmt, parameters, {});
      complete();
      const resulColumnInfo = stmt.getColumnInfo();

      const parsedRows = [];
      if (Array.isArray(result)) {
        const rows = result;
        for (const row of rows) {
          const parsedRow = {};
          for (const columnName in row) {
            const columnInfo = resulColumnInfo.find(x => x.columnName === columnName);
            const { nativeTypeName } = columnInfo;
            let value = row[columnName];
            const parse = this.sequelize.dialect.getParserForDatabaseDataType(nativeTypeName);
            if (value !== null && parse) {
              value = parse(value);
            }

            parsedRow[columnName] = value;
          }

          parsedRows.push(parsedRow);
        }
      }

      const data = Array.isArray(result) ? parsedRows : result;

      let batchInsertCurrentIdentityValue = undefined;
      if (this.isBulkInsertQuery()) {
        const identitySql = 'SELECT CURRENT_IDENTITY_VALUE() as "id" FROM DUMMY;';
        try {
          const identityStmt = await PromiseModule.prepare(connection, identitySql);
          const identityResult = await PromiseModule.exec(identityStmt, [], {});
          batchInsertCurrentIdentityValue = identityResult[0].id;
        } catch (error) {
          error.sql = sql;
          throw this.formatError(error);
        }
      }

      return this.formatResults(data, undefined, batchInsertCurrentIdentityValue);
    } catch (error) {
      error.sql = sql;
      throw this.formatError(error);
    }
  }

  formatResults(data, columnInfo, currentIdentityValue) {
    if (this.isSelectQuery()) {
      return this.handleSelectQuery(data);
    }

    if (this.isDescribeQuery()) {
      const result = {};
      for (const _result of data) {
        result[_result.ColumnName] = {
          type: _result.DataTypeName,
          allowNull: _result.IsNullable === 'TRUE',
          defaultValue: _result.DefaultValue,
          primaryKey: _result.IsPrimaryKey === 'TRUE',
          autoIncrement: _result.GenerationType !== null,
          comment: _result.Comments,
        };
      }

      return result;
    }

    if (this.isShowIndexesQuery()) {
      return this.handleShowIndexesQuery(data);
    }

    if (this.isBulkInsertQuery()) {
      if (!this.instance) {
        const affectedRows = data;
        const modelDefinition = this.model?.modelDefinition;
        if (
          modelDefinition?.autoIncrementAttributeName &&
          modelDefinition?.autoIncrementAttributeName === this.model.primaryKeyAttribute
        ) {
          const result = [];
          const startId = currentIdentityValue - affectedRows + 1;
          for (let i = 0; i < data; i++) {
            result.push({
              [modelDefinition.getColumnName(this.model.primaryKeyAttribute)]: startId + i,
            });
          }

          return [result, affectedRows];
        }
      } else {
        // no-op
      }
    }

    if (this.isInsertQuery() || this.isUpdateQuery() || this.isUpsertQuery()) {
      const affectedRows = data;
      if (this.instance && this.instance.dataValues) {
        for (const key in data[0]) {
          if (Object.hasOwn(data[0], key)) {
            const record = data[0][key];

            const attributes = this.model.modelDefinition.attributes;
            const attr = find(
              attributes.values(),
              attribute => attribute.attributeName === key || attribute.columnName === key,
            );

            this.instance.dataValues[attr?.attributeName || key] = record;
          }
        }
      }

      if (this.isUpsertQuery()) {
        return [this.instance, null];
      }

      return [
        this.instance || (data && ((this.options.plain && data[0]) || data)) || undefined,
        affectedRows,
      ];
    }

    if (this.isRawQuery()) {
      return [data, data];
    }

    return data;
  }

  formatError(err) {
    const errCode = err.code;

    switch (errCode) {
      case ERR_SQL_MANY_PRIMARY_KEY: {
        const match = err.message.match(/cannot have more than one primary key: (.*)/);
        const table = match[1];

        return new UnknownConstraintError({
          message: err.message,
          table,
          cause: err,
        });
      }

      case ERR_SQL_UNIQUE_VIOLATED: {
        const indexMatch = err.message.match(
          /Index\((.*)\) with error: unique constraint violation/,
        );
        const columnMatch = err.message.match(/column='([^']*)'/);
        const valueMatch = err.message.match(/value='([^']*)'/);
        let fields = {};
        let message = 'Validation error';
        const values = valueMatch ? [valueMatch[1]] : undefined;
        const indexName = indexMatch ? indexMatch[1] : undefined;
        const fieldKey = columnMatch ? columnMatch[1] : undefined;
        const fieldVal = valueMatch ? valueMatch[1] : undefined;
        const uniqueKey =
          this.model &&
          this.model.getIndexes().find(index => index.unique && index.name === indexName);
        if (uniqueKey) {
          if (uniqueKey.msg) {
            message = uniqueKey.msg;
          }

          fields = zipObject(uniqueKey.fields, values);
        } else {
          fields[fieldKey] = fieldVal;
        }

        const errors = [];
        forOwn(fields, (value, field) => {
          errors.push(
            new ValidationErrorItem(
              this.getUniqueConstraintErrorMessage(field),
              'unique violation', // ValidationErrorItem.Origins.DB,
              field,
              value,
              this.instance,
              'not_unique',
            ),
          );
        });

        return new UniqueConstraintError({ message, errors, cause: err, fields });
      }

      case ERR_SQL_INV_OBJ_NAME: {
        const constraint = undefined;
        const table = undefined;

        return new UnknownConstraintError({
          message: err.message,
          constraint,
          table,
          cause: err,
        });
      }

      case ERR_SQL_FK_NOT_FOUND: {
        const table = err.message.match(/failed on table '(.*):(.*)'/)?.[2];

        return new ForeignKeyConstraintError({
          table,
          fields: undefined,
          index: undefined,
          cause: err,
        });
      }

      case ERR_SQL_FK_ON_UPDATE_DELETE_FAILED: {
        const table = err.message.match(/failed on table '(.*):(.*)'/)?.[2];

        return new ForeignKeyConstraintError({
          table,
          fields: null,
          cause: err,
        });
      }

      default:
        return new DatabaseError(err);
    }
  }

  handleShowIndexesQuery(data) {
    const result = [];
    for (const row of data) {
      let index = result.find(x => x.name === row.name);
      if (index === undefined) {
        index = {
          primary: row.constraint === 'PRIMARY KEY',
          fields: [],
          name: row.name,
          tableName: row.tableName,
          unique: row.constraint === 'UNIQUE' || row.constraint === 'NOT NULL UNIQUE',
          type: row.type,
        };
        result.push(index);
      }

      index.fields.push({
        attribute: row.columnName,
        length: undefined,
        order:
          row.ascendingOrder === 'TRUE'
            ? 'ASC'
            : row.ascendingOrder === 'FALSE'
              ? 'DESC'
              : undefined,
      });
    }

    return result;
  }

  isBulkInsertQuery() {
    if (this.options.type === QueryTypes.INSERT) {
      // if not bulk, sql uses DO-BEGIN block and starts with 'DO'
      if (this.sql.toLowerCase().startsWith('insert into')) {
        return true;
      }

      return false;
    }

    return false;
  }
}
