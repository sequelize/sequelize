import type { TruncateOptions } from 'src/model';
import type { Expression } from '../../sequelize.js';
import { joinSQLFragments } from '../../utils/join-sql-fragments';
import type { EscapeOptions, TableNameOrModel } from '../abstract/query-generator-typescript';
import { PostgresQueryGenerator } from '../postgres/query-generator';
import { ENUM } from './data-types';

export interface ListSchemasQueryOptions {
  /** List of schemas to exclude from output */
  skip?: string[];
}
export class CockroachDbQueryGenerator extends PostgresQueryGenerator {
  setSearchPath(searchPath: string) {
    return `SET search_path to ${searchPath};`;
  }

  describeTableQuery(tableName: TableNameOrModel): string {
    const table = this.extractTableDetails(tableName);

    return joinSQLFragments([
      'SELECT',
      'pk.constraint_type as "Constraint",',
      'c.column_name as "Field",',
      'c.column_default as "Default",',
      'c.is_nullable as "Null",',
      `(CASE WHEN c.udt_name = 'hstore' THEN c.udt_name ELSE c.data_type END) || (CASE WHEN c.character_maximum_length IS NOT NULL THEN '(' || CAST(c.character_maximum_length AS STRING) || ')' ELSE '' END) as "Type",`,
      '(SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder ASC) FROM pg_catalog.pg_type t JOIN pg_catalog.pg_enum e ON t.oid=e.enumtypid WHERE t.typname=c.udt_name) AS "special",',
      '(SELECT pgd.description FROM pg_catalog.pg_class AS st INNER JOIN pg_catalog.pg_description pgd on (pgd.objoid=st.oid) WHERE c.ordinal_position=pgd.objsubid AND c.table_name=st.relname) AS "Comment"',
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

  showIndexesQuery(tableName: TableNameOrModel): string {
    const table = this.extractTableDetails(tableName);

    // TODO [>=6]: refactor the query to use pg_indexes
    return joinSQLFragments([
      'SELECT i.relname AS name, ix.indisprimary AS primary, ix.indisunique AS unique, ix.indkey AS indkey,',
      'array_agg(a.attnum) as column_indexes, array_agg(a.attname) AS column_names, pg_get_indexdef(ix.indexrelid)',
      'AS definition FROM pg_class t, pg_class i, pg_index ix, pg_attribute a , pg_namespace s',
      'WHERE t.oid = ix.indrelid AND i.oid = ix.indexrelid AND a.attrelid = t.oid AND',
      `t.relkind = 'r' and t.relname = ${this.escape(table.tableName)}`,
      `AND s.oid = t.relnamespace AND s.nspname = ${this.escape(table.schema)}`,
      'GROUP BY i.relname, ix.indexrelid, ix.indisprimary, ix.indisunique, ix.indkey ORDER BY i.relname;',
    ]);
  }

  fromArray(text: string | string[]): string | string[] {
    let patchedText = typeof text === 'string' ? text : `{${text.join(',')}}`;
    if (Array.isArray(patchedText)) {
      return text;
    }

    patchedText = patchedText.replace(/^{/, '').replace(/}$/, '');
    let matches: string[] = patchedText.match(/("(?:\\.|[^"\\])*"|[^,]*)(?:\s*,\s*|\s*$)/gi) || [];

    if (matches.length === 0) {
      return [];
    }

    matches = matches.map(m => m
      .replace(/",$/, '')
      .replace(/,$/, '')
      .replace(/(^"|"$)/g, ''));

    return matches.slice(0, -1);
  }

  truncateTableQuery(tableName: string, options: TruncateOptions = {}): string {
    return [
      `TRUNCATE ${this.quoteTable(tableName)}`,
      options.cascade ? ' CASCADE' : '',
    ].join('');
  }

  pgEnum<Members extends string>(tableName: string, attr: string, dataType: ENUM<Members>, options: any) {
    const enumName = this.pgEnumName(tableName, attr, options);
    let values;

    if (dataType instanceof ENUM && dataType.options.values) {
      values = `ENUM(${dataType.options.values.map(value => this.escape(value)).join(', ')})`;
    } else {
      values = dataType.toString().match(/^ENUM\(.+\)/)?.[0];
    }

    let sql = `CREATE TYPE ${enumName} AS ${values};`;
    if (Boolean(options) && options.force === true) {
      sql = this.pgEnumDrop(tableName, attr) + sql;
    }

    return sql;
  }

  pgEnumAdd(tableName: string, attr: string, value: string, options: any) {
    const enumName = this.pgEnumName(tableName, attr);
    let sql = `ALTER TYPE ${enumName} ADD VALUE IF NOT EXISTS `;

    sql += this.escape(value);

    if (options.before) {
      sql += ` BEFORE ${this.escape(options.before)}`;
    } else if (options.after) {
      sql += ` AFTER ${this.escape(options.after)}`;
    }

    return sql;
  }

  pgEnumDrop(tableName: string, attr: string, enumName?: string) {
    enumName = enumName || this.pgEnumName(tableName, attr);

    return `DROP TYPE IF EXISTS ${enumName}; `;
  }

  jsonPathExtractionQuery(sqlExpression: string, path: ReadonlyArray<number | string>, unquote: boolean): string {
    const operator = path.length === 1
      ? (unquote ? '->>' : '->')
      : (unquote ? '#>>' : '#>');

    const pathSql = path.length === 1
      // when accessing an array index with ->, the index must be a number
      // when accessing an object key with ->, the key must be a string
      ? this.escape(path[0])
      // when accessing with #>, the path is always an array of strings
      : this.escape(path.map(value => String(value)));

    return sqlExpression + operator + pathSql;
  }

  formatUnquoteJson(arg: Expression, options?: EscapeOptions) {
    return `${this.escape(arg, options)}#>>ARRAY[]::TEXT[]`;
  }

  dropSchemaQuery(schema: string) {
    if (schema === 'crdb_internal') {
      throw new Error('Cannot remove crdb_internal schema in Cockroachdb');
    }

    return `DROP SCHEMA IF EXISTS ${this.quoteIdentifier(schema)} CASCADE;`;
  }

  listSchemasQuery(options: ListSchemasQueryOptions) {
    const schemasToSkip = ['information_schema', 'public', 'crdb_internal'];
    if (options?.skip) {
      schemasToSkip.push(...options.skip);
    }

    return `SELECT schema_name FROM information_schema.schemata WHERE schema_name !~ E'^pg_' AND schema_name NOT IN (${schemasToSkip.map(schema => this.escape(schema)).join(', ')});`;
  }
}
