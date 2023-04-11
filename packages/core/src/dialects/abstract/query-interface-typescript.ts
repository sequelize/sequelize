import type { Connection } from './connection-manager.js';
import type { AbstractQueryGenerator } from './query-generator';
import type { QueryWithBindParams } from './query-generator.types';
import type { CreateSchemaOptions, QueryInterfaceOptions, ShowAllSchemasOptions } from './query-interface.types';
import { setTransactionFromCls } from '../../model-internals.js';
import { QueryTypes } from '../../query-types';
import type { QueryRawOptions, Sequelize } from '../../sequelize';

export type WithoutForeignKeyChecksCallback<T> = (connection: Connection) => Promise<T>;

// DO NOT MAKE THIS CLASS PUBLIC!
/**
 * This is a temporary class used to progressively migrate the AbstractQueryInterface class to TypeScript by slowly moving its functions here.
 * Always use {@link AbstractQueryInterface} instead.
 */
export class AbstractQueryInterfaceTypeScript {
  readonly sequelize: Sequelize;
  readonly queryGenerator: AbstractQueryGenerator;

  constructor(options: QueryInterfaceOptions) {
    this.sequelize = options.sequelize;
    this.queryGenerator = options.queryGenerator;
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
