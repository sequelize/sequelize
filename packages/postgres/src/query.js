'use strict';

import {
  AbstractQuery,
  DatabaseError,
  EmptyResultError,
  ExclusionConstraintError,
  ForeignKeyConstraintError,
  QueryTypes,
  UniqueConstraintError,
  UnknownConstraintError,
  ValidationErrorItem,
} from '@sequelize/core';
import { logger } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/logger.js';
import escapeRegExp from 'lodash/escapeRegExp';
import forOwn from 'lodash/forOwn';
import isEmpty from 'lodash/isEmpty';
import isEqual from 'lodash/isEqual';
import mapKeys from 'lodash/mapKeys';
import toPairs from 'lodash/toPairs';
import zipObject from 'lodash/zipObject';

const debug = logger.debugContext('sql:pg');

export class PostgresQuery extends AbstractQuery {
  async run(sql, parameters, options) {
    const { connection } = this;

    if (!isEmpty(this.options.searchPath)) {
      sql = this.sequelize.queryGenerator.setSearchPath(this.options.searchPath) + sql;
    }

    if (options?.minifyAliases && this.options.includeAliases) {
      for (const [alias, original] of toPairs(this.options.includeAliases)
        // Sorting to replace the longest aliases first to prevent alias collision
        .sort((a, b) => b[1].length - a[1].length)) {
        const reg = new RegExp(escapeRegExp(original), 'g');

        sql = sql.replace(reg, alias);
      }
    }

    this.sql = sql;

    const query = new Promise((resolve, reject) => {
      if (parameters && parameters.length > 0) {
        connection.query(sql, parameters, (error, result) => {
          error ? reject(error) : resolve(result);
        });
      } else {
        connection.query(sql, (error, result) => (error ? reject(error) : resolve(result)));
      }
    });

    const complete = this._logQuery(sql, debug, parameters);

    let queryResult;

    try {
      queryResult = await query;
    } catch (error) {
      // set the client so that it will be reaped if the connection resets while executing
      if (
        error.code === 'ECONNRESET' ||
        // https://github.com/sequelize/sequelize/pull/14090
        // pg-native throws custom exception or libpq formatted errors
        /Unable to set non-blocking to true/i.test(error) ||
        /SSL SYSCALL error: EOF detected/i.test(error) ||
        /Local: Authentication failure/i.test(error) ||
        // https://github.com/sequelize/sequelize/pull/15144
        error.message === 'Query read timeout'
      ) {
        connection._invalid = true;
      }

      error.sql = sql;
      error.parameters = parameters;
      throw this.formatError(error);
    }

    complete();

    let rows = Array.isArray(queryResult)
      ? queryResult.reduce((allRows, r) => allRows.concat(r.rows || []), [])
      : queryResult.rows;
    const rowCount = Array.isArray(queryResult)
      ? queryResult.reduce(
          (count, r) => (Number.isFinite(r.rowCount) ? count + r.rowCount : count),
          0,
        )
      : queryResult.rowCount || 0;

    if (options?.minifyAliases && this.options.aliasesMapping) {
      rows = rows.map(row =>
        toPairs(row).reduce((acc, [key, value]) => {
          const mapping = this.options.aliasesMapping.get(key);
          acc[mapping || key] = value;

          return acc;
        }, {}),
      );
    }

    const isTableNameQuery = sql.startsWith('SELECT table_name FROM information_schema.tables');
    const isRelNameQuery = sql.startsWith('SELECT relname FROM pg_class WHERE oid IN');

    if (isRelNameQuery) {
      return rows.map(row => ({
        name: row.relname,
        tableName: row.relname.split('_')[0],
      }));
    }

    if (isTableNameQuery) {
      return rows.map(row => Object.values(row));
    }

    if (rows[0] && rows[0].sequelize_caught_exception !== undefined) {
      if (rows[0].sequelize_caught_exception !== null) {
        throw this.formatError({
          sql,
          parameters,
          code: '23505',
          detail: rows[0].sequelize_caught_exception,
        });
      }

      for (const row of rows) {
        delete row.sequelize_caught_exception;
      }
    }

    if (this.isShowIndexesQuery()) {
      for (const row of rows) {
        let attributes;
        if (/include \(([^]*)\)/gi.test(row.definition)) {
          attributes = /on .*? (?:using .*?\s)?\(([^]*)\) include \(([^]*)\)/gi
            .exec(row.definition)[1]
            .split(',');
        } else {
          attributes = /on .*? (?:using .*?\s)?\(([^]*)\)/gi.exec(row.definition)[1].split(',');
        }

        // Map column index in table to column name
        const columns = zipObject(
          row.column_indexes,
          this.sequelize.queryGenerator.fromArray(row.column_names),
        );
        delete row.column_indexes;
        delete row.column_names;

        let field;
        let attribute;

        // Indkey is the order of attributes in the index, specified by a string of attribute indexes
        row.fields = row.index_fields
          .map((indKey, index) => {
            field = columns[indKey];
            // for functional indices indKey = 0
            if (!field) {
              return null;
            }

            attribute = attributes[index];

            return {
              attribute: field,
              collate: /COLLATE "(.*?)"/.test(attribute)
                ? /COLLATE "(.*?)"/.exec(attribute)[1]
                : undefined,
              order: attribute.includes('DESC')
                ? 'DESC'
                : attribute.includes('ASC')
                  ? 'ASC'
                  : undefined,
              length: undefined,
            };
          })
          .filter(n => n !== null);

        row.includes = row.include_fields
          .map(indKey => {
            field = columns[indKey];
            // for functional indices indKey = 0
            if (!field) {
              return null;
            }

            return field;
          })
          .filter(n => n !== null);
        delete row.columns;
        delete row.definition;
        delete row.index_fields;
        delete row.include_fields;
      }

      return rows;
    }

    if (this.isSelectQuery()) {
      let result = rows;
      // Postgres will treat tables as case-insensitive, so fix the case
      // of the returned values to match attributes
      // TODO [>7]: remove this.sequelize.options.quoteIdentifiers === false
      if (this.options.raw === false && this.sequelize.options.quoteIdentifiers === false) {
        const attrsMap = Object.create(null);

        for (const attrName of this.model.modelDefinition.attributes.keys()) {
          attrsMap[attrName.toLowerCase()] = attrName;
        }

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

      return this.handleSelectQuery(result);
    }

    if (QueryTypes.DESCRIBE === this.options.type) {
      const result = {};

      for (const row of rows) {
        result[row.Field] = {
          type: row.Type.toUpperCase(),
          allowNull: row.Null === 'YES',
          defaultValue: row.Default,
          comment: row.Comment,
          special: row.special ? this.sequelize.queryGenerator.fromArray(row.special) : [],
          primaryKey: row.Constraint === 'PRIMARY KEY',
        };

        if (result[row.Field].type === 'BOOLEAN') {
          result[row.Field].defaultValue = { false: false, true: true }[
            result[row.Field].defaultValue
          ];

          if (result[row.Field].defaultValue === undefined) {
            result[row.Field].defaultValue = null;
          }
        }

        if (typeof result[row.Field].defaultValue === 'string') {
          result[row.Field].defaultValue = result[row.Field].defaultValue.replaceAll("'", '');

          if (result[row.Field].defaultValue.includes('::')) {
            const split = result[row.Field].defaultValue.split('::');
            if (split[1].toLowerCase() !== 'regclass)') {
              result[row.Field].defaultValue = split[0];
            }
          }
        }
      }

      return result;
    }

    if (this.isShowOrDescribeQuery()) {
      return rows;
    }

    if (QueryTypes.BULKUPDATE === this.options.type) {
      if (!this.options.returning) {
        return Number.parseInt(rowCount, 10);
      }

      return this.handleSelectQuery(rows);
    }

    if (this.isDeleteQuery()) {
      return Number.parseInt(rowCount, 10);
    }

    if (this.isInsertQuery() || this.isUpdateQuery() || this.isUpsertQuery()) {
      if (this.instance && this.instance.dataValues) {
        // If we are creating an instance, and we get no rows, the create failed but did not throw.
        // This probably means a conflict happened and was ignored, to avoid breaking a transaction.
        if (this.isInsertQuery() && !this.isUpsertQuery() && rowCount === 0) {
          throw new EmptyResultError();
        }

        if (Array.isArray(rows) && rows[0]) {
          for (const attributeOrColumnName of Object.keys(rows[0])) {
            const modelDefinition = this.model.modelDefinition;
            const attribute = modelDefinition.columns.get(attributeOrColumnName);
            const updatedValue = this._parseDatabaseValue(
              rows[0][attributeOrColumnName],
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
        this.instance || (rows && ((this.options.plain && rows[0]) || rows)) || undefined,
        rowCount,
      ];
    }

    if (this.isShowConstraintsQuery()) {
      return rows;
    }

    if (this.isRawQuery()) {
      return [rows, queryResult];
    }

    return rows;
  }

  formatError(err) {
    let match;
    let table;
    let index;
    let fields;
    let errors;
    let message;

    const code = err.code || err.sqlState;
    const errMessage = err.message || err.messagePrimary;
    const errDetail = err.detail || err.messageDetail;

    switch (code) {
      case '23503':
        index = errMessage.match(/violates foreign key constraint "(.+?)"/);
        index = index ? index[1] : undefined;
        table = errMessage.match(/on table "(.+?)"/);
        table = table ? table[1] : undefined;

        return new ForeignKeyConstraintError({
          message: errMessage,
          fields: null,
          index,
          table,
          cause: err,
        });
      case '23505':
        // there are multiple different formats of error messages for this error code
        // this regex should check at least two
        if (errDetail && (match = errDetail.replaceAll('"', '').match(/Key \((.*?)\)=\((.*?)\)/))) {
          fields = zipObject(match[1].split(', '), match[2].split(', '));
          errors = [];
          message = 'Validation error';

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

          if (this.model) {
            for (const index of this.model.getIndexes()) {
              if (index.unique && isEqual(index.fields, Object.keys(fields)) && index.msg) {
                message = index.msg;
                break;
              }
            }
          }

          return new UniqueConstraintError({ message, errors, cause: err, fields });
        }

        return new UniqueConstraintError({
          message: errMessage,
          cause: err,
        });

      case '23P01':
        match = errDetail.match(/Key \((.*?)\)=\((.*?)\)/);

        if (match) {
          fields = zipObject(match[1].split(', '), match[2].split(', '));
        }

        message = 'Exclusion constraint error';

        return new ExclusionConstraintError({
          message,
          constraint: err.constraint,
          fields,
          table: err.table,
          cause: err,
        });

      case '42704':
        if (err.sql && /(constraint|index)/gi.test(err.sql)) {
          message = 'Unknown constraint error';
          index = errMessage.match(/(?:constraint|index) "(.+?)"/i);
          index = index ? index[1] : undefined;
          table = errMessage.match(/relation "(.+?)"/i);
          table = table ? table[1] : undefined;

          throw new UnknownConstraintError({
            message,
            constraint: index,
            fields,
            table,
            cause: err,
          });
        }

      // falls through
      default:
        return new DatabaseError(err);
    }
  }

  getInsertIdField() {
    return 'id';
  }
}
