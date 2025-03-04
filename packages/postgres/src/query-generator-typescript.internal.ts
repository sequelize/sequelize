import type {
  AddIndexQueryOptions,
  CreateDatabaseQueryOptions,
  Expression,
  ListDatabasesQueryOptions,
  ListSchemasQueryOptions,
  ListTablesQueryOptions,
  RenameTableQueryOptions,
  ShowConstraintsQueryOptions,
  TableOrModel,
  TruncateTableQueryOptions,
} from '@sequelize/core';
import { AbstractQueryGenerator } from '@sequelize/core';
import type { EscapeOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator-typescript.js';
import {
  ADD_INDEX_QUERY_SUPPORTABLE_OPTIONS,
  CREATE_DATABASE_QUERY_SUPPORTABLE_OPTIONS,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator-typescript.js';
import { BaseSqlExpression } from '@sequelize/core/_non-semver-use-at-your-own-risk_/expression-builders/base-sql-expression.js';
import { rejectInvalidOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import { joinSQLFragments } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/join-sql-fragments.js';
import { generateIndexName } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/string.js';
import { inspect } from '@sequelize/utils';
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
      'ORDER BY c.constraint_name, kcu.ordinal_position',
    ]);
  }

  addIndexQuery(tableName: TableOrModel, options: AddIndexQueryOptions): string {
    rejectInvalidOptions(
      'addIndexQuery',
      this.dialect,
      ADD_INDEX_QUERY_SUPPORTABLE_OPTIONS,
      this.dialect.supports.addIndex,
      options,
    );

    if (!Array.isArray(options.fields) || options.fields.length < 0) {
      throw new Error(
        `Property "fields" for addIndex requires an array with at least one value. Received: ${inspect(options.fields)}`,
      );
    }

    if ('using' in options) {
      throw new Error('Property "using" for addIndex has been renamed to "method".');
    }

    if ('name' in options && 'prefix' in options) {
      throw new Error('Properties "name" and "prefix" are mutually exclusive in addIndex.');
    }

    const indexOptions = { ...options };
    const columnSql = indexOptions.fields.map(column => {
      if (typeof column === 'string') {
        column = { name: column };
      }

      if (column instanceof BaseSqlExpression) {
        return this.formatSqlExpression(column);
      }

      if ('attribute' in column) {
        throw new Error('Property "attribute" for addIndex fields has been renamed to "name".');
      }

      if (!column.name) {
        throw new Error(`The following index column has no name: ${inspect(column)}`);
      }

      let result = this.quoteIdentifier(column.name);

      if (column.collate) {
        result += ` COLLATE ${this.quoteIdentifier(column.collate)}`;
      }

      const operator = column.operator || indexOptions.operator;
      if (operator) {
        result += ` ${operator}`;
      }

      if (column.length) {
        throw new Error(
          `The ${this.dialect.name} dialect does not support length on index fields.`,
        );
      }

      if (column.order) {
        result += ` ${column.order}`;
      }

      return result;
    });

    if (indexOptions.prefix && typeof indexOptions.prefix === 'string') {
      indexOptions.prefix = indexOptions.prefix.replaceAll('.', '_');
    } else {
      delete indexOptions.prefix;
    }

    if (indexOptions.type && indexOptions.type.toLowerCase() === 'unique') {
      indexOptions.unique = true;
      delete indexOptions.type;
    }

    let includeSql: string | undefined;
    if (indexOptions.include) {
      if (indexOptions.include instanceof BaseSqlExpression) {
        includeSql = `INCLUDE ${this.formatSqlExpression(indexOptions.include)}`;
      } else if (Array.isArray(indexOptions.include)) {
        const columns = indexOptions.include.map(column => {
          if (typeof column === 'string') {
            return this.quoteIdentifier(column);
          }

          if (column instanceof BaseSqlExpression) {
            return this.formatSqlExpression(column);
          }

          throw new Error(
            `The include option for indexes must be an array of strings or sql expressions.`,
          );
        });
        includeSql = `INCLUDE (${columns.join(', ')})`;
      } else {
        throw new TypeError(
          'The include option for indexes must be an array or an sql expression.',
        );
      }
    }

    const table = this.extractTableDetails(tableName);
    indexOptions.name = indexOptions.name || generateIndexName(table, indexOptions);

    return joinSQLFragments([
      'CREATE',
      indexOptions.unique ? 'UNIQUE INDEX' : 'INDEX',
      indexOptions.concurrently ? 'CONCURRENTLY' : '',
      indexOptions.ifNotExists ? 'IF NOT EXISTS' : '',
      this.quoteIdentifier(indexOptions.name),
      `ON ${this.quoteTable(tableName)}`,
      indexOptions.method ? `USING ${indexOptions.method}` : '',
      `(${columnSql.join(', ')})`,
      indexOptions.include ? includeSql : '',
      indexOptions.where ? this.whereQuery(indexOptions.where) : '',
    ]);
  }

  showIndexesQuery(tableName: TableOrModel) {
    const table = this.extractTableDetails(tableName);

    return joinSQLFragments([
      'SELECT',
      'n.nspname AS table_schema,',
      't.relname AS table_name,',
      'i.indexname AS index_name,',
      // Add index method information
      'am.amname AS index_method,',
      // Add index type information
      'pg_index.indisprimary AS is_primary_key,',
      'pg_index.indisunique AS is_unique,',
      // Add WHERE clause for partial indexes
      'pg_get_expr(pg_index.indpred, t.oid) AS where_clause,',
      // Add expression info for expression indexes
      'pg_get_expr(pg_index.indexprs, t.oid) AS index_expression,',
      // Add column information
      'a.attname AS column_name,',
      // Add collation information
      'coll.collname AS column_collate,',
      // Add operator class information
      'op.opcname AS column_operator,',
      // Store array_position as a computed column to avoid repeated calculations
      'array_position(pg_index.indkey, a.attnum) AS position_in_index,',
      // Add sort order information using the position_in_index
      "CASE WHEN (pg_index.indoption[array_position(pg_index.indkey, a.attnum)] & 1) = 1 THEN 'DESC' ELSE 'ASC' END AS column_sort_order,",
      "CASE WHEN (pg_index.indoption[array_position(pg_index.indkey, a.attnum)] & 2) = 2 THEN 'NULLS FIRST' ELSE 'NULLS LAST' END AS column_nulls_order,",
      // Determine if column is a key or included column
      'CASE WHEN array_position(pg_index.indkey, a.attnum) < pg_index.indnkeyatts THEN true ELSE false END AS is_attribute_column,',
      'CASE WHEN array_position(pg_index.indkey, a.attnum, indnkeyatts) >= pg_index.indnkeyatts THEN true ELSE false END AS is_included_column,',
      'i.indexdef AS definition',
      'FROM pg_indexes i',
      'JOIN pg_namespace n ON i.schemaname = n.nspname',
      'JOIN pg_class t ON i.tablename = t.relname AND t.relnamespace = n.oid',
      'JOIN pg_class idx ON idx.relname = i.indexname AND idx.relnamespace = n.oid',
      'JOIN pg_am am ON idx.relam = am.oid',
      'JOIN pg_index ON pg_index.indexrelid = idx.oid',
      'LEFT JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(pg_index.indkey)',
      'LEFT JOIN pg_opclass op ON op.oid = pg_index.indclass[array_position(pg_index.indkey, a.attnum)]',
      'LEFT JOIN pg_collation coll ON coll.oid = pg_index.indcollation[array_position(pg_index.indkey, a.attnum)]',
      `WHERE i.tablename = ${this.escape(table.tableName)}`,
      `AND i.schemaname = ${this.escape(table.schema)}`,
      'ORDER BY i.indexname, position_in_index',
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
