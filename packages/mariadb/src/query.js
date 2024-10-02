'use strict';

import {
  AbstractQuery,
  DataTypes,
  DatabaseError,
  ForeignKeyConstraintError,
  UniqueConstraintError,
  UnknownConstraintError,
  ValidationErrorItem,
} from '@sequelize/core';
import { logger } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/logger.js';
import { inspect } from '@sequelize/utils';
import forOwn from 'lodash/forOwn';
import zipObject from 'lodash/zipObject';

const ER_DUP_ENTRY = 1062;
const ER_DEADLOCK = 1213;
const ER_ROW_IS_REFERENCED = 1451;
const ER_NO_REFERENCED_ROW = 1452;
const ER_CANT_DROP_FIELD_OR_KEY = 1091;

const debug = logger.debugContext('sql:mariadb');

export class MariaDbQuery extends AbstractQuery {
  constructor(connection, sequelize, options) {
    super(connection, sequelize, { showWarnings: false, ...options });
  }

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
      results = await connection.query(this.sql, parameters);
    } catch (error) {
      if (options.transaction && error.errno === ER_DEADLOCK) {
        // MariaDB automatically rolls-back transactions in the event of a deadlock.
        // However, we still initiate a manual rollback to ensure the connection gets released - see #13102.
        try {
          await options.transaction.rollback();
        } catch {
          // Ignore errors - since MariaDB automatically rolled back, we're
          // not that worried about this redundant rollback failing.
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

    if (this.isBulkUpdateQuery() || this.isDeleteQuery()) {
      return data.affectedRows;
    }

    if (this.isUpsertQuery()) {
      return [result, data.affectedRows === 1];
    }

    if (this.isInsertQuery(data)) {
      this.handleInsertQuery(data);

      if (!this.instance) {
        const modelDefinition = this.model?.modelDefinition;

        // handle bulkCreate AI primary key
        if (
          modelDefinition?.autoIncrementAttributeName &&
          modelDefinition?.autoIncrementAttributeName === this.model.primaryKeyAttribute
        ) {
          // ONLY TRUE IF @auto_increment_increment is set to 1 !!
          // Doesn't work with GALERA => each node will reserve increment (x for first server, x+1 for next node...)
          const startId = data[this.getInsertIdField()];
          result = Array.from({ length: data.affectedRows });
          const pkColumnName = modelDefinition.attributes.get(
            this.model.primaryKeyAttribute,
          ).columnName;
          for (let i = 0n; i < data.affectedRows; i++) {
            result[i] = { [pkColumnName]: startId + i };
          }

          return [result, data.affectedRows];
        }

        return [data[this.getInsertIdField()], data.affectedRows];
      }
    }

    if (this.isSelectQuery()) {
      this.handleJsonSelectQuery(data);

      return this.handleSelectQuery(data);
    }

    if (this.isInsertQuery() || this.isUpdateQuery()) {
      return [result, data.affectedRows];
    }

    if (this.isCallQuery()) {
      return data[0];
    }

    if (this.isRawQuery()) {
      const meta = data.meta;

      return [data, meta];
    }

    if (this.isShowIndexesQuery()) {
      return this.handleShowIndexesQuery(data);
    }

    if (this.isShowConstraintsQuery()) {
      return data;
    }

    if (this.isDescribeQuery()) {
      result = {};

      for (const _result of data) {
        result[_result.Field] = {
          type: _result.Type.toLowerCase().startsWith('enum')
            ? _result.Type.replace(/^enum/i, 'ENUM')
            : _result.Type.toUpperCase(),
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

    return result;
  }

  handleJsonSelectQuery(rows) {
    if (!this.model || !this.model.fieldRawAttributesMap) {
      return;
    }

    const meta = rows.meta;
    for (const [i, _field] of Object.keys(this.model.fieldRawAttributesMap).entries()) {
      const modelField = this.model.fieldRawAttributesMap[_field];
      if (modelField.type instanceof DataTypes.JSON) {
        // Value is returned as String, not JSON
        rows = rows.map(row => {
          // JSON fields for MariaDB server 10.5.2+ already results in JSON format so we can skip JSON.parse
          // In this case the column type field will be MYSQL_TYPE_STRING, but the extended type will indicate 'json'
          if (
            row[modelField.fieldName] &&
            typeof row[modelField.fieldName] === 'string' &&
            (!meta[i] || meta[i].dataTypeFormat !== 'json')
          ) {
            row[modelField.fieldName] = JSON.parse(row[modelField.fieldName]);
          }

          if (DataTypes.JSON.parse) {
            return DataTypes.JSON.parse(
              modelField,
              this.sequelize.options,
              row[modelField.fieldName],
            );
          }

          return row;
        });
      }
    }
  }

  formatError(err) {
    switch (err.errno) {
      case ER_DUP_ENTRY: {
        const match = err.message.match(/Duplicate entry '([\S\s]*)' for key '?([^']*?)'?\s.*$/);

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
          reltype: err.errno === ER_ROW_IS_REFERENCED ? 'parent' : 'child',
          table: match ? match[4] : undefined,
          fields,
          value:
            (fields && fields.length && this.instance && this.instance[fields[0]]) || undefined,
          index: match ? match[2] : undefined,
          cause: err,
        });
      }

      case ER_CANT_DROP_FIELD_OR_KEY: {
        const constraintMatch = err.sql.match(/(?:constraint|index) `(.+?)`/i);
        const constraint = constraintMatch ? constraintMatch[1] : undefined;
        const tableMatch = err.sql.match(/table `(.+?)`/i);
        const table = tableMatch ? tableMatch[1] : undefined;

        return new UnknownConstraintError({
          message: err.text,
          constraint,
          table,
          cause: err,
        });
      }

      default:
        return new DatabaseError(err);
    }
  }

  handleShowIndexesQuery(data) {
    let currItem;
    const result = [];

    for (const item of data) {
      if (!currItem || currItem.name !== item.Key_name) {
        currItem = {
          primary: item.Key_name === 'PRIMARY',
          fields: [],
          name: item.Key_name,
          tableName: item.Table,
          unique: item.Non_unique !== '1',
          type: item.Index_type,
        };
        result.push(currItem);
      }

      currItem.fields[item.Seq_in_index - 1] = {
        attribute: item.Column_name,
        length: item.Sub_part || undefined,
        order:
          item.Collation === 'A'
            ? 'ASC'
            : item.Collation === 'D'
              ? 'DESC'
              : // Not sorted
                item.Collation === null
                ? null
                : (() => {
                    throw new Error(`Unknown index collation ${inspect(item.Collation)}`);
                  })(),
      };
    }

    return result;
  }
}
