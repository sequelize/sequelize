'use strict';

const AbstractQuery = require('../abstract/query');
const QueryTypes = require('../../query-types');
const Promise = require('../../promise');
const sequelizeErrors = require('../../errors');
const _ = require('lodash');
const { logger } = require('../../utils/logger');

const debug = logger.debugContext('sql:pg');


class Query extends AbstractQuery {
  /**
   * Rewrite query with parameters.
   *
   * @param {string} sql
   * @param {Array|Object} values
   * @param {string} dialect
   * @private
   */
  static formatBindParameters(sql, values, dialect) {
    const stringReplaceFunc = value => typeof value === 'string' ? value.replace(/\0/g, '\\0') : value;

    let bindParam;
    if (Array.isArray(values)) {
      bindParam = values.map(stringReplaceFunc);
      sql = AbstractQuery.formatBindParameters(sql, values, dialect, { skipValueReplace: true })[0];
    } else {
      bindParam = [];
      let i = 0;
      const seen = {};
      const replacementFunc = (match, key, values) => {
        if (seen[key] !== undefined) {
          return seen[key];
        }
        if (values[key] !== undefined) {
          i = i + 1;
          bindParam.push(stringReplaceFunc(values[key]));
          seen[key] = `$${i}`;
          return `$${i}`;
        }
        return undefined;
      };
      sql = AbstractQuery.formatBindParameters(sql, values, dialect, replacementFunc)[0];
    }
    return [sql, bindParam];
  }

  run(sql, parameters) {
    const { connection } = this;

    if (!_.isEmpty(this.options.searchPath)) {
      sql = this.sequelize.getQueryInterface().QueryGenerator.setSearchPath(this.options.searchPath) + sql;
    }
    this.sql = sql;

    const query = parameters && parameters.length
      ? new Promise((resolve, reject) => connection.query(sql, parameters, (error, result) => error ? reject(error) : resolve(result)))
      : new Promise((resolve, reject) => connection.query(sql, (error, result) => error ? reject(error) : resolve(result)));

    const complete = this._logQuery(sql, debug);

    return query.catch(err => {
      // set the client so that it will be reaped if the connection resets while executing
      if (err.code === 'ECONNRESET') {
        connection._invalid = true;
      }

      err.sql = sql;
      err.parameters = parameters;
      throw this.formatError(err);
    })
      .then(queryResult => {
        complete();

        let rows = Array.isArray(queryResult)
          ? queryResult.reduce((allRows, r) => allRows.concat(r.rows || []), [])
          : queryResult.rows;
        const rowCount = Array.isArray(queryResult)
          ? queryResult.reduce(
            (count, r) => Number.isFinite(r.rowCount) ? count + r.rowCount : count,
            0
          )
          : queryResult.rowCount;

        if (this.sequelize.options.minifyAliases && this.options.aliasesMapping) {
          rows = rows
            .map(row => _.toPairs(row)
              .reduce((acc, [key, value]) => {
                const mapping = this.options.aliasesMapping.get(key);
                acc[mapping || key] = value;
                return acc;
              }, {})
            );
        }

        const isTableNameQuery = sql.startsWith('SELECT table_name FROM information_schema.tables');
        const isRelNameQuery = sql.startsWith('SELECT relname FROM pg_class WHERE oid IN');

        if (isRelNameQuery) {
          return rows.map(row => ({
            name: row.relname,
            tableName: row.relname.split('_')[0]
          }));
        }
        if (isTableNameQuery) {
          return rows.map(row => _.values(row));
        }

        if (rows[0] && rows[0].sequelize_caught_exception !== undefined) {
          if (rows[0].sequelize_caught_exception !== null) {
            throw this.formatError({
              code: '23505',
              detail: rows[0].sequelize_caught_exception
            });
          }
          for (const row of rows) {
            delete row.sequelize_caught_exception;
          }
        }

        if (this.isShowIndexesQuery()) {
          for (const row of rows) {
            const attributes = /ON .*? (?:USING .*?\s)?\(([^]*)\)/gi.exec(row.definition)[1].split(',');

            // Map column index in table to column name
            const columns = _.zipObject(
              row.column_indexes,
              this.sequelize.getQueryInterface().QueryGenerator.fromArray(row.column_names)
            );
            delete row.column_indexes;
            delete row.column_names;

            let field;
            let attribute;

            // Indkey is the order of attributes in the index, specified by a string of attribute indexes
            row.fields = row.indkey.split(' ').map((indKey, index) => {
              field = columns[indKey];
              // for functional indices indKey = 0
              if (!field) {
                return null;
              }
              attribute = attributes[index];
              return {
                attribute: field,
                collate: attribute.match(/COLLATE "(.*?)"/) ? /COLLATE "(.*?)"/.exec(attribute)[1] : undefined,
                order: attribute.includes('DESC') ? 'DESC' : attribute.includes('ASC') ? 'ASC' : undefined,
                length: undefined
              };
            }).filter(n => n !== null);
            delete row.columns;
          }
          return rows;
        }
        if (this.isForeignKeysQuery()) {
          const result = [];
          for (const row of rows) {
            let defParts;
            if (row.condef !== undefined && (defParts = row.condef.match(/FOREIGN KEY \((.+)\) REFERENCES (.+)\((.+)\)( ON (UPDATE|DELETE) (CASCADE|RESTRICT))?( ON (UPDATE|DELETE) (CASCADE|RESTRICT))?/))) {
              row.id = row.constraint_name;
              row.table = defParts[2];
              row.from = defParts[1];
              row.to = defParts[3];
              let i;
              for (i = 5; i <= 8; i += 3) {
                if (/(UPDATE|DELETE)/.test(defParts[i])) {
                  row[`on_${defParts[i].toLowerCase()}`] = defParts[i + 1];
                }
              }
            }
            result.push(row);
          }
          return result;
        }
        if (this.isSelectQuery()) {
          let result = rows;
          // Postgres will treat tables as case-insensitive, so fix the case
          // of the returned values to match attributes
          if (this.options.raw === false && this.sequelize.options.quoteIdentifiers === false) {
            const attrsMap = _.reduce(this.model.rawAttributes, (m, v, k) => {
              m[k.toLowerCase()] = k;
              return m;
            }, {});
            result = rows.map(row => {
              return _.mapKeys(row, (value, key) => {
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
              special: row.special ? this.sequelize.getQueryInterface().QueryGenerator.fromArray(row.special) : [],
              primaryKey: row.Constraint === 'PRIMARY KEY'
            };

            if (result[row.Field].type === 'BOOLEAN') {
              result[row.Field].defaultValue = { 'false': false, 'true': true }[result[row.Field].defaultValue];

              if (result[row.Field].defaultValue === undefined) {
                result[row.Field].defaultValue = null;
              }
            }

            if (typeof result[row.Field].defaultValue === 'string') {
              result[row.Field].defaultValue = result[row.Field].defaultValue.replace(/'/g, '');

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
        if (this.isVersionQuery()) {
          return rows[0].server_version;
        }
        if (this.isShowOrDescribeQuery()) {
          return rows;
        }
        if (QueryTypes.BULKUPDATE === this.options.type) {
          if (!this.options.returning) {
            return parseInt(rowCount, 10);
          }
          return this.handleSelectQuery(rows);
        }
        if (QueryTypes.BULKDELETE === this.options.type) {
          return parseInt(rowCount, 10);
        }
        if (this.isUpsertQuery()) {
          return rows[0];
        }
        if (this.isInsertQuery() || this.isUpdateQuery()) {
          if (this.instance && this.instance.dataValues) {
            for (const key in rows[0]) {
              if (Object.prototype.hasOwnProperty.call(rows[0], key)) {
                const record = rows[0][key];

                const attr = _.find(this.model.rawAttributes, attribute => attribute.fieldName === key || attribute.field === key);

                this.instance.dataValues[attr && attr.fieldName || key] = record;
              }
            }
          }

          return [
            this.instance || rows && (this.options.plain && rows[0] || rows) || undefined,
            rowCount
          ];
        }
        if (this.isRawQuery()) {
          return [rows, queryResult];
        }
        return rows;
      });
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

        return new sequelizeErrors.ForeignKeyConstraintError({ message: errMessage, fields: null, index, table, parent: err });
      case '23505':
        // there are multiple different formats of error messages for this error code
        // this regex should check at least two
        if (errDetail && (match = errDetail.replace(/"/g, '').match(/Key \((.*?)\)=\((.*?)\)/))) {
          fields = _.zipObject(match[1].split(', '), match[2].split(', '));
          errors = [];
          message = 'Validation error';

          _.forOwn(fields, (value, field) => {
            errors.push(new sequelizeErrors.ValidationErrorItem(
              this.getUniqueConstraintErrorMessage(field),
              'unique violation', // sequelizeErrors.ValidationErrorItem.Origins.DB,
              field,
              value,
              this.instance,
              'not_unique'
            ));
          });

          if (this.model && this.model.uniqueKeys) {
            _.forOwn(this.model.uniqueKeys, constraint => {
              if (_.isEqual(constraint.fields, Object.keys(fields)) && !!constraint.msg) {
                message = constraint.msg;
                return false;
              }
            });
          }

          return new sequelizeErrors.UniqueConstraintError({ message, errors, parent: err, fields });
        }

        return new sequelizeErrors.UniqueConstraintError({
          message: errMessage,
          parent: err
        });

      case '23P01':
        match = errDetail.match(/Key \((.*?)\)=\((.*?)\)/);

        if (match) {
          fields = _.zipObject(match[1].split(', '), match[2].split(', '));
        }
        message = 'Exclusion constraint error';

        return new sequelizeErrors.ExclusionConstraintError({
          message,
          constraint: err.constraint,
          fields,
          table: err.table,
          parent: err
        });

      case '42704':
        if (err.sql && /(CONSTRAINT|INDEX)/gi.test(err.sql)) {
          message = 'Unknown constraint error';
          index = errMessage.match(/(?:constraint|index) "(.+?)"/i);
          index = index ? index[1] : undefined;
          table = errMessage.match(/relation "(.+?)"/i);
          table = table ? table[1] : undefined;

          throw new sequelizeErrors.UnknownConstraintError({
            message,
            constraint: index,
            fields,
            table,
            parent: err
          });
        }
      // falls through
      default:
        return new sequelizeErrors.DatabaseError(err);
    }
  }

  isForeignKeysQuery() {
    return /SELECT conname as constraint_name, pg_catalog\.pg_get_constraintdef\(r\.oid, true\) as condef FROM pg_catalog\.pg_constraint r WHERE r\.conrelid = \(SELECT oid FROM pg_class WHERE relname = '.*' LIMIT 1\) AND r\.contype = 'f' ORDER BY 1;/.test(this.sql);
  }

  getInsertIdField() {
    return 'id';
  }
}


module.exports = Query;
module.exports.Query = Query;
module.exports.default = Query;
