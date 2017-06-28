'use strict';

const Utils = require('../../utils');
const debug = Utils.getLogger().debugContext('sql:pg');
const AbstractQuery = require('../abstract/query');
const QueryTypes = require('../../query-types');
const Promise = require('../../promise');
const sequelizeErrors = require('../../errors.js');
const _ = require('lodash');

class Query extends AbstractQuery {
  constructor(client, sequelize, options) {
    super();
    this.client = client;
    this.sequelize = sequelize;
    this.instance = options.instance;
    this.model = options.model;
    this.options = _.extend({
      logging: console.log,
      plain: false,
      raw: false
    }, options || {});

    this.checkLoggingOption();
  }

  /**
   * rewrite query with parameters
   * @private
   */
  static formatBindParameters(sql, values, dialect) {
    let bindParam = [];
    if (Array.isArray(values)) {
      bindParam = values;
      sql = AbstractQuery.formatBindParameters(sql, values, dialect, { skipValueReplace: true })[0];
    } else {
      let i = 0;
      const seen = {};
      const replacementFunc = (match, key, values) => {
        if (seen[key] !== undefined) {
          return seen[key];
        }
        if (values[key] !== undefined) {
          i = i + 1;
          bindParam.push(values[key]);
          seen[key] = '$'+i;
          return '$'+i;
        }
        return undefined;
      };
      sql = AbstractQuery.formatBindParameters(sql, values, dialect, replacementFunc)[0];
    }
    return [sql, bindParam];
  }

  run(sql, parameters) {
    this.sql = sql;

    if (!_.isEmpty(this.options.searchPath)) {
      this.sql = this.sequelize.getQueryInterface().QueryGenerator.setSearchPath(this.options.searchPath) + sql;
    }

    const query = parameters && parameters.length
      ? new Promise((resolve, reject) => this.client.query(this.sql, parameters, (error, result) => error ? reject(error) : resolve(result)))
      : new Promise((resolve, reject) => this.client.query(this.sql, (error, result) => error ? reject(error) : resolve(result)));

    //do we need benchmark for this query execution
    const benchmark = this.sequelize.options.benchmark || this.options.benchmark;

    let queryBegin;
    if (benchmark) {
      queryBegin = Date.now();
    } else {
      this.sequelize.log('Executing (' + (this.client.uuid || 'default') + '): ' + this.sql, this.options);
    }

    debug(`executing(${this.client.uuid || 'default'}) : ${this.sql}`);

    return query.catch(err => {
      // set the client so that it will be reaped if the connection resets while executing
      if (err.code === 'ECONNRESET') {
        this.client._invalid = true;
      }

      err.sql = sql;
      throw this.formatError(err);
    })
      .then(queryResult => {
        debug(`executed(${this.client.uuid || 'default'}) : ${this.sql}`);

        if (benchmark) {
          this.sequelize.log('Executed (' + (this.client.uuid || 'default') + '): ' + this.sql, Date.now() - queryBegin, this.options);
        }

        return queryResult;
      })
      .then(queryResult => {
        const rows = queryResult.rows;
        const rowCount = queryResult.rowCount;
        const isTableNameQuery = sql.indexOf('SELECT table_name FROM information_schema.tables') === 0;
        const isRelNameQuery = sql.indexOf('SELECT relname FROM pg_class WHERE oid IN') === 0;

        if (isRelNameQuery) {
          return rows.map(row => ({
            name: row.relname,
            tableName: row.relname.split('_')[0]
          }));
        } else if (isTableNameQuery) {
          return rows.map(row => _.values(row));
        }

        if (rows[0] && rows[0].sequelize_caught_exception !== undefined) {
          if (rows[0].sequelize_caught_exception !== null) {
            throw this.formatError({
              code: '23505',
              detail: rows[0].sequelize_caught_exception
            });
          } else {
            for (const row of rows) {
              delete row.sequelize_caught_exception;
            }
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
                order: attribute.indexOf('DESC') !== -1 ? 'DESC' : attribute.indexOf('ASC') !== -1 ? 'ASC': undefined,
                length: undefined
              };
            }).filter(n => n !== null);
            delete row.columns;
          }
          return rows;
        } else if (this.isForeignKeysQuery()) {
          const result = [];
          for (const row of rows) {
            let defParts;
            if (row.condef !== undefined && (defParts = row.condef.match(/FOREIGN KEY \((.+)\) REFERENCES (.+)\((.+)\)( ON (UPDATE|DELETE) (CASCADE|RESTRICT))?( ON (UPDATE|DELETE) (CASCADE|RESTRICT))?/))) {
              row.id = row.constraint_name;
              row.table = defParts[2];
              row.from = defParts[1];
              row.to = defParts[3];
              let i;
              for (i=5;i<=8;i+=3) {
                if (/(UPDATE|DELETE)/.test(defParts[i])) {
                  row['on_'+defParts[i].toLowerCase()] = defParts[i+1];
                }
              }
            }
            result.push(row);
          }
          return result;
        } else if (this.isSelectQuery()) {
          let result = rows;
          // Postgres will treat tables as case-insensitive, so fix the case
          // of the returned values to match attributes
          if (this.options.raw === false && this.sequelize.options.quoteIdentifiers === false) {
            const attrsMap = _.reduce(this.model.rawAttributes, (m, v, k) => {
              m[k.toLowerCase()] = k;
              return m;
            }, {});
            result = _.map(rows, row=> {
              return _.mapKeys(row, (value, key)=> {
                const targetAttr = attrsMap[key];
                if (typeof targetAttr === 'string' && targetAttr !== key) {
                  return targetAttr;
                } else {
                  return key;
                }
              });
            });
          }
          return this.handleSelectQuery(result);
        } else if (QueryTypes.DESCRIBE === this.options.type) {
          const result = {};

          for (const row of rows) {
            result[row.Field] = {
              type: row.Type.toUpperCase(),
              allowNull: row.Null === 'YES',
              defaultValue: row.Default,
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

              if (result[row.Field].defaultValue.indexOf('::') > -1) {
                const split = result[row.Field].defaultValue.split('::');
                if (split[1].toLowerCase() !== 'regclass)') {
                  result[row.Field].defaultValue = split[0];
                }
              }
            }
          }

          return result;
        } else if (this.isVersionQuery()) {
          return rows[0].server_version;
        } else if (this.isShowOrDescribeQuery()) {
          return rows;
        } else if (QueryTypes.BULKUPDATE === this.options.type) {
          if (!this.options.returning) {
            return parseInt(rowCount, 10);
          }

          return this.handleSelectQuery(rows);
        } else if (QueryTypes.BULKDELETE === this.options.type) {
          return parseInt(rowCount, 10);
        } else if (this.isUpsertQuery()) {
          return rows[0].sequelize_upsert;
        } else if (this.isInsertQuery() || this.isUpdateQuery()) {
          if (this.instance && this.instance.dataValues) {
            for (const key in rows[0]) {
              if (rows[0].hasOwnProperty(key)) {
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
        } else if (this.isRawQuery()) {
          return [rows, queryResult];
        } else {
          return rows;
        }
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
        index = errMessage.match(/violates foreign key constraint \"(.+?)\"/);
        index = index ? index[1] : undefined;
        table = errMessage.match(/on table \"(.+?)\"/);
        table = table ? table[1] : undefined;

        return new sequelizeErrors.ForeignKeyConstraintError({message: errMessage, fields: null, index, table, parent: err});
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

          return new sequelizeErrors.UniqueConstraintError({message, errors, parent: err, fields});
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
        if (err.sql && /CONSTRAINT/gi.test(err.sql)) {
          message = 'Unknown constraint error';

          throw new sequelizeErrors.UnknownConstraintError({
            message,
            constraint: err.constraint,
            fields,
            table: err.table,
            parent: err
          });
        }

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
