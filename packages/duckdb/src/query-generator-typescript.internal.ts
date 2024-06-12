import { AbstractQueryGenerator, ListTablesQueryOptions } from '@sequelize/core';
import { DuckDbQueryGeneratorInternal } from "./query-generator.internal";
import { DuckDbDialect } from "./dialect";

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

  listTablesQuery(_options?: ListTablesQueryOptions): string {
    // TBD: handle optional options?.schema
    return "SELECT table_name, schema_name as schema FROM duckdb_tables()";
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

  createSchemaQuery(schemaName: string, options?: CreateSchemaQueryOptions): string {
    return super.createSchemaQuery(schemaName, options);
  }

  dropSchemaQuery(schemaName: string, options?: DropSchemaQueryOptions): string {
    return super.dropSchemaQuery(schemaName, options);
  }

  listSchemasQuery(_options?: ListSchemasQueryOptions): string {
    return super.listSchemasQuery(_options);
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

  removeConstraintQuery(tableName: TableOrModel, constraintName: string, options?: RemoveConstraintQueryOptions): string {
    return super.removeConstraintQuery(tableName, constraintName, options);
  }

  setConstraintCheckingQuery(type: ConstraintChecking | Class<ConstraintChecking>, constraints?: readonly string[]): string {
    return super.setConstraintCheckingQuery(type, constraints);
  }

  showConstraintsQuery(_tableName: TableOrModel, _options?: ShowConstraintsQueryOptions): string {
    return super.showConstraintsQuery(_tableName, _options);
  }

  showIndexesQuery(_tableName: TableOrModel): string {
    return super.showIndexesQuery(_tableName);
  }

  removeIndexQuery(_tableName: TableOrModel, _indexNameOrAttributes: string | string[], _options?: RemoveIndexQueryOptions): string {
    return super.removeIndexQuery(_tableName, _indexNameOrAttributes, _options);
  }

  getForeignKeyQuery(_tableName: TableOrModel, _columnName?: string): Error {
    return super.getForeignKeyQuery(_tableName, _columnName);
  }

  dropForeignKeyQuery(_tableName: TableOrModel, _foreignKey: string): Error {
    return super.dropForeignKeyQuery(_tableName, _foreignKey);
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

  startTransactionQuery(options?: StartTransactionQueryOptions): string {
    return super.startTransactionQuery(options);
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
