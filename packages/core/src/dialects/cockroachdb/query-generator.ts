import type { TruncateOptions } from 'src/model';
import { joinSQLFragments } from '../../utils/join-sql-fragments';
import type { TableNameOrModel } from '../abstract/query-generator-typescript';
import type { QueryWithBindParams } from '../abstract/query-generator.types';
import { ENUM } from '../postgres/data-types';
import { PostgresQueryGenerator } from '../postgres/query-generator';

export class CockroachDbQueryGenerator extends PostgresQueryGenerator {

  protected _getTechnicalDatabaseNames(): string[] {
    return ['defaultdb', 'system'];
  }

  protected _getTechnicalSchemaNames() {
    return ['crdb_internal', 'information_schema'];
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

  truncateTableQuery(tableName: string, options: TruncateOptions = {}): string {
    return [
      `TRUNCATE ${this.quoteTable(tableName)}`,
      options.cascade ? ' CASCADE' : '',
    ].join('');
  }

  // Overriding postgres implementation since Postgres uses DO BEGIN which is not supported by cockroachdb
  pgEnum<Members extends string>(tableName: string, attr: string, dataType: ENUM<Members>, options: any) {
    const enumName = this.pgEnumName(tableName, attr, options);
    let values;

    if (dataType instanceof ENUM && dataType.options.values) {
      values = `ENUM(${dataType.options.values.map(value => this.escape(value)).join(', ')})`;
    } else {
      values = dataType.toString().match(/^ENUM\(.+\)/)?.[0];
    }

    let sql: string = `CREATE TYPE ${enumName} AS ${values};`;
    if (Boolean(options) && options.force === true) {
      sql = this.pgEnumDrop(tableName, attr) + sql;
    }

    return sql;
  }

  dropSchemaQuery(schema: string): string | QueryWithBindParams {
    if (schema === 'crdb_internal') {
      throw new Error('Cannot remove crdb_internal schema in Cockroachdb');
    }

    return super.dropSchemaQuery(schema);
  }

  showIndexesQuery(tableName: TableNameOrModel): string {
    const table = this.extractTableDetails(tableName);

    // TODO [>=6]: refactor the query to use pg_indexes
    return joinSQLFragments([
      'SELECT i.relname AS name, ix.indisprimary AS primary, ix.indisunique AS unique, ix.indkey AS indkey, MAX(ix.indnkeyatts) as index_fields_length,',
      'array_agg(a.attnum) as column_indexes, array_agg(a.attname) AS column_names,',
      'pg_get_indexdef(ix.indexrelid) AS definition FROM pg_class t, pg_class i, pg_index ix, pg_attribute a , pg_namespace s',
      'WHERE t.oid = ix.indrelid AND i.oid = ix.indexrelid AND a.attrelid = t.oid AND',
      `t.relkind = 'r' and t.relname = ${this.escape(table.tableName)}`,
      `AND s.oid = t.relnamespace AND s.nspname = ${this.escape(table.schema)}`,
      'GROUP BY i.relname, ix.indexrelid, ix.indisprimary, ix.indisunique, ix.indkey, ix.indnkeyatts ORDER BY i.relname;',
    ]);
  }

}
