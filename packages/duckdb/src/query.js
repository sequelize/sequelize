'use strict';

import { AbstractQuery, DatabaseError, UniqueConstraintError } from '@sequelize/core';
import { logger } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/logger.js';
import { isBigInt } from '@sequelize/utils';
import { blobValue } from '@duckdb/node-api';

const debug = logger.debugContext('sql:duckdb');

/**
 * Execute a query on the DuckDB connection and return row objects.
 * @param {import('@duckdb/node-api').DuckDBConnection} duckdbConnection - The DuckDB connection
 * @param {string} sql - SQL to execute
 * @param {Array} [parameters] - Optional bind parameters (positional)
 * @returns {Promise<Array<Object>>} Array of row objects
 */
async function executeQuery(duckdbConnection, sql, parameters) {
  // Only pass parameters if they exist and are non-empty
  // This ensures we use the direct query path (faster, better MVCC behavior)
  // instead of the prepared statement path when no parameters are needed
  const hasParameters = parameters && parameters.length > 0;
  const reader = await duckdbConnection.runAndReadAll(sql, hasParameters ? parameters : undefined);

  return reader.getRowObjectsJS();
}

export class DuckDbQuery extends AbstractQuery {
  constructor(connection, sequelize, options) {
    super(connection, sequelize, { showWarnings: false, ...options });
  }

  /**
   * Get the DuckDB connection (which is the connection itself with added Sequelize properties)
   * @returns {import('@duckdb/node-api').DuckDBConnection}
   */
  get duckdbConnection() {
    // The connection IS the DuckDBConnection with additional Sequelize properties (db_path, closed)
    return this.connection;
  }

  async run(sql, parameters) {
    this.sql = sql;
    const complete = this._logQuery(sql, debug, parameters);

    if (sql.startsWith('DROP TABLE')) {
      const sequence_prefix = sql
        .match(/^DROP TABLE IF EXISTS "([^ ]+)"/)[1]
        .replaceAll('.', '_')
        .replaceAll('"', '');

      // clean up all the table's sequences
      const seqResult = await executeQuery(
        this.duckdbConnection,
        'SELECT sequence_name FROM duckdb_sequences() WHERE starts_with(sequence_name, $1)',
        [sequence_prefix],
      );

      if (seqResult && seqResult.length > 0 && 'sequence_name' in seqResult[0]) {
        await executeQuery(
          this.duckdbConnection,
          `DROP SEQUENCE ${seqResult[0].sequence_name} CASCADE`,
        );
      }

      return this.runQueryInternal(sql, parameters, complete);
    }

    return this.runQueryInternal(sql, parameters, complete);
  }

  formatError(err) {
    if (
      err.errorType === 'Constraint' &&
      (err.message.includes('Duplicate key') || err.message.includes('duplicate key'))
    ) {
      // retry 'properly bind parameters on extra retries' test has a hardcoded condition with "Validation"
      return new UniqueConstraintError({ message: `Validation error: ${err.message}`, cause: err });
    }

    return new DatabaseError(err);
  }

  // Sequelize really wants untyped string values when used without a model
  postprocessData(data, model) {
    if (!model) {
      // Sequelize really wants plain text data in the absence of a model
      for (const i in data) {
        for (const key in data[i]) {
          if (data[i][key] instanceof Date) {
            data[i][key] = data[i][key].toISOString();
          }
        }
      }
    }

    return data;
  }

  async runQueryInternal(sql, parameters, loggingCompleteCallback) {
    let convertedParameters;
    if (parameters) {
      // Convert parameters to DuckDB-compatible types
      convertedParameters = parameters.map(p => {
        if (isBigInt(p)) {
          // BigInt binds as null in duckdb-node, convert to string
          return p.toString();
        }

        // Buffer/Uint8Array must be wrapped in blobValue for @duckdb/node-api
        if (Buffer.isBuffer(p) || p instanceof Uint8Array) {
          return blobValue(p);
        }

        return p;
      });
    }

    try {
      const data = await executeQuery(this.duckdbConnection, sql, convertedParameters);
      loggingCompleteCallback();

      if (this.isSelectQuery()) {
        return this.handleSelectQuery(this.postprocessData(data, this.model?.modelDefinition));
      }

      return this.processResults(data);
    } catch (error) {
      throw this.formatError(error);
    }
  }

  // Converts non-SELECT query results to a format expected by the framework.
  processResults(data) {
    // this is not amazing since row count can be larger than Number but Sequelize expects a Number...
    let rowsUpdated = 0;
    if (Array.isArray(data)) {
      if (data.length > 0 && Object.hasOwn(data[0], 'Count')) {
        // Update or Delete query
        rowsUpdated = Number(data[0].Count);
      } else {
        // Upsert query with RETURNING clause will return rows
        rowsUpdated = data.length;
      }
    }

    let result = this.instance;

    if (this.isInsertQuery(data, {}) || this.isUpsertQuery()) {
      this.handleInsertQuery(data, {});
      const modelDefinition = this.model?.modelDefinition;

      if (!this.instance) {
        // return autogenerated fields, so a model can be constructed
        result = data;
      } else if (Array.isArray(data) && data.length > 0) {
        // update model with values returned from the database
        for (const column of Object.keys(data[0])) {
          const modelColumn = modelDefinition.columns.get(column);
          if (modelColumn) {
            const val = data[0][column]
              ? modelColumn.type.parseDatabaseValue(data[0][column])
              : data[0][column];
            this.instance.set(modelColumn.attributeName, val, {
              raw: true,
              comesFromDatabase: true,
            });
          }
        }
      }

      // Second value for upsert should be whether the row was inserted, but there is no way to know
      return this.isUpsertQuery() ? [result, null] : [result, rowsUpdated];
    }

    if (this.isUpdateQuery()) {
      return [result, rowsUpdated];
    }

    if (this.isShowOrDescribeQuery() || this.sql.includes('from duckdb_columns()')) {
      const describeResult = {};
      for (const column of data) {
        describeResult[column.column_name] = {
          type: column.column_type,
          allowNull: column.null === 'YES' || column.is_nullable,
          defaultValue: column.default || null,
          primaryKey: column.key === 'PRI' || column.is_primary_key || false,
          unique: false,
        };
      }

      return describeResult;
    }

    if (this.isRawQuery()) {
      return [data, rowsUpdated];
    }

    if (this.isShowConstraintsQuery() || this.isShowIndexesQuery()) {
      // those are not useful right now because constraints/indexes are unsupported
      // but they'll still return an empty array when invoked
      return data;
    }

    if (this.isBulkUpdateQuery() || this.isDeleteQuery()) {
      // TBD: check what format is expected to be returned - just the row count?
      return rowsUpdated;
    }

    // TBD: is fallback needed?
    return [data, rowsUpdated];
  }
}
