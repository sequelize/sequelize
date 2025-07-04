import { isNotNullish } from '@sequelize/utils';
import isEmpty from 'lodash/isEmpty';
import assert from 'node:assert';
import type { ConstraintChecking } from '../deferrable';
import { Deferrable } from '../deferrable';
import { QueryTypes } from '../enums';
import { BaseError } from '../errors';
import { setTransactionFromCls } from '../model-internals.js';
import type { QueryRawOptions, QueryRawOptionsWithType, Sequelize } from '../sequelize';
import { COMPLETES_TRANSACTION, Transaction } from '../transaction';
import { isErrorWithStringCode } from '../utils/check.js';
import {
  noSchemaDelimiterParameter,
  noSchemaParameter,
  showAllToListSchemas,
  showAllToListTables,
} from '../utils/deprecations';
import type { AbstractConnection } from './connection-manager.js';
import type { AbstractDialect } from './dialect.js';
import type { TableOrModel } from './query-generator.types.js';
import { AbstractQueryInterfaceInternal } from './query-interface-internal.js';
import type { TableNameWithSchema } from './query-interface.js';
import type {
  AddConstraintOptions,
  ColumnsDescription,
  CommitTransactionOptions,
  ConstraintDescription,
  CreateDatabaseOptions,
  CreateSavepointOptions,
  CreateSchemaOptions,
  DatabaseDescription,
  DeferConstraintsOptions,
  DescribeTableOptions,
  DropSchemaOptions,
  FetchDatabaseVersionOptions,
  ListDatabasesOptions,
  QiBulkDeleteOptions,
  QiDropAllSchemasOptions,
  QiDropAllTablesOptions,
  QiDropTableOptions,
  QiListSchemasOptions,
  QiListTablesOptions,
  QiTruncateTableOptions,
  RemoveColumnOptions,
  RemoveConstraintOptions,
  RenameTableOptions,
  RollbackSavepointOptions,
  RollbackTransactionOptions,
  SetIsolationLevelOptions,
  ShowConstraintsOptions,
  StartTransactionOptions,
} from './query-interface.types';

export type WithoutForeignKeyChecksCallback<T> = (connection: AbstractConnection) => Promise<T>;

// DO NOT MAKE THIS CLASS PUBLIC!
/**
 * This is a temporary class used to progressively migrate the AbstractQueryInterface class to TypeScript by slowly moving its functions here.
 * Always use {@link AbstractQueryInterface} instead.
 */
export class AbstractQueryInterfaceTypeScript<Dialect extends AbstractDialect = AbstractDialect> {
  readonly dialect: Dialect;
  readonly #internalQueryInterface: AbstractQueryInterfaceInternal;

  /**
   * @param dialect The dialect instance.
   * @param internalQueryInterface The internal query interface to use.
   *                               Defaults to a new instance of {@link AbstractQueryInterfaceInternal}.
   *                               Your dialect may replace this with a custom implementation.
   */
  constructor(dialect: Dialect, internalQueryInterface?: AbstractQueryInterfaceInternal) {
    this.dialect = dialect;
    this.#internalQueryInterface =
      internalQueryInterface ?? new AbstractQueryInterfaceInternal(dialect);
  }

  get sequelize(): Sequelize<Dialect> {
    return this.dialect.sequelize;
  }

  get queryGenerator(): Dialect['queryGenerator'] {
    return this.dialect.queryGenerator;
  }

  /**
   * Create a database
   *
   * @param database
   * @param options
   */
  async createDatabase(database: string, options?: CreateDatabaseOptions): Promise<void> {
    const sql = this.queryGenerator.createDatabaseQuery(database, options);

    await this.sequelize.queryRaw(sql, options);
  }

  /**
   * Drop a database
   *
   * @param database
   * @param options
   */
  async dropDatabase(database: string, options?: QueryRawOptions): Promise<void> {
    const sql = this.queryGenerator.dropDatabaseQuery(database);

    await this.sequelize.queryRaw(sql, options);
  }

  /**
   * Lists all available databases
   *
   * @param options
   */
  async listDatabases(options?: ListDatabasesOptions): Promise<DatabaseDescription[]> {
    const sql = this.queryGenerator.listDatabasesQuery(options);

    return this.sequelize.queryRaw<DatabaseDescription>(sql, {
      ...options,
      type: QueryTypes.SELECT,
    });
  }

  /**
   * Returns the database version.
   *
   * @param options Query Options
   */
  async fetchDatabaseVersion(options?: FetchDatabaseVersionOptions): Promise<string> {
    const payload = await this.#internalQueryInterface.fetchDatabaseVersionRaw<{ version: string }>(
      options,
    );

    assert(
      payload.version != null,
      'Expected the version query to produce an object that includes a `version` property.',
    );

    return payload.version;
  }

  /**
   * Create a new database schema.
   *
   * **Note:** We define schemas as a namespace that can contain tables.
   * In mysql and mariadb, this command will create what they call a database.
   *
   * @param schema Name of the schema
   * @param options
   */
  async createSchema(schema: string, options?: CreateSchemaOptions): Promise<void> {
    const sql = this.queryGenerator.createSchemaQuery(schema, options);
    await this.sequelize.queryRaw(sql, options);
  }

  /**
   * Drop a single schema
   *
   * **Note:** We define schemas as a namespace that can contain tables.
   * In mysql and mariadb, this command will create what they call a database.
   *
   * @param schema Name of the schema
   * @param options
   */
  async dropSchema(schema: string, options?: DropSchemaOptions): Promise<void> {
    const sql = this.queryGenerator.dropSchemaQuery(schema, options);
    await this.sequelize.queryRaw(sql, options);
  }

  /**
   * Drops all schemas
   *
   * @param options
   */
  async dropAllSchemas(options?: QiDropAllSchemasOptions): Promise<void> {
    const skip = options?.skip || [];
    const allSchemas = await this.listSchemas(options);
    const schemaNames = allSchemas.filter(schemaName => !skip.includes(schemaName));

    const dropOptions = { ...options };
    // enable "cascade" by default for dialects that support it
    if (dropOptions.cascade === undefined) {
      if (this.sequelize.dialect.supports.dropSchema.cascade) {
        dropOptions.cascade = true;
      } else {
        // if the dialect does not support "cascade", then drop all tables first in a loop to avoid deadlocks and timeouts
        for (const schema of schemaNames) {
          // eslint-disable-next-line no-await-in-loop
          await this.dropAllTables({ ...dropOptions, schema });
        }
      }
    }

    // Drop all the schemas in a loop to avoid deadlocks and timeouts
    for (const schema of schemaNames) {
      // eslint-disable-next-line no-await-in-loop
      await this.dropSchema(schema, dropOptions);
    }
  }

  /**
   * List defined schemas
   *
   * **Note:** this is a schema in the [postgres sense of the word](http://www.postgresql.org/docs/9.1/static/ddl-schemas.html),
   * not a database table. In mysql and mariadb, this will show all databases.
   *
   * @param options
   *
   * @returns list of schemas
   */
  async listSchemas(options?: QiListSchemasOptions): Promise<string[]> {
    const showSchemasSql = this.queryGenerator.listSchemasQuery(options);
    const schemaNames = await this.sequelize.queryRaw<{ schema: string }>(showSchemasSql, {
      ...options,
      raw: true,
      type: QueryTypes.SELECT,
    });

    return schemaNames.map(schemaName => schemaName.schema);
  }

  /**
   * Show all defined schemas
   *
   * @deprecated Use {@link listSchemas} instead.
   * @param options
   */
  async showAllSchemas(options?: QiListSchemasOptions): Promise<string[]> {
    showAllToListSchemas();

    return this.listSchemas(options);
  }

  /**
   * Drop a table from database
   *
   * @param tableName Table name to drop
   * @param options   Query options
   */
  async dropTable(tableName: TableOrModel, options?: QiDropTableOptions): Promise<void> {
    const sql = this.queryGenerator.dropTableQuery(tableName, options);

    await this.sequelize.queryRaw(sql, options);
  }

  /**
   * Drop all tables
   *
   * @param options
   */
  async dropAllTables(options?: QiDropAllTablesOptions): Promise<void> {
    const skip = options?.skip || [];
    const allTables = await this.listTables(options);
    const tableNames = allTables.filter(tableName => !skip.includes(tableName.tableName));

    const dropOptions = { ...options };
    // enable "cascade" by default if supported by this dialect
    if (this.sequelize.dialect.supports.dropTable.cascade && dropOptions.cascade === undefined) {
      dropOptions.cascade = true;
    }

    // Remove all the foreign keys first in a loop to avoid deadlocks and timeouts
    for (const tableName of tableNames) {
      // eslint-disable-next-line no-await-in-loop
      const foreignKeys = await this.showConstraints(tableName, {
        ...options,
        constraintType: 'FOREIGN KEY',
      });
      // eslint-disable-next-line no-await-in-loop
      await Promise.all(
        foreignKeys.map(async fk => this.removeConstraint(tableName, fk.constraintName, options)),
      );
    }

    // Drop all the tables loop to avoid deadlocks and timeouts
    for (const tableName of tableNames) {
      // eslint-disable-next-line no-await-in-loop
      await this.dropTable(tableName, dropOptions);
    }
  }

  /**
   * List tables
   *
   * @param options
   */
  async listTables(options?: QiListTablesOptions): Promise<TableNameWithSchema[]> {
    const sql = this.queryGenerator.listTablesQuery(options);

    return this.sequelize.queryRaw<TableNameWithSchema>(sql, {
      ...options,
      raw: true,
      type: QueryTypes.SELECT,
    });
  }

  /**
   * Show all tables
   *
   * @deprecated Use {@link listTables} instead.
   * @param options
   */
  async showAllTables(options?: QiListTablesOptions): Promise<TableNameWithSchema[]> {
    showAllToListTables();

    return this.listTables(options);
  }

  /**
   * Rename a table
   *
   * @param beforeTableName
   * @param afterTableName
   * @param options
   */
  async renameTable(
    beforeTableName: TableOrModel,
    afterTableName: TableOrModel,
    options?: RenameTableOptions,
  ): Promise<void> {
    const sql = this.queryGenerator.renameTableQuery(beforeTableName, afterTableName, options);

    await this.sequelize.queryRaw(sql, options);
  }

  /**
   * Returns a promise that will resolve to true if the table or model exists in the database, false otherwise.
   *
   * @param tableName - The name of the table or model
   * @param options - Query options
   */
  async tableExists(tableName: TableOrModel, options?: QueryRawOptions): Promise<boolean> {
    const sql = this.queryGenerator.tableExistsQuery(tableName);
    const out = await this.sequelize.query(sql, { ...options, type: QueryTypes.SELECT });

    return out.length === 1;
  }

  /**
   * Describe a table structure
   *
   * This method returns an array of hashes containing information about all attributes in the table.
   *
   * ```js
   * {
   *    name: {
   *      type:         'VARCHAR(255)', // this will be 'CHARACTER VARYING' for pg!
   *      allowNull:    true,
   *      defaultValue: null
   *    },
   *    isBetaMember: {
   *      type:         'TINYINT(1)', // this will be 'BOOLEAN' for pg!
   *      allowNull:    false,
   *      defaultValue: false
   *    }
   * }
   * ```
   *
   * @param tableName
   * @param options Query options
   */
  async describeTable(
    tableName: TableOrModel,
    options?: DescribeTableOptions,
  ): Promise<ColumnsDescription> {
    const table = this.queryGenerator.extractTableDetails(tableName);

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
    const queryOptions: QueryRawOptionsWithType<QueryTypes.DESCRIBE> = {
      ...options,
      type: QueryTypes.DESCRIBE,
    };

    try {
      const data = await this.sequelize.queryRaw(sql, queryOptions);
      /*
       * If no data is returned from the query, then the table name may be wrong.
       * Query generators that use information_schema for retrieving table info will just return an empty result set,
       * it will not throw an error like built-ins do (e.g. DESCRIBE on MySql).
       */
      if (isEmpty(data)) {
        throw new Error(
          `No description found for table ${table.tableName}${table.schema ? ` in schema ${table.schema}` : ''}. Check the table name and schema; remember, they _are_ case sensitive.`,
        );
      }

      return data;
    } catch (error: unknown) {
      if (
        error instanceof BaseError &&
        isErrorWithStringCode(error.cause) &&
        error.cause.code === 'ER_NO_SUCH_TABLE'
      ) {
        throw new Error(
          `No description found for table ${table.tableName}${table.schema ? ` in schema ${table.schema}` : ''}. Check the table name and schema; remember, they _are_ case sensitive.`,
        );
      }

      throw error;
    }
  }

  /**
   * Truncates a table
   *
   * @param tableName
   * @param options
   */
  async truncate(tableName: TableOrModel, options?: QiTruncateTableOptions): Promise<void> {
    const sql = this.queryGenerator.truncateTableQuery(tableName, options);
    const queryOptions = { ...options, raw: true, type: QueryTypes.RAW };
    if (Array.isArray(sql)) {
      await this.#internalQueryInterface.executeQueriesSequentially(sql, queryOptions);
    } else {
      await this.sequelize.queryRaw(sql, queryOptions);
    }
  }

  /**
   * Removes a column from a table
   *
   * @param tableName
   * @param columnName
   * @param options
   */
  async removeColumn(
    tableName: TableOrModel,
    columnName: string,
    options?: RemoveColumnOptions,
  ): Promise<void> {
    const queryOptions = { ...options, raw: true };
    const sql = this.queryGenerator.removeColumnQuery(tableName, columnName, queryOptions);

    await this.sequelize.queryRaw(sql, queryOptions);
  }

  /**
   * Add a constraint to a table
   *
   * Available constraints:
   * - UNIQUE
   * - DEFAULT (MSSQL only)
   * - CHECK (Not supported by MySQL)
   * - FOREIGN KEY
   * - PRIMARY KEY
   *
   * @example UNIQUE
   * ```ts
   * queryInterface.addConstraint('Users', {
   *   fields: ['email'],
   *   type: 'UNIQUE',
   *   name: 'custom_unique_constraint_name'
   * });
   * ```
   *
   * @example CHECK
   * ```ts
   * queryInterface.addConstraint('Users', {
   *   fields: ['roles'],
   *   type: 'CHECK',
   *   where: {
   *      roles: ['user', 'admin', 'moderator', 'guest']
   *   }
   * });
   * ```
   *
   * @example Default - MSSQL only
   * ```ts
   * queryInterface.addConstraint('Users', {
   *    fields: ['roles'],
   *    type: 'DEFAULT',
   *    defaultValue: 'guest'
   * });
   * ```
   *
   * @example Primary Key
   * ```ts
   * queryInterface.addConstraint('Users', {
   *    fields: ['username'],
   *    type: 'PRIMARY KEY',
   *    name: 'custom_primary_constraint_name'
   * });
   * ```
   *
   * @example Composite Primary Key
   * ```ts
   * queryInterface.addConstraint('Users', {
   *    fields: ['first_name', 'last_name'],
   *    type: 'PRIMARY KEY',
   *    name: 'custom_primary_constraint_name'
   * });
   * ```
   *
   * @example Foreign Key
   * ```ts
   * queryInterface.addConstraint('Posts', {
   *   fields: ['username'],
   *   type: 'FOREIGN KEY',
   *   name: 'custom_fkey_constraint_name',
   *   references: { //Required field
   *     table: 'target_table_name',
   *     field: 'target_column_name'
   *   },
   *   onDelete: 'cascade',
   *   onUpdate: 'cascade'
   * });
   * ```
   *
   * @example Composite Foreign Key
   * ```ts
   * queryInterface.addConstraint('TableName', {
   *   fields: ['source_column_name', 'other_source_column_name'],
   *   type: 'FOREIGN KEY',
   *   name: 'custom_fkey_constraint_name',
   *   references: { //Required field
   *     table: 'target_table_name',
   *     fields: ['target_column_name', 'other_target_column_name']
   *   },
   *   onDelete: 'cascade',
   *   onUpdate: 'cascade'
   * });
   * ```
   *
   * @param tableName - Table name where you want to add a constraint
   * @param options - An object to define the constraint name, type etc
   */
  async addConstraint(tableName: TableOrModel, options: AddConstraintOptions): Promise<void> {
    if (!options.fields) {
      throw new Error('Fields must be specified through options.fields');
    }

    if (!options.type) {
      throw new Error('Constraint type must be specified through options.type');
    }

    const sql = this.queryGenerator.addConstraintQuery(tableName, options);

    await this.sequelize.queryRaw(sql, { ...options, raw: true, type: QueryTypes.RAW });
  }

  async deferConstraints(
    constraintChecking: ConstraintChecking,
    options?: DeferConstraintsOptions,
  ): Promise<void> {
    setTransactionFromCls(options ?? {}, this.sequelize);
    if (!options?.transaction) {
      throw new Error('Missing transaction in deferConstraints option.');
    }

    const sql = this.queryGenerator.setConstraintCheckingQuery(constraintChecking);

    await this.sequelize.queryRaw(sql, { ...options, raw: true, type: QueryTypes.RAW });
  }

  /**
   * Remove a constraint from a table
   *
   * @param tableName -Table name to drop constraint from
   * @param constraintName -Constraint name
   * @param options -Query options
   */
  async removeConstraint(
    tableName: TableOrModel,
    constraintName: string,
    options?: RemoveConstraintOptions,
  ): Promise<void> {
    const sql = this.queryGenerator.removeConstraintQuery(tableName, constraintName, options);

    await this.sequelize.queryRaw(sql, { ...options, raw: true, type: QueryTypes.RAW });
  }

  async showConstraints(
    tableName: TableOrModel,
    options?: ShowConstraintsOptions,
  ): Promise<ConstraintDescription[]> {
    const sql = this.queryGenerator.showConstraintsQuery(tableName, options);
    const rawConstraints = await this.sequelize.queryRaw(sql, {
      ...options,
      raw: true,
      type: QueryTypes.SHOWCONSTRAINTS,
    });
    const constraintMap = new Map<string, ConstraintDescription>();
    for (const {
      columnNames,
      definition,
      deleteAction,
      initiallyDeferred,
      isDeferrable,
      referencedColumnNames,
      referencedTableName,
      referencedTableSchema,
      updateAction,
      ...rawConstraint
    } of rawConstraints) {
      const constraint = constraintMap.get(rawConstraint.constraintName)!;
      if (constraint) {
        if (columnNames) {
          constraint.columnNames = constraint.columnNames
            ? [...new Set([...constraint.columnNames, columnNames])]
            : [columnNames];
        }

        if (referencedColumnNames) {
          constraint.referencedColumnNames = constraint.referencedColumnNames
            ? [...new Set([...constraint.referencedColumnNames, referencedColumnNames])]
            : [referencedColumnNames];
        }
      } else {
        const constraintData: ConstraintDescription = { ...rawConstraint };
        if (columnNames) {
          constraintData.columnNames = [columnNames];
        }

        if (referencedTableSchema) {
          constraintData.referencedTableSchema = referencedTableSchema;
        }

        if (referencedTableName) {
          constraintData.referencedTableName = referencedTableName;
        }

        if (referencedColumnNames) {
          constraintData.referencedColumnNames = [referencedColumnNames];
        }

        if (deleteAction) {
          constraintData.deleteAction = deleteAction.replaceAll('_', ' ');
        }

        if (updateAction) {
          constraintData.updateAction = updateAction.replaceAll('_', ' ');
        }

        if (definition) {
          constraintData.definition = definition;
        }

        if (this.sequelize.dialect.supports.constraints.deferrable) {
          constraintData.deferrable = isDeferrable
            ? initiallyDeferred === 'YES'
              ? Deferrable.INITIALLY_DEFERRED
              : Deferrable.INITIALLY_IMMEDIATE
            : Deferrable.NOT;
        }

        constraintMap.set(rawConstraint.constraintName, constraintData);
      }
    }

    return [...constraintMap.values()];
  }

  /**
   * Returns all foreign key constraints of requested tables
   *
   * @deprecated Use {@link showConstraints} instead.
   * @param _tableNames
   * @param _options
   */
  getForeignKeysForTables(_tableNames: TableOrModel[], _options?: QueryRawOptions): Error {
    throw new Error(`getForeignKeysForTables has been deprecated. Use showConstraints instead.`);
  }

  /**
   * Get foreign key references details for the table
   *
   * @deprecated Use {@link showConstraints} instead.
   * @param _tableName
   * @param _options
   */
  getForeignKeyReferencesForTable(_tableName: TableOrModel, _options?: QueryRawOptions): Error {
    throw new Error(
      `getForeignKeyReferencesForTable has been deprecated. Use showConstraints instead.`,
    );
  }

  /**
   * Disables foreign key checks for the duration of the callback.
   * The foreign key checks are only disabled for the current connection.
   * To specify the connection, you can either use the "connection" or the "transaction" option.
   * If you do not specify a connection, this method will reserve a connection for the duration of the callback,
   * and release it afterwards. You will receive the connection or transaction as the first argument of the callback.
   * You must use this connection to execute queries
   *
   * @example
   * ```ts
   * await this.queryInterface.withoutForeignKeyChecks(options, async connection => {
   *   const truncateOptions = { ...options, connection };
   *
   *   for (const model of models) {
   *     await model.truncate(truncateOptions);
   *   }
   * });
   * ```
   *
   * @param cb
   */
  async withoutForeignKeyChecks<T>(cb: WithoutForeignKeyChecksCallback<T>): Promise<T>;
  async withoutForeignKeyChecks<T>(
    options: QueryRawOptions,
    cb: WithoutForeignKeyChecksCallback<T>,
  ): Promise<T>;
  async withoutForeignKeyChecks<T>(
    optionsOrCallback: QueryRawOptions | WithoutForeignKeyChecksCallback<T>,
    maybeCallback?: WithoutForeignKeyChecksCallback<T>,
  ): Promise<T> {
    let options: QueryRawOptions;
    let callback: WithoutForeignKeyChecksCallback<T>;

    if (typeof optionsOrCallback === 'function') {
      options = {};
      callback = optionsOrCallback;
    } else {
      options = { ...optionsOrCallback };
      callback = maybeCallback!;
    }

    setTransactionFromCls(options, this.sequelize);

    if (options.connection) {
      return this.#withoutForeignKeyChecks(options, callback);
    }

    return this.sequelize.withConnection(async connection => {
      return this.#withoutForeignKeyChecks({ ...options, connection }, callback);
    });
  }

  async #withoutForeignKeyChecks<T>(
    options: QueryRawOptions,
    cb: WithoutForeignKeyChecksCallback<T>,
  ): Promise<T> {
    try {
      await this.unsafeToggleForeignKeyChecks(false, options);

      isNotNullish.assert(options.connection, 'options.connection must be provided');

      return await cb(options.connection);
    } finally {
      await this.unsafeToggleForeignKeyChecks(true, options);
    }
  }

  /**
   * Toggles foreign key checks.
   * Don't forget to turn them back on, use {@link withoutForeignKeyChecks} to do this automatically.
   *
   * @param enable
   * @param options
   */
  async unsafeToggleForeignKeyChecks(enable: boolean, options?: QueryRawOptions): Promise<void> {
    await this.sequelize.queryRaw(
      this.queryGenerator.getToggleForeignKeyChecksQuery(enable),
      options,
    );
  }

  /**
   * Commit an already started transaction.
   *
   * This is an internal method used by `sequelize.transaction()` use at your own risk.
   *
   * @param transaction
   * @param options
   */
  async _commitTransaction(
    transaction: Transaction,
    options: CommitTransactionOptions,
  ): Promise<void> {
    if (!transaction || !(transaction instanceof Transaction)) {
      throw new Error('Unable to commit a transaction without the transaction object.');
    }

    const sql = this.queryGenerator.commitTransactionQuery();
    await this.sequelize.queryRaw(sql, {
      ...options,
      transaction,
      supportsSearchPath: false,
      [COMPLETES_TRANSACTION]: true,
    });
  }

  /**
   * Create a new savepoint.
   *
   * This is an internal method used by `sequelize.transaction()` use at your own risk.
   *
   * @param transaction
   * @param options
   */
  async _createSavepoint(transaction: Transaction, options: CreateSavepointOptions): Promise<void> {
    if (!this.queryGenerator.dialect.supports.savepoints) {
      throw new Error(`Savepoints are not supported by ${this.sequelize.dialect.name}.`);
    }

    if (!transaction || !(transaction instanceof Transaction)) {
      throw new Error('Unable to create a savepoint without the transaction object.');
    }

    const sql = this.queryGenerator.createSavepointQuery(options.savepointName);
    await this.sequelize.queryRaw(sql, { ...options, transaction, supportsSearchPath: false });
  }

  /**
   * Rollback to a savepoint.
   *
   * This is an internal method used by `sequelize.transaction()` use at your own risk.
   *
   * @param transaction
   * @param options
   */
  async _rollbackSavepoint(
    transaction: Transaction,
    options: RollbackSavepointOptions,
  ): Promise<void> {
    if (!this.queryGenerator.dialect.supports.savepoints) {
      throw new Error(`Savepoints are not supported by ${this.sequelize.dialect.name}.`);
    }

    if (!transaction || !(transaction instanceof Transaction)) {
      throw new Error('Unable to rollback a savepoint without the transaction object.');
    }

    const sql = this.queryGenerator.rollbackSavepointQuery(options.savepointName);
    await this.sequelize.queryRaw(sql, {
      ...options,
      transaction,
      supportsSearchPath: false,
      [COMPLETES_TRANSACTION]: true,
    });
  }

  /**
   * Rollback (revert) a transaction that hasn't been committed.
   *
   * This is an internal method used by `sequelize.transaction()` use at your own risk.
   *
   * @param transaction
   * @param options
   */
  async _rollbackTransaction(
    transaction: Transaction,
    options: RollbackTransactionOptions,
  ): Promise<void> {
    if (!transaction || !(transaction instanceof Transaction)) {
      throw new Error('Unable to rollback a transaction without the transaction object.');
    }

    const sql = this.queryGenerator.rollbackTransactionQuery();
    await this.sequelize.queryRaw(sql, {
      ...options,
      transaction,
      supportsSearchPath: false,
      [COMPLETES_TRANSACTION]: true,
    });
  }

  /**
   * Set the isolation level of a transaction.
   *
   * This is an internal method used by `sequelize.transaction()` use at your own risk.
   *
   * @param transaction
   * @param options
   */
  async _setIsolationLevel(
    transaction: Transaction,
    options: SetIsolationLevelOptions,
  ): Promise<void> {
    if (!this.queryGenerator.dialect.supports.settingIsolationLevelDuringTransaction) {
      throw new Error(
        `Changing the isolation level during the transaction is not supported by ${this.sequelize.dialect.name}.`,
      );
    }

    if (!transaction || !(transaction instanceof Transaction)) {
      throw new Error(
        'Unable to set the isolation level for a transaction without the transaction object.',
      );
    }

    const sql = this.queryGenerator.setIsolationLevelQuery(options.isolationLevel);
    await this.sequelize.queryRaw(sql, { ...options, transaction, supportsSearchPath: false });
  }

  /**
   * Begin a new transaction.
   *
   * This is an internal method used by `sequelize.transaction()` use at your own risk.
   *
   * @param transaction
   * @param options
   */
  async _startTransaction(
    transaction: Transaction,
    options: StartTransactionOptions,
  ): Promise<void> {
    if (!transaction || !(transaction instanceof Transaction)) {
      throw new Error('Unable to start a transaction without the transaction object.');
    }

    const queryOptions = { ...options, transaction, supportsSearchPath: false };
    if (
      queryOptions.isolationLevel &&
      !this.queryGenerator.dialect.supports.settingIsolationLevelDuringTransaction
    ) {
      const sql = this.queryGenerator.setIsolationLevelQuery(queryOptions.isolationLevel);
      await this.sequelize.queryRaw(sql, queryOptions);
    }

    const sql = this.queryGenerator.startTransactionQuery(options);
    await this.sequelize.queryRaw(sql, queryOptions);
    if (
      queryOptions.isolationLevel &&
      this.sequelize.dialect.supports.settingIsolationLevelDuringTransaction
    ) {
      await transaction.setIsolationLevel(queryOptions.isolationLevel);
    }
  }

  /**
   * Deletes records from a table
   *
   * @param tableOrModel
   * @param options
   */
  async bulkDelete(tableOrModel: TableOrModel, options?: QiBulkDeleteOptions): Promise<number> {
    const bulkDeleteOptions = { ...options };
    const sql = this.queryGenerator.bulkDeleteQuery(tableOrModel, bulkDeleteOptions);
    // unlike bind, replacements are handled by QueryGenerator, not QueryRaw
    delete bulkDeleteOptions.replacements;

    return this.sequelize.queryRaw(sql, {
      ...bulkDeleteOptions,
      raw: true,
      type: QueryTypes.DELETE,
    });
  }
}
