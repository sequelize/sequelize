import type {
  FetchDatabaseVersionOptions,
  GeneratedColumnOptions,
  ModelStatic,
  QiDropTableOptions,
  QueryRawOptions,
  TableOrModel,
} from '@sequelize/core';
import {
  AbstractQueryInterface,
  DataTypes,
  QueryTypes,
  TransactionNestMode,
} from '@sequelize/core';
import type { AbstractQueryInterfaceInternal } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-interface-internal.js';
import {
  getGeneratedAttributeDependsOn,
  getGeneratedColumnDependencies,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/generated-columns.js';
import { createHash } from 'node:crypto';
import semver from 'semver';
import type { PostgresDialect } from './dialect.js';
import { PostgresQueryInterfaceInternal } from './query-interface.internal.js';

export class PostgresQueryInterfaceTypescript<
  Dialect extends PostgresDialect = PostgresDialect,
> extends AbstractQueryInterface<Dialect> {
  readonly #internalQueryInterface: AbstractQueryInterfaceInternal;

  constructor(dialect: Dialect, internalQueryInterface?: AbstractQueryInterfaceInternal) {
    internalQueryInterface ??= new PostgresQueryInterfaceInternal(dialect);

    super(dialect, internalQueryInterface);
    this.#internalQueryInterface = internalQueryInterface;
  }

  async fetchDatabaseVersion(options?: FetchDatabaseVersionOptions): Promise<string> {
    const payload = await this.#internalQueryInterface.fetchDatabaseVersionRaw<{
      server_version: string;
    }>(options);

    return payload.server_version;
  }

  async dropTable(tableName: TableOrModel, options?: QiDropTableOptions): Promise<void> {
    // the triggers that maintain its generated columns also live on the tables they read.
    // Any model that uses dependsOn enables the lookup, not only the table's own, which a migration may not load.
    const usesDependsOn = [...this.sequelize.models].some(model =>
      [...model.modelDefinition.attributes.values()].some(attribute =>
        getGeneratedAttributeDependsOn(attribute),
      ),
    );
    const functions = usesDependsOn ? await this.#generatedColumnFunctions(tableName, options) : [];
    for (const name of functions) {
      // eslint-disable-next-line no-await-in-loop -- DDL statements run in order
      await this.sequelize.queryRaw(`DROP FUNCTION ${name} CASCADE;`, {
        ...options,
        type: QueryTypes.RAW,
      });
    }

    await super.dropTable(tableName, options);
  }

  /**
   * Returns the comment that identifies the functions maintaining the generated columns of a table,
   * so they can be replaced and dropped.
   *
   * @param tableName
   */
  #generatedColumnsOwner(tableName: TableOrModel): string {
    const { queryGenerator } = this;

    return queryGenerator.escape(
      `sequelize generated columns of ${queryGenerator.quoteTable(queryGenerator.extractTableDetails(tableName))}`,
    );
  }

  async #generatedColumnFunctions(
    tableName: TableOrModel,
    options?: QueryRawOptions,
  ): Promise<string[]> {
    const { queryGenerator } = this;
    const quotedTable = queryGenerator.quoteTable(queryGenerator.extractTableDetails(tableName));
    // the functions live in the schema of the table, which keeps apart the tables of the same name in other schemas
    const functions = await this.sequelize.queryRaw<{ name: string }>(
      `SELECT proc.oid::regprocedure::text AS name FROM pg_description AS description
         INNER JOIN pg_proc AS proc ON proc.oid = description.objoid
         INNER JOIN pg_class AS class ON class.oid = to_regclass(${queryGenerator.escape(quotedTable)}) AND class.relnamespace = proc.pronamespace
        WHERE description.classoid = 'pg_proc'::regclass AND description.description = ${this.#generatedColumnsOwner(tableName)}`,
      { ...options, type: QueryTypes.SELECT },
    );

    return functions.map(({ name }) => name);
  }

  async syncGeneratedColumnTriggers(model: ModelStatic, options?: QueryRawOptions): Promise<void> {
    const { queryGenerator, sequelize } = this;
    const quotedTable = queryGenerator.quoteTable(model.table);
    const owner = this.#generatedColumnsOwner(model);
    const usesDependsOn = [...model.modelDefinition.attributes.values()].some(attribute =>
      getGeneratedAttributeDependsOn(attribute),
    );
    if (!usesDependsOn && (await this.#generatedColumnFunctions(model, options)).length === 0) {
      return;
    }

    await sequelize.transaction(
      { nestMode: TransactionNestMode.savepoint, transaction: options?.transaction },
      async transaction => {
        const queryOptions = { ...options, transaction };
        // processes that sync the same table at once, such as app replicas starting together, take turns
        await sequelize.queryRaw(`SELECT pg_advisory_xact_lock(hashtext(${owner}));`, {
          ...queryOptions,
          type: QueryTypes.SELECT,
        });

        // dropping the functions drops their triggers too
        const statements = (await this.#generatedColumnFunctions(model, queryOptions)).map(
          name => `DROP FUNCTION ${name} CASCADE;`,
        );

        if (usesDependsOn && (await this.tableExists(model.table, queryOptions))) {
          statements.push(
            ...(await this.#generatedColumnTriggers(model, quotedTable, owner, queryOptions)),
          );
        }

        for (const sql of statements) {
          // eslint-disable-next-line no-await-in-loop -- DDL statements run in order
          await sequelize.queryRaw(sql, { ...queryOptions, type: QueryTypes.RAW });
        }
      },
    );
  }

  /**
   * Returns the columns that a query reads from each of the given tables, as Postgres records them for a view of the query.
   * A table is left out when Postgres cannot tell, such as when the query reads its rows whole or through a function.
   *
   * @param view the name of the view, dropped before returning
   * @param query
   * @param tables quoted table names
   * @param options
   */
  async #readColumns(
    view: string,
    query: string,
    tables: string[],
    options: QueryRawOptions,
  ): Promise<Map<string, { columns: string[]; comparedAsText: string[] | null }>> {
    const { queryGenerator, sequelize } = this;
    await sequelize.queryRaw(`CREATE VIEW ${view} AS ${query};`, {
      ...options,
      type: QueryTypes.RAW,
    });
    // a whole-row reference records no column: it shows as attribute 0 in the stored query
    const reads = await sequelize.queryRaw<{
      table: string;
      columns: string[];
      comparedAsText: string[] | null;
    }>(
      `SELECT tables.name AS "table", array_agg(attribute.attname::text ORDER BY attribute.attnum) AS columns,
              array_agg(attribute.attname::text) FILTER (WHERE NOT EXISTS (
                SELECT FROM pg_operator WHERE oprname = '=' AND oprleft = attribute.atttypid AND oprright = attribute.atttypid
              )) AS "comparedAsText"
         FROM unnest(ARRAY[${[...new Set(tables)].map(table => queryGenerator.escape(table)).join(', ')}]) AS tables(name)
        INNER JOIN pg_depend AS dependency ON dependency.refclassid = 'pg_class'::regclass AND dependency.refobjid = to_regclass(tables.name)
        INNER JOIN pg_rewrite AS rule ON dependency.classid = 'pg_rewrite'::regclass AND dependency.objid = rule.oid
         LEFT JOIN pg_attribute AS attribute ON attribute.attrelid = dependency.refobjid AND attribute.attnum = dependency.refobjsubid AND attribute.attnum > 0
        WHERE rule.ev_class = to_regclass(${queryGenerator.escape(view)}) AND rule.ev_action::text NOT LIKE '%:varattno 0 %'
        GROUP BY tables.name
       HAVING bool_and(attribute.attname IS NOT NULL)`,
      { ...options, type: QueryTypes.SELECT },
    );
    await sequelize.queryRaw(`DROP VIEW ${view};`, { ...options, type: QueryTypes.RAW });

    return new Map(reads.map(read => [read.table, read]));
  }

  async #generatedColumnTriggers(
    model: ModelStatic,
    quotedTable: string,
    owner: string,
    options: QueryRawOptions,
  ): Promise<string[]> {
    const { queryGenerator } = this;
    const { modelDefinition, table } = model;

    // columns are maintained once they exist, so a migration can call this before adding the next one
    const columns = await this.describeTable(table, options);
    const attributes = [...modelDefinition.attributes.values()].filter(
      attribute => getGeneratedAttributeDependsOn(attribute) && columns[attribute.columnName],
    );
    if (attributes.length === 0) {
      return [];
    }

    const primaryKeys = [...modelDefinition.primaryKeysAttributeNames].map(attributeName =>
      modelDefinition.getColumnName(attributeName),
    );
    if (primaryKeys.length === 0) {
      throw new Error(
        `Model ${model.name} must have a primary key to use "dependsOn" in generated attributes.`,
      );
    }

    const dependencies = getGeneratedColumnDependencies(model);
    // the expression cannot run before all the tables it reads exist, syncing the missing ones calls this again
    const dependencyTablesExist = await Promise.all(
      dependencies.map(async dependency => this.tableExists(dependency.table, options)),
    );
    if (dependencyTablesExist.includes(false)) {
      return [];
    }

    const q = queryGenerator.quoteIdentifier.bind(queryGenerator);
    const alias = q(table.tableName);
    // unique per schema-qualified table, and short enough that the suffixes are not truncated:
    // only ASCII word characters of the name are kept, as identifiers are limited to 63 bytes
    const prefix = `${table.tableName.replaceAll(/\W/g, '').slice(0, 20)}_${createHash('md5').update(quotedTable).digest('hex').slice(0, 8)}_generated`;
    const functionName = (suffix: string) =>
      queryGenerator.quoteTable({ ...table, tableName: `${prefix}${suffix}` });
    const columnNames = attributes.map(attribute => q(attribute.columnName));
    // json has no equality operator, so its values are compared as jsonb
    const compared = (relation: string) =>
      attributes
        .map((attribute, i) => {
          const column = `${relation}.${columnNames[i]}`;

          return attribute.type instanceof DataTypes.JSON ? `${column}::jsonb` : column;
        })
        .join(', ');
    // sql.attribute() resolves to columns of this table, not of the subqueries of the expression
    const expressions = attributes.map(
      attribute =>
        `(${queryGenerator.escape((attribute.generatedAs as GeneratedColumnOptions).expression, { model, mainAlias: table.tableName })})`,
    );

    // only writes the rows whose values change, so the other triggers of the table do not run for nothing
    const refresh = (where: string) =>
      `UPDATE ${quotedTable} SET ${columnNames.map(column => `${column} = refreshed.${column}`).join(', ')}
         FROM (SELECT ${primaryKeys.map(key => `${alias}.${q(key)}`).join(', ')}, ${expressions.map((expression, i) => `${expression} AS ${columnNames[i]}`).join(', ')}
               FROM ${quotedTable}${where}) AS refreshed
        WHERE ${primaryKeys.map(key => `${alias}.${q(key)} = refreshed.${q(key)}`).join(' AND ')}
          AND ROW(${compared(alias)}) IS DISTINCT FROM ROW(${compared('refreshed')});`;

    // locking the rows first gives the refresh a snapshot taken after concurrent changes to them commit
    const lockAndRefresh = (where: string) =>
      `PERFORM FROM ${quotedTable}${where} ORDER BY ${primaryKeys.map(key => `${alias}.${q(key)}`).join(', ')} FOR UPDATE; ${refresh(where)}`;

    const reads = await this.#readColumns(
      functionName('_reads'),
      `SELECT ${expressions.map((expression, i) => `${expression} AS ${columnNames[i]}`).join(', ')} FROM ${quotedTable}`,
      [quotedTable, ...dependencies.map(dependency => queryGenerator.quoteTable(dependency.table))],
      options,
    );
    // the keys are collected into arrays of the type of their column
    const columnTypes = new Map(
      (
        await this.sequelize.queryRaw<{ column: string; type: string }>(
          `SELECT attname::text AS "column", format_type(atttypid, atttypmod) AS type FROM pg_attribute
            WHERE attrelid = to_regclass(${queryGenerator.escape(quotedTable)}) AND attnum > 0`,
          { ...options, type: QueryTypes.SELECT },
        )
      ).map(({ column, type }) => [column, type]),
    );

    // the functions resolve the tables they read as this sync does, whatever the search_path of the writer.
    // Generic plans (Postgres 12+) keep the array of keys from making the queries plan again on every call.
    const settings = `SET search_path FROM CURRENT${semver.gte(this.sequelize.getDatabaseVersion(), '12.0.0') ? ' SET plan_cache_mode = force_generic_plan' : ''}`;
    const createFunction = (name: string, body: string, declarations = '') => [
      `CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql ${settings} AS $sequelize$ ${declarations}BEGIN ${body} END $sequelize$;`,
      `COMMENT ON FUNCTION ${name}() IS ${owner};`,
    ];

    const statements: string[] = [];
    for (const [i, dependency] of dependencies.entries()) {
      const keys = (rows: string) =>
        ` WHERE ${alias}.${q(dependency.key)} IN (${dependency.selectKeys(rows)})`;
      const name = functionName(`_${i}`);
      const dependencyTable = queryGenerator.quoteTable(dependency.table);
      const trigger = (event: string, transitions: string) =>
        `CREATE TRIGGER ${q(`${prefix}_${i}_${event.toLowerCase()}`)} AFTER ${event} ON ${dependencyTable} REFERENCING ${transitions} FOR EACH STATEMENT EXECUTE FUNCTION ${name}();`;
      const keyColumn = dependency.keyColumn && q(dependency.keyColumn);
      // inserted or deleted rows without a key have no row to refresh
      const withKey = keyColumn ? ` WHERE ${keyColumn} IS NOT NULL` : '';

      // An updated row only matters when its key or a column that the expressions read changes. Rows count
      // whole when Postgres cannot tell which columns are read, or when the table has no primary key to pair
      // the old and new rows. Transition tables have no statistics, which makes two other filters traps,
      // measured on a 3.6M-row table:
      // - joining old_rows to new_rows inside the lock or refresh query: the planner overestimates the join
      //   about 100x and scans the whole table, 5x slower than no filter on an 88k-row update;
      // - gating on an EXISTS over that join: a nested loop, still running after 200 s.
      // The keys are collected once into an array instead, which the lock and the refresh look up by index.
      const read = reads.get(dependencyTable);
      const pairKeys = dependency.primaryKeys.map(key => q(key));
      let newRows = 'new_rows';
      let oldRows = 'old_rows';
      let collectKeys = '';
      if (read && pairKeys.length > 0) {
        const readColumns = dependency.keyColumn
          ? [...new Set([...read.columns, dependency.keyColumn])]
          : read.columns;
        // a type without an equality operator, such as json, is compared as text
        const row = (relation: string) =>
          `ROW(${readColumns.map(column => `${relation}.${q(column)}${read.comparedAsText?.includes(column) ? '::text' : ''}`).join(', ')})`;
        const pairs = `new_rows AS n FULL JOIN old_rows AS o ON ${pairKeys.map(key => `o.${key} = n.${key}`).join(' AND ')}`;
        // a row whose primary key changes has no pair
        const changed = `(o.${pairKeys[0]} IS NULL OR n.${pairKeys[0]} IS NULL OR ${row('n')} IS DISTINCT FROM ${row('o')})`;
        newRows = `(SELECT n.* FROM ${pairs} WHERE ${changed})`;
        oldRows = `(SELECT o.* FROM ${pairs} WHERE ${changed})`;
        if (keyColumn) {
          collectKeys = `SELECT array_agg(DISTINCT k.key) INTO sequelize_keys FROM ${pairs}
            CROSS JOIN LATERAL (VALUES (n.${keyColumn}), (o.${keyColumn})) AS k(key) WHERE k.key IS NOT NULL AND ${changed};`;
        }
      }

      collectKeys ||= `SELECT array_agg(k.key) INTO sequelize_keys
        FROM (${dependency.selectKeys(newRows)} UNION ${dependency.selectKeys(oldRows)}) AS k(key) WHERE k.key IS NOT NULL;`;

      statements.push(
        // a refresh that changes no rows still runs the statement triggers of its table: exiting early stops cycles
        ...createFunction(
          name,
          `IF TG_OP = 'INSERT' THEN
             IF EXISTS (SELECT FROM new_rows${withKey}) THEN ${lockAndRefresh(keys('new_rows'))} END IF;
           ELSIF TG_OP = 'DELETE' THEN
             IF EXISTS (SELECT FROM old_rows${withKey}) THEN ${lockAndRefresh(keys('old_rows'))} END IF;
           ELSE
             ${collectKeys}
             IF sequelize_keys IS NOT NULL THEN ${lockAndRefresh(` WHERE ${alias}.${q(dependency.key)} = ANY(sequelize_keys)`)} END IF;
           END IF;
           RETURN NULL;`,
          `DECLARE sequelize_keys ${columnTypes.get(dependency.key)}[]; `,
        ),
        trigger('INSERT', 'NEW TABLE AS new_rows'),
        trigger('UPDATE', 'OLD TABLE AS old_rows NEW TABLE AS new_rows'),
        trigger('DELETE', 'OLD TABLE AS old_rows'),
      );
    }

    // the existing rows, before the trigger below exists, so that each row is computed once
    statements.push(refresh(''));

    // the triggers above refresh the rows when other tables change, so updates only matter when they write
    // a column of the row that the expression reads
    const ownColumns = reads.get(quotedTable)?.columns;
    statements.push(
      ...createFunction(
        functionName(''),
        `SELECT ${expressions.join(', ')} INTO ${columnNames.map(column => `NEW.${column}`).join(', ')} FROM (SELECT NEW.*) AS ${alias}; RETURN NEW;`,
      ),
      `CREATE TRIGGER ${q(prefix)} BEFORE INSERT OR UPDATE${ownColumns ? ` OF ${ownColumns.map(column => q(column)).join(', ')}` : ''} ON ${quotedTable} FOR EACH ROW EXECUTE FUNCTION ${functionName('')}();`,
    );
    if (ownColumns) {
      // a direct write of the columns is computed again. The refreshes above write them from a trigger, which this skips.
      // Rows inserted by other triggers are still computed by the trigger above.
      statements.push(
        `CREATE TRIGGER ${q(`${prefix}_guard`)} BEFORE UPDATE OF ${columnNames.join(', ')} ON ${quotedTable} FOR EACH ROW WHEN (pg_trigger_depth() < 1) EXECUTE FUNCTION ${functionName('')}();`,
      );
    }

    return statements;
  }
}
