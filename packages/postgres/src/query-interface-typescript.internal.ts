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
import { AbstractQueryInterfaceInternal } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-interface-internal.js';
import {
  getGeneratedAttributeDependsOn,
  getGeneratedColumnDependencies,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/generated-columns.js';
import { createHash } from 'node:crypto';
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

    const createFunction = (name: string, body: string) => [
      `CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $sequelize$ BEGIN ${body} END $sequelize$;`,
      `COMMENT ON FUNCTION ${name}() IS ${owner};`,
    ];

    const statements = [
      ...createFunction(
        functionName(''),
        `SELECT ${expressions.join(', ')} INTO ${columnNames.map(column => `NEW.${column}`).join(', ')} FROM (SELECT NEW.*) AS ${alias}; RETURN NEW;`,
      ),
      `CREATE TRIGGER ${q(prefix)} BEFORE INSERT OR UPDATE ON ${quotedTable} FOR EACH ROW EXECUTE FUNCTION ${functionName('')}();`,
    ];

    for (const [i, dependency] of dependencies.entries()) {
      const keys = (rows: string) =>
        ` WHERE ${alias}.${q(dependency.key)} IN (${dependency.selectKeys(rows)})`;
      const name = functionName(`_${i}`);
      const dependencyTable = queryGenerator.quoteTable(dependency.table);
      const trigger = (event: string, transitions: string) =>
        `CREATE TRIGGER ${q(`${prefix}_${i}_${event.toLowerCase()}`)} AFTER ${event} ON ${dependencyTable} REFERENCING ${transitions} FOR EACH STATEMENT EXECUTE FUNCTION ${name}();`;

      statements.push(
        // a refresh that changes no rows still runs the statement triggers of its table: exiting early stops cycles
        ...createFunction(
          name,
          `IF TG_OP = 'INSERT' THEN
             IF EXISTS (SELECT FROM new_rows) THEN ${lockAndRefresh(keys('new_rows'))} END IF;
           ELSIF TG_OP = 'DELETE' THEN
             IF EXISTS (SELECT FROM old_rows) THEN ${lockAndRefresh(keys('old_rows'))} END IF;
           ELSIF EXISTS (SELECT FROM new_rows) THEN
             ${lockAndRefresh(` WHERE ${alias}.${q(dependency.key)} IN (${dependency.selectKeys('new_rows')} UNION ${dependency.selectKeys('old_rows')})`)}
           END IF;
           RETURN NULL;`,
        ),
        trigger('INSERT', 'NEW TABLE AS new_rows'),
        trigger('UPDATE', 'OLD TABLE AS old_rows NEW TABLE AS new_rows'),
        trigger('DELETE', 'OLD TABLE AS old_rows'),
      );
    }

    // the existing rows
    statements.push(refresh(''));

    return statements;
  }
}
