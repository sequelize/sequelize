'use strict';

import {
  AbstractQuery,
  DatabaseError,
  ForeignKeyConstraintError,
  UniqueConstraintError,
  ValidationErrorItem,
} from '@sequelize/core';
import { logger } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/logger.js';
import forOwn from 'lodash/forOwn';
import map from 'lodash/map';
import mapKeys from 'lodash/mapKeys';
import reduce from 'lodash/reduce';
import zipObject from 'lodash/zipObject';

const ER_DUP_ENTRY = 1062;
const ER_DEADLOCK = 1213;
const ER_ROW_IS_REFERENCED = 1451;
const ER_NO_REFERENCED_ROW = 1452;

const debug = logger.debugContext('sql:snowflake');

export class SnowflakeQuery extends AbstractQuery {
  async run(sql, parameters) {
    this.sql = sql;
    const { connection, options } = this;

    const showWarnings = this.sequelize.dialect.options.showWarnings || options.showWarnings;

    const complete = this._logQuery(sql, debug, parameters);

    if (parameters) {
      debug('parameters(%j)', parameters);
    }

    let results;

    try {
      results = await new Promise((resolve, reject) => {
        connection.execute({
          sqlText: sql,
          binds: parameters,
          complete(err, _stmt, rows) {
            if (err) {
              reject(err);
            } else {
              resolve(rows);
            }
          },
        });
      });
    } catch (error) {
      if (options.transaction && error.errno === ER_DEADLOCK) {
        try {
          await options.transaction.rollback();
        } catch {
          // ignore errors
        }
      }

      error.sql = sql;
      error.parameters = parameters;
      throw this.formatError(error);
    } finally {
      complete();
    }

    if (showWarnings && results && results.warningStatus > 0) {
      await this.logWarnings(results);
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
    let result = this.instance;

    if (this.isInsertQuery(data)) {
      this.handleInsertQuery(data);

      if (!this.instance) {
        const modelDefinition = this.model?.modelDefinition;

        // handle bulkCreate AI primary key
        if (
          data.constructor.name === 'ResultSetHeader' &&
          modelDefinition?.autoIncrementAttributeName &&
          modelDefinition?.autoIncrementAttributeName === this.model.primaryKeyAttribute
        ) {
          const startId = data[this.getInsertIdField()];
          result = [];
          for (let i = startId; i < startId + data.affectedRows; i++) {
            result.push({ [modelDefinition.getColumnName(this.model.primaryKeyAttribute)]: i });
          }
        } else {
          result = data[this.getInsertIdField()];
        }
      }
    }

    if (this.isSelectQuery()) {
      // Snowflake will treat tables as case-insensitive, so fix the case
      // of the returned values to match attributes
      // TODO [>7]: remove this.sequelize.options.quoteIdentifiers === false
      if (this.options.raw === false && this.sequelize.options.quoteIdentifiers === false) {
        const attrsMap = Object.create(null);

        for (const attrName of this.model.modelDefinition.attributes.keys()) {
          attrsMap[attrName.toLowerCase()] = attrName;
        }

        data = data.map(data =>
          reduce(
            data,
            (prev, value, key) => {
              if (value !== undefined && attrsMap[key]) {
                prev[attrsMap[key]] = value;
                delete prev[key];
              }

              return prev;
            },
            data,
          ),
        );
      }

      this.options.fieldMap = mapKeys(this.options.fieldMap, (v, k) => {
        return k.toUpperCase();
      });

      return this.handleSelectQuery(data);
    }

    if (this.isDescribeQuery()) {
      result = {};

      for (const _result of data) {
        result[_result.Field] = {
          type: _result.Type.toUpperCase(),
          allowNull: _result.Null === 'YES',
          defaultValue: _result.Default,
          primaryKey: _result.Key === 'PRI',
          autoIncrement:
            Object.hasOwn(_result, 'Extra') && _result.Extra.toLowerCase() === 'auto_increment',
          comment: _result.Comment ? _result.Comment : null,
        };
      }

      return result;
    }

    if (this.isShowIndexesQuery()) {
      return this.handleShowIndexesQuery(data);
    }

    if (this.isCallQuery()) {
      return data[0];
    }

    if (this.isBulkUpdateQuery() || this.isDeleteQuery()) {
      return data[0]['number of rows updated'];
    }

    if (this.isUpsertQuery()) {
      return [result, data.affectedRows === 1];
    }

    if (this.isInsertQuery() || this.isUpdateQuery()) {
      return [result, data.affectedRows];
    }

    if (this.isShowConstraintsQuery()) {
      return data;
    }

    if (this.isRawQuery()) {
      return [data, data];
    }

    return result;
  }

  formatError(err) {
    const errCode = err.errno || err.code;

    switch (errCode) {
      case ER_DUP_ENTRY: {
        const match = err.message.match(/Duplicate entry '([\S\s]*)' for key '?((.|\s)*?)'?$/);
        let fields = {};
        let message = 'Validation error';
        const values = match ? match[1].split('-') : undefined;
        const fieldKey = match ? match[2] : undefined;
        const fieldVal = match ? match[1] : undefined;
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

      case ER_ROW_IS_REFERENCED:
      case ER_NO_REFERENCED_ROW: {
        // e.g. CONSTRAINT `example_constraint_name` FOREIGN KEY (`example_id`) REFERENCES `examples` (`id`)
        const match = err.message.match(
          /CONSTRAINT (["`])(.*)\1 FOREIGN KEY \(\1(.*)\1\) REFERENCES \1(.*)\1 \(\1(.*)\1\)/,
        );
        const quoteChar = match ? match[1] : '`';
        const fields = match
          ? match[3].split(new RegExp(`${quoteChar}, *${quoteChar}`))
          : undefined;

        return new ForeignKeyConstraintError({
          reltype: String(errCode) === String(ER_ROW_IS_REFERENCED) ? 'parent' : 'child',
          table: match ? match[4] : undefined,
          fields,
          value:
            (fields && fields.length && this.instance && this.instance[fields[0]]) || undefined,
          index: match ? match[2] : undefined,
          cause: err,
        });
      }

      default:
        return new DatabaseError(err);
    }
  }

  handleShowIndexesQuery(data) {
    // Group by index name, and collect all fields
    data = data.reduce((acc, item) => {
      if (!(item.Key_name in acc)) {
        acc[item.Key_name] = item;
        item.fields = [];
      }

      acc[item.Key_name].fields[item.Seq_in_index - 1] = {
        attribute: item.Column_name,
        length: item.Sub_part || undefined,
        order: item.Collation === 'A' ? 'ASC' : undefined,
      };
      delete item.column_name;

      return acc;
    }, {});

    return map(data, item => ({
      primary: item.Key_name === 'PRIMARY',
      fields: item.fields,
      name: item.Key_name,
      tableName: item.Table,
      unique: item.Non_unique !== 1,
      type: item.Index_type,
    }));
  }
}
