import assert from 'node:assert';
import isEmpty from 'lodash/isEmpty';
import { Deferrable } from '../../deferrable';
import type { ConstraintChecking } from '../../deferrable';
import { BaseError } from '../../errors';
import { Model } from '../../model';
import type { AttributeOptions, ModelStatic } from '../../model';
import { setTransactionFromCls } from '../../model-internals.js';
import { QueryTypes } from '../../query-types';
import type { QueryRawOptions, QueryRawOptionsWithType, Sequelize } from '../../sequelize';
import {
  deleteToBulkDelete,
  noSchemaDelimiterParameter,
  noSchemaParameter,
  showAllToListSchemas,
  showAllToListTables,
} from '../../utils/deprecations';
import { assertNoReservedBind, combineBinds } from '../../utils/sql';
import type { RequiredBy } from '../../utils/types';
import type { Connection } from './connection-manager.js';
import type { TableNameOrModel } from './query-generator-typescript.js';
import { AbstractQueryInterfaceInternal } from './query-interface-internal.js';
import type { TableNameWithSchema } from './query-interface.js';
import type {
  AddConstraintOptions,
  BulkDeleteOptions,
  ColumnsDescription,
  ConstraintDescription,
  CreateDatabaseOptions,
  CreateSchemaOptions,
  DatabaseDescription,
  DeferConstraintsOptions,
  DescribeTableOptions,
  DropSchemaOptions,
  FetchDatabaseVersionOptions,
  ListDatabasesOptions,
  QiBulkInsertOptions,
  QiDropAllSchemasOptions,
  QiDropAllTablesOptions,
  QiDropTableOptions,
  QiInsertOptions,
  QiListSchemasOptions,
  QiListTablesOptions,
  QiTruncateTableOptions,
  RemoveColumnOptions,
  RemoveConstraintOptions,
  RenameTableOptions,
  ShowConstraintsOptions,
} from './query-interface.types';
import type { AbstractDialect } from './index.js';

export type WithoutForeignKeyChecksCallback<T> = (connection: Connection) => Promise<T>;

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
  constructor(
    dialect: Dialect,
    internalQueryInterface?: AbstractQueryInterfaceInternal,
  ) {
    this.dialect = dialect;
    this.#internalQueryInterface = internalQueryInterface ?? new AbstractQueryInterfaceInternal(dialect);
  }

  get sequelize(): Sequelize {
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

    return this.sequelize.queryRaw<DatabaseDescription>(sql, { ...options, type: QueryTypes.SELECT });
  }

  /**
   * Returns the database version.
   *
   * @param options Query Options
   */
  async fetchDatabaseVersion(options?: FetchDatabaseVersionOptions): Promise<string> {
    const payload = await this.#internalQueryInterface.fetchDatabaseVersionRaw<{ version: string }>(options);

    assert(payload.version != null, 'Expected the version query to produce an object that includes a `version` property.');

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
  async dropTable(tableName: TableNameOrModel, options?: QiDropTableOptions): Promise<void> {
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
      const foreignKeys = await this.showConstraints(tableName, { ...options, constraintType: 'FOREIGN KEY' });
      // eslint-disable-next-line no-await-in-loop
      await Promise.all(foreignKeys.map(async fk => this.removeConstraint(tableName, fk.constraintName, options)));
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

    return this.sequelize.queryRaw<TableNameWithSchema>(sql, { ...options, raw: true, type: QueryTypes.SELECT });
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
    beforeTableName: TableNameOrModel,
    afterTableName: TableNameOrModel,
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
  async tableExists(tableName: TableNameOrModel, options?: QueryRawOptions): Promise<boolean> {
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
  async describeTable(tableName: TableNameOrModel, options?: DescribeTableOptions): Promise<ColumnsDescription> {
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
    const queryOptions: QueryRawOptionsWithType<QueryTypes.DESCRIBE> = { ...options, type: QueryTypes.DESCRIBE };

    try {
      const data = await this.sequelize.queryRaw(sql, queryOptions);
      /*
       * If no data is returned from the query, then the table name may be wrong.
       * Query generators that use information_schema for retrieving table info will just return an empty result set,
       * it will not throw an error like built-ins do (e.g. DESCRIBE on MySql).
       */
      if (isEmpty(data)) {
        throw new Error(`No description found for table ${table.tableName}${table.schema ? ` in schema ${table.schema}` : ''}. Check the table name and schema; remember, they _are_ case sensitive.`);
      }

      return data;
    } catch (error: unknown) {
      if (error instanceof BaseError && error.cause?.code === 'ER_NO_SUCH_TABLE') {
        throw new Error(`No description found for table ${table.tableName}${table.schema ? ` in schema ${table.schema}` : ''}. Check the table name and schema; remember, they _are_ case sensitive.`);
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
  async truncate(tableName: TableNameOrModel, options?: QiTruncateTableOptions): Promise<void> {
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
    tableName: TableNameOrModel,
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
  async addConstraint(tableName: TableNameOrModel, options: AddConstraintOptions): Promise<void> {
    if (!options.fields) {
      throw new Error('Fields must be specified through options.fields');
    }

    if (!options.type) {
      throw new Error('Constraint type must be specified through options.type');
    }

    const sql = this.queryGenerator.addConstraintQuery(tableName, options);

    await this.sequelize.queryRaw(sql, { ...options, raw: true, type: QueryTypes.RAW });
  }

  async deferConstraints(constraintChecking: ConstraintChecking, options?: DeferConstraintsOptions): Promise<void> {
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
    tableName: TableNameOrModel,
    constraintName: string,
    options?: RemoveConstraintOptions,
  ): Promise<void> {
    const sql = this.queryGenerator.removeConstraintQuery(tableName, constraintName, options);

    await this.sequelize.queryRaw(sql, { ...options, raw: true, type: QueryTypes.RAW });
  }

  async showConstraints(tableName: TableNameOrModel, options?: ShowConstraintsOptions): Promise<ConstraintDescription[]> {
    const sql = this.queryGenerator.showConstraintsQuery(tableName, options);
    const rawConstraints = await this.sequelize.queryRaw(sql, { ...options, raw: true, type: QueryTypes.SHOWCONSTRAINTS });
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
          constraintData.deferrable = isDeferrable ? (initiallyDeferred === 'YES' ? Deferrable.INITIALLY_DEFERRED : Deferrable.INITIALLY_IMMEDIATE) : Deferrable.NOT;
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
  getForeignKeysForTables(_tableNames: TableNameOrModel[], _options?: QueryRawOptions): Error {
    throw new Error(`getForeignKeysForTables has been deprecated. Use showConstraints instead.`);
  }

  /**
   * Get foreign key references details for the table
   *
   * @deprecated Use {@link showConstraints} instead.
   * @param _tableName
   * @param _options
   */
  getForeignKeyReferencesForTable(_tableName: TableNameOrModel, _options?: QueryRawOptions): Error {
    throw new Error(`getForeignKeyReferencesForTable has been deprecated. Use showConstraints instead.`);
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
  async withoutForeignKeyChecks<T>(options: QueryRawOptions, cb: WithoutForeignKeyChecksCallback<T>): Promise<T>;
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

  async #withoutForeignKeyChecks<T>(options: QueryRawOptions, cb: WithoutForeignKeyChecksCallback<T>): Promise<T> {
    try {
      await this.unsafeToggleForeignKeyChecks(false, options);

      return await cb(options.connection!);
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
  async unsafeToggleForeignKeyChecks(
    enable: boolean,
    options?: QueryRawOptions,
  ): Promise<void> {
    await this.sequelize.queryRaw(this.queryGenerator.getToggleForeignKeyChecksQuery(enable), options);
  }

  /**
   * Delete records from a table
   *
   * @param tableName
   * @param options
   */
  async delete(tableName: TableNameOrModel, options: RequiredBy<BulkDeleteOptions, 'where'>): Promise<number> {
    deleteToBulkDelete();
    const deleteOptions = { ...options };
    const sql = this.queryGenerator.bulkDeleteQuery(tableName, deleteOptions);
    // unlike bind, replacements are handled by QueryGenerator, not QueryRaw
    delete deleteOptions.replacements;

    return this.sequelize.queryRaw(sql, { ...deleteOptions, raw: true, type: QueryTypes.DELETE });
  }

  /**
   * Delete multiple records from a table
   *
   * @param tableName
   * @param options
   */
  async bulkDelete(tableName: TableNameOrModel, options?: BulkDeleteOptions): Promise<number> {
    const bulkDeleteOptions = { ...options };
    const sql = this.queryGenerator.bulkDeleteQuery(tableName, bulkDeleteOptions);
    // unlike bind, replacements are handled by QueryGenerator, not QueryRaw
    delete bulkDeleteOptions.replacements;

    return this.sequelize.queryRaw(sql, { ...bulkDeleteOptions, raw: true, type: QueryTypes.DELETE });
  }

  /**
   * Insert multiple records into a table
   *
   * @example
   * queryInterface.bulkInsert('roles', [{
   *    label: 'user',
   *    createdAt: new Date(),
   *    updatedAt: new Date()
   *  }, {
   *    label: 'admin',
   *    createdAt: new Date(),
   *    updatedAt: new Date()
   *  }]);
   *
   * @param tableName     Table name to insert record to
   * @param values        List of records to insert
   * @param options       Various options, please see Model.bulkCreate options
   * @param attributeHash Various attributes mapped by field name
   */
  async bulkInsert(
    tableName: TableNameOrModel,
    values: Array<Record<string, unknown>>,
    options?: QiBulkInsertOptions,
    attributeHash?: Record<string, AttributeOptions>,
  ): Promise<Array<Record<string, unknown>>> {
    const bulkInsertOptions = { ...options };
    const sql = this.queryGenerator.bulkInsertQuery(tableName, values, bulkInsertOptions, attributeHash);

    // unlike bind, replacements are handled by QueryGenerator, not QueryRaw
    delete bulkInsertOptions.replacements;

    const results = await this.sequelize.queryRaw<Array<Record<string, unknown>>>(sql, {
      ...bulkInsertOptions,
      type: QueryTypes.INSERT,
    });

    return results[0];
  }

  /**
   * Inserts a new record
   *
   * @param tableName
   * @param values
   * @param options
   * @param instanceOrAttributeHash
   */
  async insert<M extends Model>(
    tableName: TableNameOrModel,
    values: Record<string, unknown>,
    options?: QiInsertOptions,
    instanceOrAttributeHash?: M | Record<string, AttributeOptions>,
  ): Promise<[M | Record<string, unknown>, number]> {
    if (options?.bind) {
      assertNoReservedBind(options.bind);
    }

    let attributeHash: Record<string, AttributeOptions> | undefined;
    const insertOptions = { ...options };
    if (instanceOrAttributeHash instanceof Model) {
      const model = (instanceOrAttributeHash.constructor as ModelStatic<M>);
      insertOptions.model = model;
      insertOptions.instance = instanceOrAttributeHash;
      insertOptions.hasTrigger = model.modelDefinition.options.hasTrigger ?? false;
    } else {
      attributeHash = instanceOrAttributeHash;
    }

    const { query, bind } = this.queryGenerator.insertQuery(tableName, values, insertOptions, attributeHash);

    // unlike bind, replacements are handled by QueryGenerator, not QueryRaw
    delete insertOptions.replacements;
    insertOptions.bind = combineBinds(insertOptions.bind ?? {}, bind ?? {});

    if (instanceOrAttributeHash instanceof Model) {
      const results = await this.sequelize.queryRaw<M>(query, { ...insertOptions, type: QueryTypes.INSERT });
      results[0].isNewRecord = false;

      return results;
    }

    return this.sequelize.queryRaw(query, { ...insertOptions, type: QueryTypes.INSERT });
  }
}
