'use strict';

import { noSchemaParameter, noSchemaDelimiterParameter } from '../../utils/deprecations';

const sequelizeErrors = require('../../errors');
const { QueryTypes } = require('../../query-types');
const { AbstractQueryInterface, QueryOptions, ColumnsDescription } = require('../abstract/query-interface');
const { cloneDeep } = require('../../utils/object.js');
const _ = require('lodash');
const crypto = require('node:crypto');

/**
 * The interface that Sequelize uses to talk with SQLite database
 */
export class SqliteQueryInterface extends AbstractQueryInterface {
  /**
   * A wrapper that fixes SQLite's inability to remove columns from existing tables.
   * It will create a backup of the table, drop the table afterwards and create a
   * new table with the same name but without the obsolete column.
   *
   * @override
   */
  async removeColumn(tableName, attributeName, options) {
    options = options || {};

    const fields = await this.describeTable(tableName, options);
    delete fields[attributeName];

    return this.alterTableInternal(tableName, fields, options);
  }

  /**
   * A wrapper that fixes SQLite's inability to change columns from existing tables.
   * It will create a backup of the table, drop the table afterwards and create a
   * new table with the same name but with a modified version of the respective column.
   *
   * @override
   */
  async changeColumn(tableName, columnName, dataTypeOrOptions, options) {
    options = options || {};

    const columns = await this.describeTable(tableName, options);
    for (const column of Object.values(columns)) {
      // This is handled by copying indexes over,
      // we don't use "unique" because it creates an index with a name
      // we can't control
      delete column.unique;
    }

    Object.assign(columns[columnName], this.normalizeAttribute(dataTypeOrOptions));

    return this.alterTableInternal(tableName, columns, options);
  }

  /**
   * A wrapper that fixes SQLite's inability to rename columns from existing tables.
   * It will create a backup of the table, drop the table afterwards and create a
   * new table with the same name but with a renamed version of the respective column.
   *
   * @override
   */
  async renameColumn(tableName, attrNameBefore, attrNameAfter, options) {
    options = options || {};
    const fields = await this.assertTableHasColumn(tableName, attrNameBefore, options);

    fields[attrNameAfter] = { ...fields[attrNameBefore] };
    delete fields[attrNameBefore];

    const sql = this.queryGenerator.renameColumnQuery(tableName, attrNameBefore, attrNameAfter, fields);
    const subQueries = sql.split(';').filter(q => q !== '');

    for (const subQuery of subQueries) {
      await this.sequelize.queryRaw(`${subQuery};`, { raw: true, ...options });
    }
  }

  /**
   * @override
   */
  async removeConstraint(tableName, constraintName, options) {
    let createTableSql;

    const constraints = await this.showConstraint(tableName, constraintName);
    // sqlite can't show only one constraint, so we find here the one to remove
    const constraint = constraints.find(constaint => constaint.constraintName === constraintName);

    if (!constraint) {
      throw new sequelizeErrors.UnknownConstraintError({
        message: `Constraint ${constraintName} on table ${tableName} does not exist`,
        constraint: constraintName,
        table: tableName,
      });
    }

    createTableSql = constraint.sql;
    constraint.constraintName = this.queryGenerator.quoteIdentifier(constraint.constraintName);
    let constraintSnippet = `, CONSTRAINT ${constraint.constraintName} ${constraint.constraintType} ${constraint.constraintCondition}`;

    if (constraint.constraintType === 'FOREIGN KEY') {
      const referenceTableName = this.queryGenerator.quoteTable(constraint.referenceTableName);
      constraint.referenceTableKeys = constraint.referenceTableKeys.map(columnName => this.queryGenerator.quoteIdentifier(columnName));
      const referenceTableKeys = constraint.referenceTableKeys.join(', ');
      constraintSnippet += ` REFERENCES ${referenceTableName} (${referenceTableKeys})`;
      constraintSnippet += ` ON UPDATE ${constraint.updateAction}`;
      constraintSnippet += ` ON DELETE ${constraint.deleteAction}`;
    }

    createTableSql = createTableSql.replace(constraintSnippet, '');
    createTableSql += ';';

    const fields = await this.describeTable(tableName, options);

    const sql = this.queryGenerator._alterConstraintQuery(tableName, fields, createTableSql);
    const subQueries = sql.split(';').filter(q => q !== '');

    for (const subQuery of subQueries) {
      await this.sequelize.queryRaw(`${subQuery};`, { raw: true, ...options });
    }
  }

  /**
   * @override
   */
  async addConstraint(tableName, options) {
    if (!options.fields) {
      throw new Error('Fields must be specified through options.fields');
    }

    if (!options.type) {
      throw new Error('Constraint type must be specified through options.type');
    }

    options = cloneDeep(options);

    const constraintSnippet = this.queryGenerator.getConstraintSnippet(tableName, options);
    const describeCreateTableSql = this.queryGenerator.describeCreateTableQuery(tableName);

    const constraints = await this.sequelize.queryRaw(describeCreateTableSql, { ...options, type: QueryTypes.SELECT, raw: true });
    let sql = constraints[0].sql;
    const index = sql.length - 1;
    // Replace ending ')' with constraint snippet - Simulates String.replaceAt
    // http://stackoverflow.com/questions/1431094
    const createTableSql = `${sql.slice(0, Math.max(0, index))}, ${constraintSnippet})${sql.slice(index + 1)};`;

    const fields = await this.describeTable(tableName, options);
    sql = this.queryGenerator._alterConstraintQuery(tableName, fields, createTableSql);
    const subQueries = sql.split(';').filter(q => q !== '');

    for (const subQuery of subQueries) {
      await this.sequelize.queryRaw(`${subQuery};`, { raw: true, ...options });
    }
  }

  /**
   * @override
   */
  async getForeignKeyReferencesForTable(tableName, options) {
    const database = this.sequelize.config.database;
    const query = this.queryGenerator.getForeignKeysQuery(tableName, database);
    const result = await this.sequelize.queryRaw(query, options);

    return result.map(row => ({
      tableName,
      columnName: row.from,
      referencedTableName: row.table,
      referencedColumnName: row.to,
      tableCatalog: database,
      referencedTableCatalog: database,
      constraints: {
        onUpdate: row.on_update,
        onDelete: row.on_delete,
      },
    }));
  }

  /**
   * @override
   */
  async dropAllTables(options) {
    options = options || {};
    const skip = options.skip || [];

    const tableNames = await this.showAllTables(options);
    await this.sequelize.queryRaw('PRAGMA foreign_keys = OFF', options);
    await this._dropAllTables(tableNames, skip, options);
    await this.sequelize.queryRaw('PRAGMA foreign_keys = ON', options);
  }

  /**
   * @override
   */
  async describeTable(tableName, options) {
    let table = {};

    if (typeof tableName === 'string') {
      table.tableName = tableName;
    }

    if (typeof tableName === 'object' && tableName !== null) {
      table = tableName;
    }

    if (typeof options === 'string') {
      noSchemaParameter();
      table.schema = options;
    }

    if (typeof options === 'object' && options !== null) {
      if (options.schema) {
        noSchemaParameter();
        table.schema = options.schema;
      }

      if (options.schemaDelimiter) {
        noSchemaDelimiterParameter();
        table.delimiter = options.schemaDelimiter;
      }
    }

    const sql = this.queryGenerator.describeTableQuery(table);
    options = { ...options, type: QueryTypes.DESCRIBE };
    const sqlIndexes = this.queryGenerator.showIndexesQuery(table);

    try {
      const data = await this.sequelize.queryRaw(sql, options);
      /*
       * If no data is returned from the query, then the table name may be wrong.
       * Query generators that use information_schema for retrieving table info will just return an empty result set,
       * it will not throw an error like built-ins do (e.g. DESCRIBE on MySql).
       */
      if (_.isEmpty(data)) {
        throw new Error(`No description found for table ${table.tableName}${table.schema ? ` in schema ${table.schema}` : ''}. Check the table name and schema; remember, they _are_ case sensitive.`);
      }

      const indexes = await this.sequelize.queryRaw(sqlIndexes, options);
      for (const prop in data) {
        data[prop].unique = false;
      }

      for (const index of indexes) {
        for (const field of index.fields) {
          if (index.unique !== undefined) {
            data[field.attribute].unique = index.unique;
          }
        }
      }

      const foreignKeys = await this.getForeignKeyReferencesForTable(tableName, options);
      for (const foreignKey of foreignKeys) {
        data[foreignKey.columnName].references = {
          table: foreignKey.referencedTableName,
          key: foreignKey.referencedColumnName,
        };

        // Add constraints to column definition
        Object.assign(data[foreignKey.columnName], {
          onUpdate: foreignKey.constraints.onUpdate,
          onDelete: foreignKey.constraints.onDelete,
        });
      }

      return data;
    } catch (error) {
      if (error.original && error.original.code === 'ER_NO_SUCH_TABLE') {
        throw new Error(`No description found for table ${table.tableName}${table.schema ? ` in schema ${table.schema}` : ''}. Check the table name and schema; remember, they _are_ case sensitive.`);
      }

      throw error;
    }
  }

  /**
   * Alters a table in sqlite.
   * Workaround for sqlite's limited alter table support.
   *
   * @param {string} tableName - The table's name
   * @param {ColumnsDescription} columns - The table's description
   * @param {QueryOptions} options - Query options
   * @private
   */
  async alterTableInternal(tableName, columns, options) {
    return this.withForeignKeysOff(options, async () => {
      const savepointName = this.getSavepointName();
      await this.sequelize.query(`SAVEPOINT ${savepointName};`, options);

      try {
        const indexes = await this.showIndex(tableName, options);
        for (const index of indexes) {
          // This index is reserved by SQLite, we can't add it through addIndex and must use "UNIQUE" on the column definition instead.
          if (!index.constraintName.startsWith('sqlite_autoindex_')) {
            continue;
          }

          if (!index.unique) {
            continue;
          }

          for (const field of index.fields) {
            if (columns[field.attribute]) {
              columns[field.attribute].unique = true;
            }
          }
        }

        const sql = this.queryGenerator.removeColumnQuery(tableName, columns);
        const subQueries = sql.split(';').filter(q => q !== '');

        for (const subQuery of subQueries) {
          await this.sequelize.query(`${subQuery};`, { raw: true, ...options });
        }

        // Run a foreign keys integrity check
        const foreignKeyCheckResult = await this.sequelize.query(this.queryGenerator.foreignKeyCheckQuery(tableName), {
          ...options,
          type: QueryTypes.SELECT,
        });

        if (foreignKeyCheckResult.length > 0) {
          // There are foreign key violations, exit
          throw new sequelizeErrors.ForeignKeyConstraintError({
            message: `Foreign key violations detected: ${JSON.stringify(foreignKeyCheckResult, null, 2)}`,
            table: tableName,
          });
        }

        await Promise.all(indexes.map(async index => {
          // This index is reserved by SQLite, we can't add it through addIndex and must use "UNIQUE" on the column definition instead.
          if (index.constraintName.startsWith('sqlite_autoindex_')) {
            return;
          }

          return this.addIndex(tableName, index);
        }));

        await this.sequelize.query(`RELEASE ${savepointName};`, options);
      } catch (error) {
        await this.sequelize.query(`ROLLBACK TO ${savepointName};`, options);
        throw error;
      }
    });
  }

  /**
   * Runs the provided callback with foreign keys disabled.
   *
   * @param {QueryOptions} [options]
   * @param {Function<Promise<any>>} cb
   * @private
   */
  async withForeignKeysOff(options, cb) {
    await this.sequelize.query('PRAGMA foreign_keys = OFF;', options);

    try {
      return await cb();
    } finally {
      await this.sequelize.query('PRAGMA foreign_keys = ON;', options);
    }
  }

  /**
   * Returns a randomly generated savepoint name
   *
   * @param {string} prefix
   * @returns {string}
   */
  getSavepointName(prefix = 'sequelize') {
    // sqlite does not support "-" (dashes) in transaction's name
    const suffix = crypto.randomUUID().replace(/-/g, '_');

    return `${prefix}_${suffix}`;
  }
}
