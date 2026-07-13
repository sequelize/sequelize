import type {
  ConstraintDescription,
  FetchDatabaseVersionOptions,
  ShowConstraintsOptions,
  TableOrModel,
} from '@sequelize/core';
import { AbstractQueryInterface, QueryTypes } from '@sequelize/core';
import { AbstractQueryInterfaceInternal } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-interface-internal.js';
import type { PostgresDialect } from './dialect.js';

export class PostgresQueryInterfaceTypescript<
  Dialect extends PostgresDialect = PostgresDialect,
> extends AbstractQueryInterface<Dialect> {
  readonly #internalQueryInterface: AbstractQueryInterfaceInternal;

  constructor(dialect: Dialect, internalQueryInterface?: AbstractQueryInterfaceInternal) {
    internalQueryInterface ??= new AbstractQueryInterfaceInternal(dialect);

    super(dialect, internalQueryInterface);
    this.#internalQueryInterface = internalQueryInterface;
  }

  async fetchDatabaseVersion(options?: FetchDatabaseVersionOptions): Promise<string> {
    const payload = await this.#internalQueryInterface.fetchDatabaseVersionRaw<{
      server_version: string;
    }>(options);

    return payload.server_version;
  }

  async showConstraints(
    tableName: TableOrModel,
    options?: ShowConstraintsOptions,
  ): Promise<ConstraintDescription[]> {
    const constraints = await super.showConstraints(tableName, options);

    // `information_schema.constraint_column_usage` (ccu) has no positional column. After kcu × ccu
    // cross-joins for composite FKs and `ORDER BY ccu.column_name`, the JS Set accumulator
    // surfaces `referencedColumnNames` in alphabetical order. Re-fetch the position-ordered
    // referenced columns from `pg_constraint.confkey`. We join by OID through pg_class /
    // pg_namespace to avoid `pgc.conrelid::regclass::text` quoting/schema mismatches.
    const compositeForeignKeys = constraints.filter(
      constraint =>
        constraint.constraintType === 'FOREIGN KEY' &&
        (constraint.referencedColumnNames?.length ?? 0) > 1,
    );

    if (compositeForeignKeys.length === 0) {
      return constraints;
    }

    const table = this.queryGenerator.extractTableDetails(tableName);
    const constraintNamesSql = compositeForeignKeys
      .map(constraint => this.queryGenerator.escape(constraint.constraintName))
      .join(', ');

    const orderingSql = `SELECT pgc.conname AS "constraintName", ARRAY(SELECT a.attname FROM pg_attribute a WHERE a.attrelid = pgc.confrelid AND a.attnum = ANY(pgc.confkey) ORDER BY array_position(pgc.confkey, a.attnum)) AS "referencedColumnNames" FROM pg_constraint pgc JOIN pg_class pcl ON pcl.oid = pgc.conrelid JOIN pg_namespace pn ON pn.oid = pcl.relnamespace WHERE pgc.contype = 'f' AND pcl.relname = ${this.queryGenerator.escape(table.tableName)} AND pn.nspname = ${this.queryGenerator.escape(table.schema)} AND pgc.conname IN (${constraintNamesSql})`;

    const orderedRows = await this.sequelize.queryRaw<{
      constraintName: string;
      referencedColumnNames: string[];
    }>(orderingSql, {
      ...options,
      raw: true,
      type: QueryTypes.SELECT,
    });

    const orderingByName = new Map<string, string[]>();
    for (const row of orderedRows) {
      orderingByName.set(row.constraintName, row.referencedColumnNames);
    }

    for (const constraint of compositeForeignKeys) {
      const ordered = orderingByName.get(constraint.constraintName);
      if (ordered && ordered.length > 0) {
        constraint.referencedColumnNames = ordered;
      }
    }

    return constraints;
  }
}
