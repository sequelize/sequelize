import {
  AbstractQueryGenerator, ListSchemasQueryOptions,
  ListTablesQueryOptions, TruncateTableQueryOptions,
  ShowConstraintsQueryOptions, StartTransactionQueryOptions, TableName,
  TableOrModel, RenameTableQueryOptions
} from '@sequelize/core';
import { DuckDbQueryGeneratorInternal } from "./query-generator.internal";
import { DuckDbDialect } from "./dialect";
import { rejectInvalidOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import {
  TRUNCATE_TABLE_QUERY_SUPPORTABLE_OPTIONS,
  RENAME_TABLE_QUERY_SUPPORTABLE_OPTIONS,
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

    return `select col.column_name, col.data_type as column_type, col.is_nullable, col.column_default as default_value,
        (select count(*) from duckdb_constraints where col.database_oid = database_oid and col.schema_oid = schema_oid
         and col.table_oid = table_oid and array_contains(constraint_column_names, col.column_name)
         and constraint_type='PRIMARY KEY') > 0 as is_primary_key
         from duckdb_columns() col
         where col.table_name = '${table.tableName}' and col.schema_name = '${table.schema}'`;
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
    return super.startTransactionQuery(options);
  }

  listSchemasQuery(options?: ListSchemasQueryOptions): string {

    const schemasToSkip = [...this.#internals.getTechnicalSchemaNames()];
    if (options && Array.isArray(options?.skip)) {
      schemasToSkip.push(...options.skip);
    }

    return `SELECT schema_name as schema FROM duckdb_schemas()
        WHERE database_name = current_database()
        AND schema_name NOT IN (${schemasToSkip.map((schema) => this.escape(schema)).join(", ")})`;
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

  renameTableQuery(beforeTableName: TableOrModel, afterTableName: TableOrModel, options?: RenameTableQueryOptions): string {
    if (options) {
      rejectInvalidOptions(
          'renameTableQuery',
          this.dialect,
          RENAME_TABLE_QUERY_SUPPORTABLE_OPTIONS,
          {},
          options,
      );
    }

    const beforeTable = this.extractTableDetails(beforeTableName);
    const afterTable = this.extractTableDetails(afterTableName);
    if (beforeTable.schema !== afterTable.schema) {
      throw new Error(
          `Moving tables between schemas is not supported by ${this.dialect.name} dialect.`,
      );
    }

    return `ALTER TABLE ${this.quoteTable(beforeTableName)} RENAME TO ${this.quoteTable(afterTable.tableName)}`;
  }
}
