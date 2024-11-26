import {
  AbstractQueryGenerator, ListSchemasQueryOptions,
  ListTablesQueryOptions, NormalizedAttributeOptions, TruncateTableQueryOptions,
  ShowConstraintsQueryOptions, StartTransactionQueryOptions, TableName,
  TableOrModel
} from '@sequelize/core';
import { DuckDbQueryGeneratorInternal } from "./query-generator.internal";
import { DuckDbDialect } from "./dialect";
import { rejectInvalidOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import {
  TRUNCATE_TABLE_QUERY_SUPPORTABLE_OPTIONS
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator-typescript.js';

export class DuckDbQueryGeneratorTypeScript extends AbstractQueryGenerator {
  readonly #internals: DuckDbQueryGeneratorInternal;

  constructor(
    dialect: DuckDbDialect,
    internals: DuckDbQueryGeneratorInternal = new DuckDbQueryGeneratorInternal(dialect),
  ) {
    super(dialect, internals);

    this.#internals = internals;
  }

  versionQuery(): string {
    return 'SELECT library_version as version from pragma_version()';
  }

  listTablesQuery(options?: ListTablesQueryOptions): string {
    let sql = 'SELECT table_name as tableName, schema_name as schema FROM duckdb_tables()';
    if (options?.schema) {
      sql += ` WHERE schema_name = ${this.escape(options.schema)}`;
    }

    return sql;
  }

  describeTableQuery(tableName: TableOrModel) {
    const table = this.extractTableDetails(tableName);
    let sql = 'SELECT column_name, data_type as column_type, is_nullable, column_default as default_value, comment';
    // TBD: restrict by catalog also
    sql += ' FROM duckdb_columns()';
    sql += ` WHERE table_name = '${table.tableName}' and schema_name = '${table.schema}'`;
    return sql;
  }

  // copied from sqlite
  private escapeTable(tableName: TableOrModel): string {
    const table = this.extractTableDetails(tableName);

    if (table.schema) {
      return this.escape(`${table.schema}${table.delimiter}${table.tableName}`);
    }

    return this.escape(table.tableName);
  }

  showConstraintsQuery(tableName: TableOrModel, options?: ShowConstraintsQueryOptions): string {
    const table = this.extractTableDetails(tableName);

    let sql = `SELECT constraint_column_names as columnNames,
        schema_name as referencedTableSchema,
        table_name as referencedTableName,
        constraint_text as definition,
        FROM duckdb_constraints()
        WHERE table_name = ${this.escape(table.tableName)}`;
    if (table.schema) {
      sql += ` AND schema_name = ${this.escape(table.schema)}`;
    }

    if (options?.constraintType) {
      sql += ` AND constraint_type = ${this.escape(options.constraintType)}`;
    }

    if (options?.constraintName) {
      sql += ` AND constraint_name = ${this.escape(options.constraintName)}`;
    }

    if (options?.columnName) {
      sql += ` AND contains(constraint_column_names, ${this.escape(options.columnName)})`;
    }

    return sql;
  }

  showIndexesQuery(tableName: TableOrModel): string {
    const table = this.extractTableDetails(tableName);

    let sql = `FROM duckdb_indexes() WHERE table_name = ${this.escape(table.tableName)}`;
    if (table.schema) {
      sql += ` AND schema_name = ${this.escape(table.schema)}`;
    }

    return sql;
  }

  startTransactionQuery(options?: StartTransactionQueryOptions): string {
    //console.log("************** DUCKDB START TRANSACTION: ", options);
    return super.startTransactionQuery(options);
  }

  listSchemasQuery(options?: ListSchemasQueryOptions): string {

    const schemasToSkip = [...this.#internals.getTechnicalSchemaNames()];
    if (options && Array.isArray(options?.skip)) {
      schemasToSkip.push(...options.skip);
    }

    return `SELECT schema_name as schema FROM duckdb_schemas() WHERE schema_name NOT IN (${schemasToSkip.map((schema) => this.escape(schema)).join(", ")})`;
  }

  truncateTableQuery(tableName: TableOrModel, options?: TruncateTableQueryOptions) {
    if (options) {
      rejectInvalidOptions(
          'truncateTableQuery',
          this.dialect,
          TRUNCATE_TABLE_QUERY_SUPPORTABLE_OPTIONS,
          {},
          options,
      );
    }

    return  `TRUNCATE ${this.quoteTable(tableName)}`;
  }

  /* createDatabaseQuery(_database: string, _options?: CreateDatabaseQueryOptions): string {
     return super.createDatabaseQuery(_database, _options);
   }

   dropDatabaseQuery(database: string): string {
     return super.dropDatabaseQuery(database);
   }

   listDatabasesQuery(_options?: ListDatabasesQueryOptions): string {
     return super.listDatabasesQuery(_options);
   }



   describeTableQuery(tableName: TableOrModel): string {
     return super.describeTableQuery(tableName);
   }

   dropTableQuery(tableName: TableOrModel, options?: DropTableQueryOptions): string {
     return super.dropTableQuery(tableName, options);
   }

   renameTableQuery(beforeTableName: TableOrModel, afterTableName: TableOrModel, options?: RenameTableQueryOptions): string {
     return super.renameTableQuery(beforeTableName, afterTableName, options);
   }

   truncateTableQuery(_tableName: TableOrModel, _options?: TruncateTableQueryOptions): string | string[] {
     return super.truncateTableQuery(_tableName, _options);
   }

   removeColumnQuery(tableName: TableOrModel, columnName: string, options?: RemoveColumnQueryOptions): string {
     return super.removeColumnQuery(tableName, columnName, options);
   }

   addConstraintQuery(tableName: TableOrModel, options: AddConstraintQueryOptions): string {
     return super.addConstraintQuery(tableName, options);
   }


   setConstraintCheckingQuery(type: ConstraintChecking | Class<ConstraintChecking>, constraints?: readonly string[]): string {
     return super.setConstraintCheckingQuery(type, constraints);
   }





   removeIndexQuery(_tableName: TableOrModel, _indexNameOrAttributes: string | string[], _options?: RemoveIndexQueryOptions): string {
     return super.removeIndexQuery(_tableName, _indexNameOrAttributes, _options);
   }

   getForeignKeyQuery(_tableName: TableOrModel, _columnName?: string): Error {
     return super.getForeignKeyQuery(_tableName, _columnName);
   }

   commitTransactionQuery(): string {
     return super.commitTransactionQuery();
   }

   createSavepointQuery(savepointName: string): string {
     return super.createSavepointQuery(savepointName);
   }

   rollbackSavepointQuery(savepointName: string): string {
     return super.rollbackSavepointQuery(savepointName);
   }

   rollbackTransactionQuery(): string {
     return super.rollbackTransactionQuery();
   }

   setIsolationLevelQuery(isolationLevel: IsolationLevel): string {
     return super.setIsolationLevelQuery(isolationLevel);
   }


   generateTransactionId(): string {
     return super.generateTransactionId();
   }

   extractTableDetails(tableOrModel: TableOrModel, options?: {
     schema?: string;
     delimiter?: string
   }): RequiredBy<TableNameWithSchema, "schema"> {
     return super.extractTableDetails(tableOrModel, options);
   }

   quoteTable(param: TableOrModel, options?: QuoteTableOptions): string {
     return super.quoteTable(param, options);
   }

   quoteIdentifier(identifier: string, _force?: boolean): string {
     return super.quoteIdentifier(identifier, _force);
   }

   isSameTable(tableA: TableOrModel, tableB: TableOrModel): boolean | boolean {
     return super.isSameTable(tableA, tableB);
   }

   whereQuery<M extends Model>(where: WhereOptions<Attributes<M>>, options?: FormatWhereOptions): string | string {
     return super.whereQuery(where, options);
   }

   whereItemsQuery<M extends Model>(where: WhereOptions<Attributes<M>> | undefined, options?: FormatWhereOptions): string {
     return super.whereItemsQuery(where, options);
   }

   formatSqlExpression(piece: BaseSqlExpression, options?: EscapeOptions): string {
     return super.formatSqlExpression(piece, options);
   }

   formatUnquoteJson(_arg: Expression, _options: EscapeOptions | undefined): string {
     return super.formatUnquoteJson(_arg, _options);
   }

   jsonPathExtractionQuery(_sqlExpression: string, _path: ReadonlyArray<number | string>, _unquote: boolean): string {
     return super.jsonPathExtractionQuery(_sqlExpression, _path, _unquote);
   }

   escape(value: unknown, options: EscapeOptions = EMPTY_OBJECT): string {
     return super.escape(value, options);
   }

   escapeList(values: unknown[], options?: EscapeOptions): string {
     return super.escapeList(values, options);
   }

   getUuidV1FunctionCall(): string {
     return super.getUuidV1FunctionCall();
   }

   getUuidV4FunctionCall(): string {
     return super.getUuidV4FunctionCall();
   }

   getToggleForeignKeyChecksQuery(_enable: boolean): string {
     return super.getToggleForeignKeyChecksQuery(_enable);
   }

   tableExistsQuery(tableName: TableOrModel): string {
     return super.tableExistsQuery(tableName);
   }

   bulkDeleteQuery(tableOrModel: TableOrModel, options: BulkDeleteQueryOptions): string {
     return super.bulkDeleteQuery(tableOrModel, options);
   }

   __TEST__getInternals(): AbstractQueryGeneratorInternal<AbstractDialect> {
     return super.__TEST__getInternals();
   }
 */
}
