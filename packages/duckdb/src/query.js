'use strict';

import { AbstractQuery, DatabaseError, UniqueConstraintError } from '@sequelize/core';
import { logger } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/logger.js';
import { isBigInt } from '@sequelize/utils';
import { blobValue } from '@duckdb/node-api';

const debug = logger.debugContext('sql:duckdb');

/**
 * Per-database query execution queue.
 * Serializes query execution on each database (by path) to prevent MVCC conflicts
 * from concurrent operations. DuckDB uses optimistic concurrency control
 * and will throw "Conflict on update!" errors if multiple transactions
 * try to modify the same rows concurrently.
 *
 * This is necessary because multiple connections can be created for the same
 * database file, and they all share the same DuckDB instance. Serializing at
 * the database level ensures that concurrent queries from different connections
 * don't conflict.
 *
 */
const databaseQueues = new Map();

/**
 * Get or create the execution queue for a database path.
 * @param {string} dbPath - The database file path
 * @returns {Promise<void>}
 */
function getDatabaseQueue(dbPath) {
  if (!databaseQueues.has(dbPath)) {
    databaseQueues.set(dbPath, Promise.resolve());
  }

  return databaseQueues.get(dbPath);
}

/**
 * Execute a query on the DuckDB connection and return row objects.
 * Queries are serialized per-database to prevent MVCC conflicts.
 * @param {duckdbConnection} - The DuckDB connection (with db_path)
 * @param {string} sql - SQL to execute
 * @param {parameters} - Optional bind parameters (positional)
 * @returns {Promise<Array<Object>>} Array of row objects
 */
function executeQuery(duckdbConnection, sql, parameters) {
  const hasParameters = parameters && parameters.length > 0;
  const dbPath = duckdbConnection.db_path;

  // Chain this query to the database's execution queue
  const currentQueue = getDatabaseQueue(dbPath);

  const resultPromise = currentQueue.then(async () => {
    const reader = await duckdbConnection.runAndReadAll(sql, hasParameters ? parameters : undefined);

    return reader.getRowObjectsJS();
  });

  // Update the queue - use catch to prevent a failed query from blocking subsequent queries
  databaseQueues.set(dbPath, resultPromise.catch(() => {}));

  return resultPromise;
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

        // Numbers exceeding INT32_MAX are interpreted as signed INT32 by the DuckDB Node.js bindings,
        // causing overflow (e.g., 4294967295 becomes -1). Convert to BigInt to preserve value.
        // This is needed for UINTEGER columns that can hold values > 2147483647.
        if (typeof p === 'number' && Number.isInteger(p) && p > 2147483647) {
          return BigInt(p);
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
      return rowsUpdated;
    }

    return [data, rowsUpdated];
  }
}
