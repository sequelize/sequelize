import { result } from 'lodash';
import { find } from '@sequelize/utils';

const { promisify } = require('node:util');

import {
  AbstractQuery,
  DatabaseError,
  ForeignKeyConstraintError,
  UniqueConstraintError,
  UnknownConstraintError,
  ValidationErrorItem,
} from '@sequelize/core';
import { logger } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/logger.js';

const debug = logger.debugContext('sql:hana');

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

    return new Promise((resolve, reject) => {
      connection.exec(sql, parameters, (err, result)=> {
        if(err) {
          console.log('error executing SQL statement:', sql, parameters)
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
  }

  formatResults(data) {
    if (this.isSelectQuery()) {
      return this.handleSelectQuery(data);
    }

    if (this.isInsertQuery() || this.isUpdateQuery() || this.isUpsertQuery()) {
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
        data.count,
      ];
    }

    return data;
  }

  formatError(err) {
    const errCode = err.code;

    switch (errCode) {
      // todo format error from DB query
      default:
        return new DatabaseError(err);
    }
  }
}
