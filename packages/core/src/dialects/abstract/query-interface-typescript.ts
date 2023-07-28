import assert from 'node:assert';
import isEmpty from 'lodash/isEmpty';
import type { ConstraintChecking } from '../../deferrable';
import { BaseError } from '../../errors';
import { setTransactionFromCls } from '../../model-internals.js';
import { QueryTypes } from '../../query-types';
import type { QueryRawOptions, QueryRawOptionsWithType, Sequelize } from '../../sequelize';
import { noSchemaDelimiterParameter, noSchemaParameter } from '../../utils/deprecations';
import type { Connection } from './connection-manager.js';
import type { AbstractQueryGenerator } from './query-generator';
import type { TableNameOrModel } from './query-generator-typescript.js';
import type { QueryWithBindParams } from './query-generator.types';
import { AbstractQueryInterfaceInternal } from './query-interface-internal.js';
import type {
  AddConstraintOptions,
  ColumnsDescription,
  ConstraintDescription,
  CreateSchemaOptions,
  DeferConstraintsOptions,
  DescribeTableOptions,
  FetchDatabaseVersionOptions,
  RawConstraintDescription,
  RemoveConstraintOptions,
  ShowAllSchemasOptions,
  ShowConstraintsOptions,
} from './query-interface.types';

export type WithoutForeignKeyChecksCallback<T> = (connection: Connection) => Promise<T>;

export interface MapConstraintDescription extends Omit<RawConstraintDescription, 'columnNames' | 'referencedColumnNames'> {
  columnNames: Set<string>;
  referencedColumnNames: Set<string>;
}

// DO NOT MAKE THIS CLASS PUBLIC!
/**
 * This is a temporary class used to progressively migrate the AbstractQueryInterface class to TypeScript by slowly moving its functions here.
 * Always use {@link AbstractQueryInterface} instead.
 */
export class AbstractQueryInterfaceTypeScript {
  readonly sequelize: Sequelize;
  readonly queryGenerator: AbstractQueryGenerator;
  readonly #internalQueryInterface: AbstractQueryInterfaceInternal;

  /**
   * @param sequelize The sequelize instance.
   * @param queryGenerator The query generator of the dialect used by the current Sequelize instance.
   * @param internalQueryInterface The internal query interface to use.
   *                               Defaults to a new instance of {@link AbstractQueryInterfaceInternal}.
   *                               Your dialect may replace this with a custom implementation.
   */
  constructor(
    sequelize: Sequelize,
    queryGenerator: AbstractQueryGenerator,
    internalQueryInterface?: AbstractQueryInterfaceInternal,
  ) {
    this.sequelize = sequelize;
    this.queryGenerator = queryGenerator;
    this.#internalQueryInterface = internalQueryInterface ?? new AbstractQueryInterfaceInternal(sequelize, queryGenerator);
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
  async dropSchema(schema: string, options?: QueryRawOptions): Promise<void> {
    const dropSchemaQuery: string | QueryWithBindParams = this.queryGenerator.dropSchemaQuery(schema);

    let sql: string;
    let queryRawOptions: undefined | QueryRawOptions;
    if (typeof dropSchemaQuery === 'string') {
      sql = dropSchemaQuery;
      queryRawOptions = options;
    } else {
      sql = dropSchemaQuery.query;
      queryRawOptions = { ...options, bind: dropSchemaQuery.bind };
    }

    await this.sequelize.queryRaw(sql, queryRawOptions);
  }

  /**
   * Show all defined schemas
   *
   * **Note:** this is a schema in the [postgres sense of the word](http://www.postgresql.org/docs/9.1/static/ddl-schemas.html),
   * not a database table. In mysql and mariadb, this will show all databases.
   *
   * @param options
   *
   * @returns list of schemas
   */
  async showAllSchemas(options?: ShowAllSchemasOptions): Promise<string[]> {
    const showSchemasSql = this.queryGenerator.listSchemasQuery(options);
    const queryRawOptions = {
      ...options,
      raw: true,
      type: QueryTypes.SELECT,
    };

    const schemaNames = await this.sequelize.queryRaw(showSchemasSql, queryRawOptions);

    return schemaNames.flatMap((value: any) => (value.schema_name ? value.schema_name : value));
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
    const constraintMap = new Map<string, MapConstraintDescription>();
    for (const rawConstraint of rawConstraints) {
      const constraint = constraintMap.get(rawConstraint.constraintName)!;
      if (constraint) {
        rawConstraint.columnNames && constraint.columnNames.add(rawConstraint.columnNames);
        rawConstraint.referencedColumnNames && constraint.referencedColumnNames.add(rawConstraint.referencedColumnNames);
      } else {
        constraintMap.set(rawConstraint.constraintName, {
          ...rawConstraint,
          columnNames: new Set(rawConstraint.columnNames ? [rawConstraint.columnNames] : []),
          referencedColumnNames: new Set(rawConstraint.referencedColumnNames ? [rawConstraint.referencedColumnNames] : []),
        });
      }
    }

    return [...constraintMap.values()].map(({ columnNames, referencedColumnNames, ...constraint }) => ({
      ...constraint,
      columnNames: [...columnNames],
      referencedColumnNames: [...referencedColumnNames],
    }));
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
}
