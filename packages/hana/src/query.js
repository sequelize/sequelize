import { result } from 'lodash';
import { find } from '@sequelize/utils';

const { promisify } = require('node:util');

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

    // const exec = promisify(cb => connection.exec(sql, cb));


    console.log('before run', sql);
    console.log('parameters', parameters);
    // // const result = await exec(sql);
    // return result;

    const complete = this._logQuery(sql, debug, parameters);

    const parametersEscaped = [];
    if(Array.isArray(parameters)) {
      for(const param of parameters) {
        const value = stringifyIfBigint(param);
        parametersEscaped.push(value);
      }
    }

//return this._runCallback(sql, parametersEscaped, connection, complete);
//return this._runSync(sql, parametersEscaped, connection, complete);
//return this._runSyncPromise(sql, parametersEscaped, connection, complete);
return this._runPromise(sql, parametersEscaped, connection, complete);

/*
    return new Promise((resolve, reject) => {
      const stmt = connection.prepare(sql);
      stmt.exec(parametersEscaped, (err, resultSet, arg2, arg3, arg4)=> {
        console.log('stmt.getColumnInfo()', stmt.getColumnInfo())
        console.log('resultSet arg2, arg3, arg4', resultSet, arg2, arg3, arg4)
        if(err) {
          console.log('error executing SQL statement:', sql, parametersEscaped)
          console.log('error run hana connection.exec', err)
          reject( this.formatError(err));
          return;
        }
        complete();
//        const resulColumnInfo = resultSet.getColumnInfo();
        const resulColumnInfo = stmt.getColumnInfo();

//        const rows = [];
//        while (resultSet.next()) {
//          rows.push(resultSet.getValues());
//        }
        const rows = resultSet;
        console.log('connection preparedStmt.exec succeed', rows)
        const parsedRows = [];
        for(const row of rows) {
          const parsedRow = {};
          for(const columnName in row) {
            const columnInfo = resulColumnInfo.find(x => x.columnName === columnName);
            if(!columnInfo) {
              throw new Error('the column info is empty:' + columnInfo); // todo dazhuang use sequelize error
            }
            const { nativeTypeName } = columnInfo;//console.log('columnInfo', columnInfo)
            let value = row[columnName];
            const parse = this.sequelize.dialect.getParserForDatabaseDataType(nativeTypeName);
            if(value !== null && parse) {
//              console.log('parse not null, nativeTypeName:', nativeTypeName, 'columnInfo:', columnInfo )
              value = parse(value);
            }
            parsedRow[columnName] = value;
          }
          parsedRows.push(parsedRow);
        }

//        setTimeout(() => {

        resolve( this.formatResults(parsedRows));

//        }, 0)

      });
    });
*/

    const stmt = connection.prepare(sql);
//    const resultSet = stmt.execQuery(parametersEscaped);
    let result = null;
    try {
      result = stmt.exec(parametersEscaped);
      console.log('sync stmt.exec result', result)
    } catch ( e ) {
      console.error('prepared stmt exec failed', sql, e);
      return this.formatError(e);
    }
    complete();
//    const resulColumnInfo = resultSet.getColumnInfo();
    const resulColumnInfo = stmt.getColumnInfo();

//    const rows = [];
//    while (resultSet.next()) {
//      rows.push(resultSet.getValues());
//    }
    const rows = result;
    console.log('connection preparedStmt.exec succeed', rows)
    const parsedRows = [];
    if( this.isInsertQuery(result, resulColumnInfo) && Array.isArray(result))
    for(const row of rows) {
      const parsedRow = {};
      for(const columnName in row) {
        const columnInfo = resulColumnInfo.find(x => x.columnName === columnName);
        if(!columnInfo) {
          throw new Error('the column info is empty:' + columnInfo); // todo dazhuang use sequelize error
        }
        const { nativeTypeName } = columnInfo;
        let value = row[columnName];
        const parse = this.sequelize.dialect.getParserForDatabaseDataType(nativeTypeName);
        if(value !== null && parse) {
          value = parse(value);
        }
        parsedRow[columnName] = value;
      }
      parsedRows.push(parsedRow);
    }

    return this.formatResults(result, resulColumnInfo);


    // console.log('result xxxx', result);
    // return [];

/*
    return new Promise((resolve, reject) => {
      connection.exec(sql, parametersEscaped, (err, result)=> {
      // stmt.execQuery(parametersEscaped, (err, result)=> {
        if(err) {
          console.log('error executing SQL statement:', sql, parametersEscaped)
          console.log('error run hana connection.exec', err)
          reject(this.formatError(err));
          return;
        }
        console.log('connection.exec succeed', result)
        // todo check whether return only first row
        // if (result.length === 1) {
        //   resolve(result[0])
        // }
        // resolve(result)
        complete();
        resolve(this.formatResults(result));
      })
    });
*/
  }

  async _runCallback(sql, parameters, connection, complete) {
    return new Promise((resolve, reject) => {
//      const stmt = connection.prepare(sql);
      let stmt = null;
      try {
        stmt = connection.prepare(sql);
      } catch(error) {
        console.log('error thrown by prepare', error)
        error.sql = sql;
        reject( this.formatError(error));
        return;
      }

      stmt.exec(parameters, {}, (error, result, arg2, arg3, arg4)=> {
//        console.log('stmt.getColumnInfo()', stmt.getColumnInfo())
        console.log('result arg2, arg3, arg4', result, arg2, arg3, arg4)
        if(error) {
          console.log('error executing SQL statement:', sql, parameters)
          console.log('error run hana connection.exec', error)
          error.sql = sql;
          reject( this.formatError(error));
          return;
        }
        complete();
        const resulColumnInfo = stmt.getColumnInfo();

        console.log('connection preparedStmt.exec succeed', result)
        const parsedRows = [];
        if(Array.isArray(result)) {
          const rows = result;
          for(const row of rows) {
            const parsedRow = {};
            for(const columnName in row) {
              const columnInfo = resulColumnInfo.find(x => x.columnName === columnName);
              if(!columnInfo) {
                throw new Error('the column info is empty:' + columnInfo); // todo dazhuang use sequelize error
              }
              const { nativeTypeName } = columnInfo;//console.log('columnInfo', columnInfo)
              let value = row[columnName];
              const parse = this.sequelize.dialect.getParserForDatabaseDataType(nativeTypeName);
              if(value !== null && parse) {
  //              console.log('parse not null, nativeTypeName:', nativeTypeName, 'columnInfo:', columnInfo )
                value = parse(value);
              }
              parsedRow[columnName] = value;
            }
            parsedRows.push(parsedRow);
          }
        }

        if(Array.isArray(result)) {

        }
        const data = Array.isArray(result) ? parsedRows : result;

        resolve( this.formatResults(data));
      });
    });
  }

  _runSync(sql, parameters, connection, complete) {
    const stmt = connection.prepare(sql);
//    const timeoutSecond = 10;
//    stmt.setTimeout(timeoutSecond);
    let result = null;
    try {
      result = stmt.exec(parameters, { communicationTimeout: 40000 });
      console.log('sync stmt.exec result', result)
    } catch ( e ) {
      console.error('prepared stmt exec failed', sql, e);
      return this.formatError(e);
    }
    complete();
    const resulColumnInfo = stmt.getColumnInfo();

    const rows = result;
    console.log('connection preparedStmt.exec succeed', rows)
    const parsedRows = [];

    return this.formatResults(result, resulColumnInfo);
  }

  _runSyncPromise(sql, parameters, connection, complete) {
    return new Promise((resolve, reject) => {
      const stmt = connection.prepare(sql);
    //    const timeoutSecond = 10;
    //    stmt.setTimeout(timeoutSecond);
      let result = null;
      try {
        result = stmt.exec(parameters, { communicationTimeout: 40000 });
        console.log('sync stmt.exec result', result)
      } catch ( e ) {
        console.error('prepared stmt exec failed', sql, e);
//        return this.formatError(e);
        reject( this.formatError(e));
      }
      complete();
      const resulColumnInfo = stmt.getColumnInfo();

      const rows = result;
      console.log('connection preparedStmt.exec succeed', rows)
      const parsedRows = [];

//      return this.formatResults(result, resulColumnInfo);
      resolve(this.formatResults(result, resulColumnInfo));
    });
  }

  async _runPromise(sql, parameters, connection, complete) {

    try{
//      const stmt = connection.prepare(sql);
      let stmt = null;
      try {
        stmt = await PromiseModule.prepare(connection, sql);
      } catch(error) {
        // todo  remove redundant try-catch-throw, which is for testing
        console.log('error thrown by prepare', error)
        throw error;
      }

      const result = await PromiseModule.exec(stmt, parameters, {});
//      const resultSet = await PromiseModule.execQuery(stmt, parameters, {});
//      const result = this._getResultFromResultSet(resultSet);
      complete();
      const resulColumnInfo = stmt.getColumnInfo();

      console.log('connection preparedStmt.exec succeed', result)
      const parsedRows = [];
      if(Array.isArray(result)) {
        const rows = result;
        for(const row of rows) {
          const parsedRow = {};
          for(const columnName in row) {
            const columnInfo = resulColumnInfo.find(x => x.columnName === columnName);
            if(!columnInfo) {
              throw new Error('the column info is empty:' + columnInfo); // todo dazhuang use sequelize error
            }
            const { nativeTypeName } = columnInfo;//console.log('columnInfo', columnInfo)
            let value = row[columnName];
            const parse = this.sequelize.dialect.getParserForDatabaseDataType(nativeTypeName);
            if(value !== null && parse) {
//              console.log('parse not null, nativeTypeName:', nativeTypeName, 'columnInfo:', columnInfo )
              value = parse(value);
            }
            parsedRow[columnName] = value;
          }
          parsedRows.push(parsedRow);
        }
      }

      const data = Array.isArray(result) ? parsedRows : result;

      let batchInsertCurrentIdentityValue = undefined;
      if(this.isBulkInsertQuery()) {
        const identitySql = 'SELECT CURRENT_IDENTITY_VALUE() as "id" FROM DUMMY;';
        try{
          const identityStmt = await PromiseModule.prepare(connection, identitySql);
          const identityResult = await PromiseModule.exec(identityStmt, [], {});
          console.log('identityResult', identityResult);
          batchInsertCurrentIdentityValue = identityResult[0].id;
        } catch(error) {
          console.log('error thrown by prepare', error)
          error.sql = sql;
          throw this.formatError(error);
        }
      }

      return this.formatResults(data, undefined, batchInsertCurrentIdentityValue);
    } catch(error) {
      console.log('error executing SQL statement:', sql, parameters)
      console.log('error run hana connection.exec', error)
      error.sql = sql;
      throw this.formatError(error);
    }
  }

  _getResultFromResultSet(resultSet) {
    const rows = [];
    while (resultSet.next()) {
      rows.push(resultSet.getValues());
    }
    return rows;
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
          for(let i = 0; i < data; i++) {
            result.push({
              [modelDefinition.getColumnName(this.model.primaryKeyAttribute)]: startId + i
            });
          }
          return [result, affectedRows];
        }
      }
    }

    if (this.isInsertQuery() || this.isUpdateQuery() || this.isUpsertQuery()) {
      const affectedRows = data;
      if (this.instance && this.instance.dataValues) {
        for (const key in data[0]) {
          if (Object.hasOwn(data[0], key)) {
            const record = data[0][key];

            const attributes = this.model.modelDefinition.attributes;
            const attr = find(attributes.values(), attribute => attribute.attributeName === key || attribute.columnName === key);

            this.instance.dataValues[attr?.attributeName || key] = record;
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
        affectedRows,
      ];
    }

    return data;
  }

  formatError(err) {
    const errCode = err.code;

    switch (errCode) {
      // todo format error from DB query
      case ERR_SQL_MANY_PRIMARY_KEY: {
        const match = err.message.match(
          /cannot have more than one primary key: (.*)/
        );
        const table = match[1];
        return new UnknownConstraintError({
          message: err.message,
          table,
          cause: err,
        });
      }
      case ERR_SQL_UNIQUE_VIOLATED: {
        const match = err.message.match(
          /Index\((.*)\) with error: unique constraint violation/
        );
        let fields = {};
        let message = 'Validation error';
        const values =  undefined;
        const fieldKey = match ? match[1] : undefined;
        const fieldVal = undefined;
        const uniqueKey =
          this.model &&
          this.model.getIndexes().find(index => index.unique && index.name === fieldKey);
        if (uniqueKey) {
          if (uniqueKey.msg) {
            message = uniqueKey.msg;
          }
          fields = zipObject(uniqueKey.fields, values);
        } else {
          fields[fieldKey] = fieldVal;
        }

        const errors = [];
        fields={};// for integration test 'should not deadlock with concurrency duplicate entries and no outer transaction'
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
        const table = err.message.match(/TrexColumnUpdate failed on table '(.*):(.*)'/)?.[2];
        return new ForeignKeyConstraintError({
          table,
          fields: undefined,
          index: undefined,
          cause: err,
        });
      }
      case ERR_SQL_FK_ON_UPDATE_DELETE_FAILED: {
        const table = err.message.match(/TrexColumnUpdate failed on table '(.*):(.*)'/)?.[2];
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
    for(const row of data) {
      let index = result.find(x => x.name === row.name);
      if(index === undefined) {
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
        order: row.ascendingOrder === 'TRUE'
          ? 'ASC'
          : row.ascendingOrder === 'FALSE'
            ? 'DESC'
            : undefined,
      });
//      result.push({
//        primary: row.constraint === 'PRIMARY KEY',
//        fields: ['first', 'second'], // todo
//        name: row.name,
//        tableName: row.tableName,
//        unique: row.constraint === 'PRIMARY KEY' || row.constraint.includes('UNIQUE'), // todo check if use sys.constraint
//        type: row.type,
//      });
    }
    return result;
  }

  isBulkInsertQuery() {
    if (this.options.type === QueryTypes.INSERT) {
      // if not bulk, sql uses DO-BEGIN block and starts with 'DO'
      if (this.sql.toLowerCase().startsWith('insert into')) {
        return true;
      }
    }
    return false;
  }
}
