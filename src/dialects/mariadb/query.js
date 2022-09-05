'use strict';

const AbstractQuery = require('../abstract/query');
const sequelizeErrors = require('../../errors');
const _ = require('lodash');
const DataTypes = require('../../data-types');
const { logger } = require('../../utils/logger');

const ER_DUP_ENTRY = 1062;
const ER_DEADLOCK = 1213;
const ER_ROW_IS_REFERENCED = 1451;
const ER_NO_REFERENCED_ROW = 1452;

const debug = logger.debugContext('sql:mariadb');

class Query extends AbstractQuery {
  constructor(connection, sequelize, options) {
    super(connection, sequelize, { showWarnings: false, ...options });
  }

  static formatBindParameters(sql, values, dialect) {
    const bindParam = [];
    const replacementFunc = (match, key, values_) => {
      if (values_[key] !== undefined) {
        bindParam.push(values_[key]);
        return '?';
      }
      return undefined;
    };
    sql = AbstractQuery.formatBindParameters(sql, values, dialect, replacementFunc)[0];
    return [sql, bindParam.length > 0 ? bindParam : undefined];
  }

  async run(sql, parameters) {
    this.sql = sql;
    const { connection, options } = this;

    const showWarnings = this.sequelize.options.showWarnings || options.showWarnings;

    const complete = this._logQuery(sql, debug, parameters);

    if (parameters) {
      debug('parameters(%j)', parameters);
    }

    let results;
    const errForStack = new Error();

    try {
      results = await connection.query(this.sql, parameters);
    } catch (error) {
      if (options.transaction && error.errno === ER_DEADLOCK) {
        // MariaDB automatically rolls-back transactions in the event of a deadlock.
        // However, we still initiate a manual rollback to ensure the connection gets released - see #13102.
        try {
          await options.transaction.rollback();
        } catch (error_) {
          // Ignore errors - since MariaDB automatically rolled back, we're
          // not that worried about this redundant rollback failing.
        }

        options.transaction.finished = 'rollback';
      }

      error.sql = sql;
      error.parameters = parameters;
      throw this.formatError(error, errForStack.stack);
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

    if (this.isBulkUpdateQuery() || this.isBulkDeleteQuery()) {
      return data.affectedRows;
    }
    if (this.isUpsertQuery()) {
      return [result, data.affectedRows === 1];
    }
    if (this.isInsertQuery(data)) {
      this.handleInsertQuery(data);

      if (!this.instance) {
        // handle bulkCreate AI primary key
        if (
          this.model
          && this.model.autoIncrementAttribute
          && this.model.autoIncrementAttribute === this.model.primaryKeyAttribute
          && this.model.rawAttributes[this.model.primaryKeyAttribute]
        ) {
          // ONLY TRUE IF @auto_increment_increment is set to 1 !!
          // Doesn't work with GALERA => each node will reserve increment (x for first server, x+1 for next node...)
          const startId = data[this.getInsertIdField()];
          result = new Array(data.affectedRows);
          const pkField = this.model.rawAttributes[this.model.primaryKeyAttribute].field;
          for (let i = 0; i < data.affectedRows; i++) {
            result[i] = { [pkField]: startId + i };
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
      delete data.meta;
      return [data, meta];
    }
    if (this.isShowIndexesQuery()) {
      return this.handleShowIndexesQuery(data);
    }
    if (this.isForeignKeysQuery() || this.isShowConstraintsQuery()) {
      return data;
    }
    if (this.isShowTablesQuery()) {
      return this.handleShowTablesQuery(data);
    }
    if (this.isDescribeQuery()) {
      result = {};

      for (const _result of data) {
        result[_result.Field] = {
          type: _result.Type.toLowerCase().startsWith('enum') ? _result.Type.replace(/^enum/i,
            'ENUM') : _result.Type.toUpperCase(),
          allowNull: _result.Null === 'YES',
          defaultValue: _result.Default,
          primaryKey: _result.Key === 'PRI',
          autoIncrement: Object.prototype.hasOwnProperty.call(_result, 'Extra')
            && _result.Extra.toLowerCase() === 'auto_increment',
          comment: _result.Comment ? _result.Comment : null
        };
      }
      return result;
    }
    if (this.isVersionQuery()) {
      return data[0].version;
    }

    return result;
  }

  handleJsonSelectQuery(rows) {
    if (!this.model || !this.model.fieldRawAttributesMap) {
      return;
    }
    for (const _field of Object.keys(this.model.fieldRawAttributesMap)) {
      const modelField = this.model.fieldRawAttributesMap[_field];
      if (modelField.type instanceof DataTypes.JSON) {
        // Value is returned as String, not JSON
        rows = rows.map(row => {
          // JSON fields for MariaDB server 10.5.2+ already results in JSON format, skip JSON.parse
          // this is due to this https://jira.mariadb.org/browse/MDEV-17832 and how mysql2 connector interacts with MariaDB and JSON fields
          if (row[modelField.fieldName] && typeof row[modelField.fieldName] === 'string' && !this.connection.info.hasMinVersion(10, 5, 2)) {
            row[modelField.fieldName] = JSON.parse(row[modelField.fieldName]);
          }
          if (DataTypes.JSON.parse) {
            return DataTypes.JSON.parse(modelField, this.sequelize.options,
              row[modelField.fieldName]);
          }
          return row;
        });
      }
    }
  }

  async logWarnings(results) {
    const warningResults = await this.run('SHOW WARNINGS');
    const warningMessage = `MariaDB Warnings (${this.connection.uuid || 'default'}): `;
    const messages = [];
    for (const _warningRow of warningResults) {
      if (_warningRow === undefined || typeof _warningRow[Symbol.iterator] !== 'function') {
        continue;
      }
      for (const _warningResult of _warningRow) {
        if (Object.prototype.hasOwnProperty.call(_warningResult, 'Message')) {
          messages.push(_warningResult.Message);
        } else {
          for (const _objectKey of _warningResult.keys()) {
            messages.push([_objectKey, _warningResult[_objectKey]].join(': '));
          }
        }
      }
    }

    this.sequelize.log(warningMessage + messages.join('; '), this.options);

    return results;
  }

  formatError(err, errStack) {
    switch (err.errno) {
      case ER_DUP_ENTRY: {
        const match = err.message.match(
          /Duplicate entry '([\s\S]*)' for key '?((.|\s)*?)'?\s.*$/);

        let fields = {};
        let message = 'Validation error';
        const values = match ? match[1].split('-') : undefined;
        const fieldKey = match ? match[2] : undefined;
        const fieldVal = match ? match[1] : undefined;
        const uniqueKey = this.model && this.model.uniqueKeys[fieldKey];

        if (uniqueKey) {
          if (uniqueKey.msg) message = uniqueKey.msg;
          fields = _.zipObject(uniqueKey.fields, values);
        } else {
          fields[fieldKey] = fieldVal;
        }

        const errors = [];
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

        return new sequelizeErrors.UniqueConstraintError({ message, errors, parent: err, fields, stack: errStack });
      }

      case ER_ROW_IS_REFERENCED:
      case ER_NO_REFERENCED_ROW: {
        // e.g. CONSTRAINT `example_constraint_name` FOREIGN KEY (`example_id`) REFERENCES `examples` (`id`)
        const match = err.message.match(
          /CONSTRAINT ([`"])(.*)\1 FOREIGN KEY \(\1(.*)\1\) REFERENCES \1(.*)\1 \(\1(.*)\1\)/
        );
        const quoteChar = match ? match[1] : '`';
        const fields = match ? match[3].split(new RegExp(`${quoteChar}, *${quoteChar}`)) : undefined;

        return new sequelizeErrors.ForeignKeyConstraintError({
          reltype: err.errno === ER_ROW_IS_REFERENCED ? 'parent' : 'child',
          table: match ? match[4] : undefined,
          fields,
          value: fields && fields.length && this.instance && this.instance[fields[0]] || undefined,
          index: match ? match[2] : undefined,
          parent: err,
          stack: errStack
        });
      }

      default:
        return new sequelizeErrors.DatabaseError(err, { stack: errStack });
    }
  }

  handleShowTablesQuery(results) {
    return results.map(resultSet => ({
      tableName: resultSet.TABLE_NAME,
      schema: resultSet.TABLE_SCHEMA
    }));
  }

  handleShowIndexesQuery(data) {

    let currItem;
    const result = [];

    data.forEach(item => {
      if (!currItem || currItem.name !== item.Key_name) {
        currItem = {
          primary: item.Key_name === 'PRIMARY',
          fields: [],
          name: item.Key_name,
          tableName: item.Table,
          unique: item.Non_unique !== 1,
          type: item.Index_type
        };
        result.push(currItem);
      }

      currItem.fields[item.Seq_in_index - 1] = {
        attribute: item.Column_name,
        length: item.Sub_part || undefined,
        order: item.Collation === 'A' ? 'ASC' : undefined
      };
    });

    return result;
  }
}

module.exports = Query;
