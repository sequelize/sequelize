import { QueryTypes } from '../../query-types';
import type { BindOrReplacements, QueryRawOptions, Sequelize } from '../../sequelize';
import type { AbstractQueryGenerator } from './query-generator';
import type { QueryGeneratorDropSchemaQueryObject } from './query-generator.types';
import type { CreateSchemaOptions, DropAllSchemasOptions, QueryInterfaceOptions, ShowAllSchemasOptions } from './query-interface.types';

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
   * **Note:** this is a schema in the [postgres sense of the word](http://www.postgresql.org/docs/9.1/static/ddl-schemas.html),
   * not a database table. In mysql and mariadb, this command will create what they call a database.
   *
   * @see
   * {@link Model.schema}
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
   * **Note:** this is a schema in the [postgres sense of the word](http://www.postgresql.org/docs/9.1/static/ddl-schemas.html),
   * not a database table. In mysql and mariadb, this drop a table matching the schema name.
   *
   * @param schema Name of the schema
   * @param options
   */
  async dropSchema(schema: string, options?: QueryRawOptions): Promise<void> {
    const dropSchemaQuery: string | QueryGeneratorDropSchemaQueryObject = this.queryGenerator.dropSchemaQuery(schema);

    let sql: string;
    let queryRawOptions = options;
    if (typeof dropSchemaQuery === 'string') {
      sql = dropSchemaQuery;
    } else {
      sql = dropSchemaQuery.query;

      // QueryRawOptions doesn't take undefined bind
      const bind = dropSchemaQuery.bind as BindOrReplacements;
      queryRawOptions = { ...options, bind };
    }

    await this.sequelize.queryRaw(sql, queryRawOptions);
  }

  /**
   * Drop all schemas.
   *
   * **Note:** this is a schema in the [postgres sense of the word](http://www.postgresql.org/docs/9.1/static/ddl-schemas.html),
   * not a database table. In mysql and mariadb, this is the equivalent of drop all databases.
   *
   * @param options
   */
  async dropAllSchemas(options?: DropAllSchemasOptions): Promise<void> {
    const schemas = await this.showAllSchemas();

    let schemasToDrop = schemas;
    if (options?.skip) {
      schemasToDrop = schemas.filter(schema => !options.skip!.includes(schema));
    }

    await Promise.all(schemasToDrop.map(async schema => this.dropSchema(schema, options)));
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
}
