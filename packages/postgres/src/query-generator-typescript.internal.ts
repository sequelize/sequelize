import type {
  CreateDatabaseQueryOptions,
  Expression,
  ListDatabasesQueryOptions,
  ListSchemasQueryOptions,
  ListTablesQueryOptions,
  RemoveIndexQueryOptions,
  RenameTableQueryOptions,
  ShowConstraintsQueryOptions,
  TableOrModel,
  TruncateTableQueryOptions,
} from '@sequelize/core';
import { AbstractQueryGenerator } from '@sequelize/core';
import type { EscapeOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator-typescript.js';
import { CREATE_DATABASE_QUERY_SUPPORTABLE_OPTIONS } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator-typescript.js';
import { rejectInvalidOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import { joinSQLFragments } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/join-sql-fragments.js';
import { generateIndexName } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/string.js';
import semver from 'semver';
import type { PostgresDialect } from './dialect.js';
import { PostgresQueryGeneratorInternal } from './query-generator.internal.js';

const CREATE_DATABASE_QUERY_SUPPORTED_OPTIONS = new Set<keyof CreateDatabaseQueryOptions>([
  'collate',
  'ctype',
  'encoding',
  'template',
]);

/**
 * Temporary class to ease the TypeScript migration
 */
export class PostgresQueryGeneratorTypeScript extends AbstractQueryGenerator {
  readonly #internals: PostgresQueryGeneratorInternal;

  constructor(
    dialect: PostgresDialect,
    internals: PostgresQueryGeneratorInternal = new PostgresQueryGeneratorInternal(dialect),
  ) {
    super(dialect, internals);

    this.#internals = internals;
  }

  listDatabasesQuery(options?: ListDatabasesQueryOptions) {
    let databasesToSkip = this.#internals.getTechnicalDatabaseNames();
    if (options && Array.isArray(options?.skip)) {
      databasesToSkip = [...databasesToSkip, ...options.skip];
    }

    return joinSQLFragments([
      'SELECT datname AS "name" FROM pg_database',
      `WHERE datistemplate = false AND datname NOT IN (${databasesToSkip.map(database => this.escape(database)).join(', ')})`,
    ]);
  }

  createDatabaseQuery(database: string, options?: CreateDatabaseQueryOptions) {
    if (options) {
      rejectInvalidOptions(
        'createDatabaseQuery',
        this.dialect,
        CREATE_DATABASE_QUERY_SUPPORTABLE_OPTIONS,
        CREATE_DATABASE_QUERY_SUPPORTED_OPTIONS,
        options,
      );
    }

    return joinSQLFragments([
      `CREATE DATABASE ${this.quoteIdentifier(database)}`,
      options?.encoding ? `ENCODING = ${this.escape(options.encoding)}` : '',
      options?.collate ? `LC_COLLATE = ${this.escape(options.collate)}` : '',
      options?.ctype ? `LC_CTYPE = ${this.escape(options.ctype)}` : '',
      options?.template ? `TEMPLATE = ${this.escape(options.template)}` : '',
    ]);
  }

  listSchemasQuery(options?: ListSchemasQueryOptions) {
    const schemasToSkip = ['public', ...this.#internals.getTechnicalSchemaNames()];

    if (options && Array.isArray(options?.skip)) {
      schemasToSkip.push(...options.skip);
    }

    return joinSQLFragments([
      `SELECT schema_name AS "schema" FROM information_schema.schemata`,
      `WHERE schema_name !~ E'^pg_' AND schema_name NOT IN (${schemasToSkip.map(schema => this.escape(schema)).join(', ')})`,
    ]);
  }

  describeTableQuery(tableName: TableOrModel) {
    const table = this.extractTableDetails(tableName);

    return joinSQLFragments([
      'SELECT',
      'pk.constraint_type as "Constraint",',
      'c.column_name as "Field",',
      'c.column_default as "Default",',
      'c.is_nullable as "Null",',
      `(CASE WHEN c.udt_name = 'hstore' THEN c.udt_name ELSE c.data_type END) || (CASE WHEN c.character_maximum_length IS NOT NULL THEN '(' || c.character_maximum_length || ')' ELSE '' END) as "Type",`,
      '(SELECT array_agg(e.enumlabel) FROM pg_catalog.pg_type t JOIN pg_catalog.pg_enum e ON t.oid=e.enumtypid WHERE t.typname=c.udt_name) AS "special",',
      '(SELECT pgd.description FROM pg_catalog.pg_statio_all_tables AS st INNER JOIN pg_catalog.pg_description pgd on (pgd.objoid=st.relid) WHERE c.ordinal_position=pgd.objsubid AND c.table_name=st.relname) AS "Comment"',
      'FROM information_schema.columns c',
      'LEFT JOIN (SELECT tc.table_schema, tc.table_name,',
      'cu.column_name, tc.constraint_type',
      'FROM information_schema.TABLE_CONSTRAINTS tc',
      'JOIN information_schema.KEY_COLUMN_USAGE  cu',
      'ON tc.table_schema=cu.table_schema and tc.table_name=cu.table_name',
      'and tc.constraint_name=cu.constraint_name',
      `and tc.constraint_type='PRIMARY KEY') pk`,
      'ON pk.table_schema=c.table_schema',
      'AND pk.table_name=c.table_name',
      'AND pk.column_name=c.column_name',
      `WHERE c.table_name = ${this.escape(table.tableName)}`,
      `AND c.table_schema = ${this.escape(table.schema)}`,
    ]);
  }

  listTablesQuery(options?: ListTablesQueryOptions) {
    return joinSQLFragments([
      'SELECT table_name AS "tableName", table_schema AS "schema"',
      `FROM information_schema.tables WHERE table_type = 'BASE TABLE' AND table_name != 'spatial_ref_sys'`,
      options?.schema
        ? `AND table_schema = ${this.escape(options.schema)}`
        : `AND table_schema !~ E'^pg_' AND table_schema NOT IN (${this.#internals
            .getTechnicalSchemaNames()
            .map(schema => this.escape(schema))
            .join(', ')})`,
      'ORDER BY table_schema, table_name',
    ]);
  }

  renameTableQuery(
    beforeTableName: TableOrModel,
    afterTableName: TableOrModel,
    options?: RenameTableQueryOptions,
  ): string {
    const beforeTable = this.extractTableDetails(beforeTableName);
    const afterTable = this.extractTableDetails(afterTableName);

    if (beforeTable.schema !== afterTable.schema) {
      if (!options?.changeSchema) {
        throw new Error(
          'To move a table between schemas, you must set `options.changeSchema` to true.',
        );
      }

      if (beforeTable.tableName !== afterTable.tableName) {
        throw new Error(
          `Renaming a table and moving it to a different schema is not supported by ${this.dialect.name}.`,
        );
      }

      return `ALTER TABLE ${this.quoteTable(beforeTableName)} SET SCHEMA ${this.quoteIdentifier(afterTable.schema)}`;
    }

    return `ALTER TABLE ${this.quoteTable(beforeTableName)} RENAME TO ${this.quoteIdentifier(afterTable.tableName)}`;
  }

  truncateTableQuery(tableName: TableOrModel, options?: TruncateTableQueryOptions) {
    return joinSQLFragments([
      `TRUNCATE ${this.quoteTable(tableName)}`,
      options?.restartIdentity ? 'RESTART IDENTITY' : '',
      options?.cascade ? 'CASCADE' : '',
    ]);
  }

  showConstraintsQuery(tableName: TableOrModel, options?: ShowConstraintsQueryOptions) {
    const table = this.extractTableDetails(tableName);

    // Postgres converts camelCased alias to lowercase unless quoted
    return joinSQLFragments([
      'SELECT c.constraint_catalog AS "constraintCatalog",',
      'c.constraint_schema AS "constraintSchema",',
      'c.constraint_name AS "constraintName",',
      'c.constraint_type AS "constraintType",',
      'c.table_catalog AS "tableCatalog",',
      'c.table_schema AS "tableSchema",',
      'c.table_name AS "tableName",',
      'kcu.column_name AS "columnNames",',
      'ccu.table_schema AS "referencedTableSchema",',
      'ccu.table_name AS "referencedTableName",',
      'ccu.column_name AS "referencedColumnNames",',
      'r.delete_rule AS "deleteAction",',
      'r.update_rule AS "updateAction",',
      'pg_get_expr(pgc.conbin, pgc.conrelid) AS "definition",',
      'c.is_deferrable AS "isDeferrable",',
      'c.initially_deferred AS "initiallyDeferred"',
      'FROM INFORMATION_SCHEMA.table_constraints c',
      'LEFT JOIN INFORMATION_SCHEMA.referential_constraints r ON c.constraint_catalog = r.constraint_catalog AND c.constraint_schema = r.constraint_schema AND c.constraint_name = r.constraint_name',
      'LEFT JOIN INFORMATION_SCHEMA.key_column_usage kcu ON c.constraint_catalog = kcu.constraint_catalog AND c.constraint_schema = kcu.constraint_schema AND c.constraint_name = kcu.constraint_name',
      'LEFT JOIN information_schema.constraint_column_usage AS ccu ON r.constraint_catalog = ccu.constraint_catalog AND r.constraint_schema = ccu.constraint_schema AND r.constraint_name = ccu.constraint_name',
      'LEFT JOIN pg_constraint pgc ON c.constraint_name = pgc.conname AND c.table_schema = (SELECT nspname FROM pg_namespace WHERE oid = pgc.connamespace) AND c.table_name = pgc.conrelid::regclass::text',
      `WHERE c.table_name = ${this.escape(table.tableName)}`,
      `AND c.table_schema = ${this.escape(table.schema)}`,
      options?.columnName ? `AND kcu.column_name = ${this.escape(options.columnName)}` : '',
      options?.constraintName
        ? `AND c.constraint_name = ${this.escape(options.constraintName)}`
        : '',
      options?.constraintType
        ? `AND c.constraint_type = ${this.escape(options.constraintType)}`
        : '',
      'ORDER BY c.constraint_name, kcu.ordinal_position, ccu.column_name',
    ]);
  }

  showIndexesQuery(tableName: TableOrModel) {
    const table = this.extractTableDetails(tableName);

    // TODO [>=6]: refactor the query to use pg_indexes
    return joinSQLFragments([
      'SELECT i.relname AS name, ix.indisprimary AS primary, ix.indisunique AS unique, ix.indkey[:ix.indnkeyatts-1] AS index_fields,',
      'ix.indkey[ix.indnkeyatts:] AS include_fields, array_agg(a.attnum) as column_indexes, array_agg(a.attname) AS column_names,',
      'pg_get_indexdef(ix.indexrelid) AS definition FROM pg_class t, pg_class i, pg_index ix, pg_attribute a , pg_namespace s',
      'WHERE t.oid = ix.indrelid AND i.oid = ix.indexrelid AND a.attrelid = t.oid AND',
      `t.relkind = 'r' and t.relname = ${this.escape(table.tableName)}`,
      `AND s.oid = t.relnamespace AND s.nspname = ${this.escape(table.schema)}`,
      'GROUP BY i.relname, ix.indexrelid, ix.indisprimary, ix.indisunique, ix.indkey, ix.indnkeyatts ORDER BY i.relname;',
    ]);
  }

  removeIndexQuery(
    tableName: TableOrModel,
    indexNameOrAttributes: string | string[],
    options?: RemoveIndexQueryOptions,
  ) {
    if (options?.cascade && options?.concurrently) {
      throw new Error(
        `Cannot specify both concurrently and cascade options in removeIndexQuery for ${this.dialect.name} dialect`,
      );
    }

    let indexName;
    const table = this.extractTableDetails(tableName);
    if (Array.isArray(indexNameOrAttributes)) {
      indexName = generateIndexName(table, { fields: indexNameOrAttributes });
    } else {
      indexName = indexNameOrAttributes;
    }

    return joinSQLFragments([
      'DROP INDEX',
      options?.concurrently ? 'CONCURRENTLY' : '',
      options?.ifExists ? 'IF EXISTS' : '',
      `${this.quoteIdentifier(table.schema)}.${this.quoteIdentifier(indexName)}`,
      options?.cascade ? 'CASCADE' : '',
    ]);
  }

  jsonPathExtractionQuery(
    sqlExpression: string,
    path: ReadonlyArray<number | string>,
    unquote: boolean,
  ): string {
    const operator = path.length === 1 ? (unquote ? '->>' : '->') : unquote ? '#>>' : '#>';

    const pathSql =
      path.length === 1
        ? // when accessing an array index with ->, the index must be a number
          // when accessing an object key with ->, the key must be a string
          this.escape(path[0])
        : // when accessing with #>, the path is always an array of strings
          this.escape(path.map(value => String(value)));

    return sqlExpression + operator + pathSql;
  }

  formatUnquoteJson(arg: Expression, options?: EscapeOptions) {
    return `${this.escape(arg, options)}#>>ARRAY[]::TEXT[]`;
  }

  getUuidV1FunctionCall(): string {
    return 'uuid_generate_v1()';
  }

  getUuidV4FunctionCall(): string {
    const dialectVersion = this.sequelize.getDatabaseVersion();

    if (semver.lt(dialectVersion, '13.0.0')) {
      return 'uuid_generate_v4()';
    }

    // uuid_generate_v4 requires the uuid-ossp extension, which is not installed by default.
    // This has broader support, as it is part of the core Postgres distribution, but is only available since Postgres 13.
    return 'gen_random_uuid()';
  }

  versionQuery() {
    return 'SHOW SERVER_VERSION';
  }
}
