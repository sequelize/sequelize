import type { AttributeOptions, QueryRawOptions, Sequelize, TableOrModel } from '@sequelize/core';
import { ForeignKeyConstraintError, QueryTypes, TransactionNestMode } from '@sequelize/core';
import { AbstractQueryInterfaceInternal } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-interface-internal.js';
import { withSqliteForeignKeysOff } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/sql.js';
import type { SqliteDialect } from './dialect.js';
import type { SqliteAutoincrementSequence } from './query-generator-typescript.internal.js';
import type { SqliteQueryGenerator } from './query-generator.js';
import type { SqliteColumnsDescription } from './query-interface.types.js';
import { replaceSqlIdentifier } from './sqlite-schema-parser.js';

type SqliteSchemaCatalog = 'sqlite_master' | 'sqlite_temp_master';
type SqliteSchemaName = 'main' | 'temp';

export class SqliteQueryInterfaceInternal extends AbstractQueryInterfaceInternal {
  constructor(readonly dialect: SqliteDialect) {
    super(dialect);
  }

  get #sequelize(): Sequelize {
    return this.dialect.sequelize;
  }

  get #queryGenerator(): SqliteQueryGenerator {
    return this.dialect.queryGenerator;
  }

  async #getViewsForTableRebuild(
    schemaCatalog: SqliteSchemaCatalog,
    options: QueryRawOptions,
  ): Promise<{
    triggers: string[];
    views: Array<{ name: string; schemaName: SqliteSchemaName; sql: string }>;
  }> {
    const schemas: Array<{ catalog: SqliteSchemaCatalog; name: SqliteSchemaName }> =
      schemaCatalog === 'sqlite_master'
        ? [
            { catalog: 'sqlite_master', name: 'main' },
            { catalog: 'sqlite_temp_master', name: 'temp' },
          ]
        : [{ catalog: 'sqlite_temp_master', name: 'temp' }];
    const schemaObjects = await Promise.all(
      schemas.map(async schema => {
        const views = await this.#sequelize.queryRaw<{ name: string; sql: string }>(
          `SELECT name, sql FROM ${schema.catalog} WHERE type = 'view' AND sql IS NOT NULL ORDER BY rowid`,
          { ...options, type: QueryTypes.SELECT },
        );
        const triggers = await this.#sequelize.queryRaw<{ sql: string }>(
          `SELECT sql FROM ${schema.catalog} WHERE type = 'trigger' AND tbl_name IN (SELECT name FROM ${schema.catalog} WHERE type = 'view') AND sql IS NOT NULL ORDER BY rowid`,
          { ...options, type: QueryTypes.SELECT },
        );

        return {
          triggers: triggers.map(trigger => {
            return schema.name === 'temp'
              ? trigger.sql.replace(/^CREATE\s+TRIGGER\b/i, 'CREATE TEMP TRIGGER')
              : trigger.sql;
          }),
          views: views.map(view => ({
            ...view,
            schemaName: schema.name,
            sql:
              schema.name === 'temp'
                ? view.sql.replace(/^CREATE\s+VIEW\b/i, 'CREATE TEMP VIEW')
                : view.sql,
          })),
        };
      }),
    );

    return {
      triggers: schemaObjects.flatMap(schema => schema.triggers),
      views: schemaObjects.flatMap(schema => schema.views),
    };
  }

  async #assertCanRebuildTableInTransaction(
    tableName: TableOrModel,
    options?: QueryRawOptions,
  ): Promise<void> {
    if (!options?.transaction) {
      return;
    }

    const [foreignKeysPragma] = await this.#sequelize.queryRaw<{ foreign_keys: number }>(
      'PRAGMA foreign_keys',
      { ...options, type: QueryTypes.SELECT },
    );

    if (foreignKeysPragma?.foreign_keys !== 1) {
      return;
    }

    const table = this.#queryGenerator.extractTableDetails(tableName);
    const escapedTableName = this.#queryGenerator.escape(table.tableName);
    const [tableSchema] = await this.#sequelize.queryRaw<{
      catalog: SqliteSchemaCatalog;
      schemaName: SqliteSchemaName;
    }>(
      `SELECT 'sqlite_temp_master' AS catalog, 'temp' AS schemaName FROM sqlite_temp_master WHERE type = 'table' AND name = ${escapedTableName} UNION ALL SELECT 'sqlite_master' AS catalog, 'main' AS schemaName FROM sqlite_master WHERE type = 'table' AND name = ${escapedTableName}`,
      { ...options, type: QueryTypes.SELECT },
    );

    if (!tableSchema) {
      return;
    }

    const schemaTables = await this.#sequelize.queryRaw<{ name: string }>(
      `SELECT name FROM ${tableSchema.catalog} WHERE type = 'table'`,
      { ...options, type: QueryTypes.SELECT },
    );
    const foreignKeysByTable = await Promise.all(
      schemaTables.map(async schemaTable =>
        this.#sequelize.queryRaw<{ table: string }>(
          `PRAGMA ${tableSchema.schemaName}.foreign_key_list(${this.#queryGenerator.quoteIdentifier(schemaTable.name)})`,
          { ...options, type: QueryTypes.SELECT },
        ),
      ),
    );
    const hasInboundForeignKey = foreignKeysByTable.some(foreignKeys =>
      foreignKeys.some(
        foreignKey => foreignKey.table.toLowerCase() === table.tableName.toLowerCase(),
      ),
    );

    if (hasInboundForeignKey) {
      throw new Error(
        `SQLite cannot safely rebuild table ${this.#queryGenerator.quoteTable(table)} inside an existing transaction because another table references it. Run the schema change outside the transaction so Sequelize can temporarily disable foreign key enforcement.`,
      );
    }
  }

  async addColumnInternal(
    tableName: TableOrModel,
    columnName: string,
    attribute: AttributeOptions,
    options?: QueryRawOptions,
  ): Promise<void> {
    const table = this.#queryGenerator.extractTableDetails(tableName);
    const escapedTableName = this.#queryGenerator.escape(table.tableName);
    await this.#assertCanRebuildTableInTransaction(tableName, options);

    await withSqliteForeignKeysOff(this.#sequelize, options, async () => {
      await this.#sequelize.transaction(
        {
          nestMode: TransactionNestMode.savepoint,
          transaction: options?.transaction,
        },
        async transaction => {
          const [createTableRow] = await this.#sequelize.queryRaw<{
            schemaCatalog: SqliteSchemaCatalog;
            sql: string;
          }>(
            `SELECT sql, 'sqlite_temp_master' AS schemaCatalog FROM sqlite_temp_master WHERE type = 'table' AND name = ${escapedTableName} UNION ALL SELECT sql, 'sqlite_master' AS schemaCatalog FROM sqlite_master WHERE type = 'table' AND name = ${escapedTableName}`,
            { ...options, transaction, type: QueryTypes.SELECT },
          );

          if (!createTableRow?.sql) {
            throw new Error(`Unable to read the CREATE TABLE statement for ${table.tableName}.`);
          }

          const tableXInfo = await this.#sequelize.queryRaw<{ hidden: number; name: string }>(
            this.#queryGenerator.describeTableQuery(tableName),
            { ...options, transaction, type: QueryTypes.SELECT },
          );
          const copiedColumnNames = tableXInfo
            .filter(column => column.hidden === 0)
            .map(column => column.name);
          const schemaObjects = await this.#sequelize.queryRaw<{ sql: string }>(
            `SELECT sql FROM ${createTableRow.schemaCatalog} WHERE tbl_name = ${escapedTableName} AND type IN ('index', 'trigger') AND sql IS NOT NULL ORDER BY rowid`,
            { ...options, transaction, type: QueryTypes.SELECT },
          );
          const temporaryTableTriggers =
            createTableRow.schemaCatalog === 'sqlite_master'
              ? await this.#sequelize.queryRaw<{ sql: string }>(
                  `SELECT sql FROM sqlite_temp_master WHERE tbl_name = ${escapedTableName} AND type = 'trigger' AND sql IS NOT NULL ORDER BY rowid`,
                  { ...options, transaction, type: QueryTypes.SELECT },
                )
              : [];
          const { triggers: viewTriggers, views } = await this.#getViewsForTableRebuild(
            createTableRow.schemaCatalog,
            { ...options, transaction },
          );
          let autoincrementSequence: SqliteAutoincrementSequence | undefined;

          if (/\bAUTOINCREMENT\b/i.test(createTableRow.sql)) {
            const schemaName = createTableRow.schemaCatalog === 'sqlite_master' ? 'main' : 'temp';
            const [sequenceRow] = await this.#sequelize.queryRaw<{ seq: string }>(
              `SELECT CAST(seq AS TEXT) AS seq FROM ${this.#queryGenerator.quoteIdentifier(schemaName)}.${this.#queryGenerator.quoteIdentifier('sqlite_sequence')} WHERE name = ${escapedTableName}`,
              { ...options, transaction, type: QueryTypes.SELECT },
            );
            if (sequenceRow) {
              autoincrementSequence = { schemaName, value: sequenceRow.seq };
            }
          }

          const columnSql = this.#queryGenerator.attributesToSQL(
            { [columnName]: attribute } as unknown as SqliteColumnsDescription,
            {
              context: 'addColumn',
              table: table.tableName,
            },
          );
          const [physicalColumnName, columnDefinition] = Object.entries(columnSql)[0];
          const createTableSql =
            createTableRow.schemaCatalog === 'sqlite_temp_master'
              ? createTableRow.sql.replace(/^CREATE\s+TABLE\b/i, 'CREATE TEMP TABLE')
              : createTableRow.sql;
          const queries = this.#queryGenerator._addColumnToTableQuery(
            tableName,
            createTableSql,
            physicalColumnName,
            columnDefinition,
            copiedColumnNames,
            [
              ...schemaObjects.map(schemaObject => schemaObject.sql),
              ...temporaryTableTriggers.map(trigger =>
                trigger.sql.replace(/^CREATE\s+TRIGGER\b/i, 'CREATE TEMP TRIGGER'),
              ),
            ],
            views,
            viewTriggers,
            autoincrementSequence,
          );
          await this.executeQueriesSequentially(queries, { ...options, transaction, raw: true });

          const foreignKeyCheckResult = await this.#sequelize.queryRaw(
            this.#queryGenerator.foreignKeyCheckQuery(tableName),
            { ...options, transaction, type: QueryTypes.SELECT },
          );

          if (foreignKeyCheckResult.length > 0) {
            throw new ForeignKeyConstraintError({
              message: `Foreign key violations detected: ${JSON.stringify(foreignKeyCheckResult, null, 2)}`,
              table: table.tableName,
            });
          }
        },
      );
    });
  }

  /**
   * Alters a table in sqlite.
   * Workaround for sqlite's limited alter table support.
   *
   * @param tableName
   * @param columns
   * @param options
   * @param replacedColumnNames
   * @param createTableSqlOverride
   * @param renamedColumns
   */
  async alterTableInternal(
    tableName: TableOrModel,
    columns: SqliteColumnsDescription,
    options?: QueryRawOptions,
    replacedColumnNames: readonly string[] = [],
    createTableSqlOverride?: string,
    renamedColumns: ReadonlyMap<string, string> = new Map(),
  ): Promise<void> {
    const table = this.#queryGenerator.extractTableDetails(tableName);
    await this.#assertCanRebuildTableInTransaction(tableName, options);

    await withSqliteForeignKeysOff(this.#sequelize, options, async () => {
      await this.#sequelize.transaction(
        {
          nestMode: TransactionNestMode.savepoint,
          transaction: options?.transaction,
        },
        async transaction => {
          const [schemaRow] = await this.#sequelize.queryRaw<{
            schemaCatalog: SqliteSchemaCatalog;
            sql: string;
          }>(
            `SELECT sql, 'sqlite_temp_master' AS schemaCatalog FROM sqlite_temp_master WHERE type = 'table' AND name = ${this.#queryGenerator.escape(table.tableName)} UNION ALL SELECT sql, 'sqlite_master' AS schemaCatalog FROM sqlite_master WHERE type = 'table' AND name = ${this.#queryGenerator.escape(table.tableName)}`,
            { ...options, transaction, type: QueryTypes.SELECT },
          );
          const schemaObjects = schemaRow
            ? await this.#sequelize.queryRaw<{ sql: string }>(
                `SELECT sql FROM ${schemaRow.schemaCatalog} WHERE tbl_name = ${this.#queryGenerator.escape(table.tableName)} AND type IN ('index', 'trigger') AND sql IS NOT NULL ORDER BY rowid`,
                { ...options, transaction, type: QueryTypes.SELECT },
              )
            : [];
          const temporaryTableTriggers =
            schemaRow?.schemaCatalog === 'sqlite_master'
              ? await this.#sequelize.queryRaw<{ sql: string }>(
                  `SELECT sql FROM sqlite_temp_master WHERE tbl_name = ${this.#queryGenerator.escape(table.tableName)} AND type = 'trigger' AND sql IS NOT NULL ORDER BY rowid`,
                  { ...options, transaction, type: QueryTypes.SELECT },
                )
              : [];
          const { triggers: viewTriggers, views } = schemaRow
            ? await this.#getViewsForTableRebuild(schemaRow.schemaCatalog, {
                ...options,
                transaction,
              })
            : { triggers: [], views: [] };
          let autoincrementSequence: SqliteAutoincrementSequence | undefined;
          if (schemaRow && /\bAUTOINCREMENT\b/i.test(schemaRow.sql)) {
            const schemaName = schemaRow.schemaCatalog === 'sqlite_master' ? 'main' : 'temp';
            const [sequenceRow] = await this.#sequelize.queryRaw<{ seq: string }>(
              `SELECT CAST(seq AS TEXT) AS seq FROM ${this.#queryGenerator.quoteIdentifier(schemaName)}.${this.#queryGenerator.quoteIdentifier('sqlite_sequence')} WHERE name = ${this.#queryGenerator.escape(table.tableName)}`,
              { ...options, transaction, type: QueryTypes.SELECT },
            );
            if (sequenceRow) {
              autoincrementSequence = { schemaName, value: sequenceRow.seq };
            }
          }

          if (replacedColumnNames.length > 0) {
            const replacedColumns = new Set(replacedColumnNames.map(name => name.toLowerCase()));
            const indexes = await this.dialect.queryInterface.showIndex(tableName, {
              ...options,
              transaction,
            });
            for (const index of indexes) {
              if (
                !index.name.startsWith('sqlite_autoindex_') ||
                !index.unique ||
                index.fields.length !== 1
              ) {
                continue;
              }

              const columnName = index.fields[0].attribute;
              if (
                columnName &&
                columns[columnName] &&
                replacedColumns.has(columnName.toLowerCase())
              ) {
                columns[columnName].unique = true;
              }
            }
          }

          const replaceRenamedColumns = (sql: string): string => {
            let replacedSql = sql;
            for (const [newColumnName, oldColumnName] of renamedColumns) {
              replacedSql = replaceSqlIdentifier(replacedSql, oldColumnName, newColumnName);
            }

            return replacedSql;
          };

          const rawCreateTableSql = createTableSqlOverride ?? schemaRow?.sql;
          const transformedCreateTableSql = rawCreateTableSql
            ? replaceRenamedColumns(rawCreateTableSql)
            : undefined;

          const createTableSql =
            schemaRow?.schemaCatalog === 'sqlite_temp_master' && transformedCreateTableSql
              ? transformedCreateTableSql.replace(/^CREATE\s+TABLE\b/i, 'CREATE TEMP TABLE')
              : transformedCreateTableSql;
          const transformedViews = views.map(view => ({
            ...view,
            sql: replaceRenamedColumns(view.sql),
          }));
          const transformedViewTriggers = viewTriggers.map(replaceRenamedColumns);
          const sql = this.#queryGenerator._replaceTableQuery(
            tableName,
            columns,
            createTableSql,
            replacedColumnNames,
            autoincrementSequence,
            transformedViews,
            transformedViewTriggers,
            renamedColumns,
          );
          await this.executeQueriesSequentially(sql, { ...options, transaction, raw: true });
          await this.executeQueriesSequentially(
            [
              ...schemaObjects.map(schemaObject => replaceRenamedColumns(schemaObject.sql)),
              ...temporaryTableTriggers.map(trigger =>
                replaceRenamedColumns(
                  trigger.sql.replace(/^CREATE\s+TRIGGER\b/i, 'CREATE TEMP TRIGGER'),
                ),
              ),
            ],
            { ...options, transaction, raw: true },
          );

          // Run a foreign keys integrity check
          const foreignKeyCheckResult = await this.#sequelize.queryRaw(
            this.#queryGenerator.foreignKeyCheckQuery(tableName),
            {
              ...options,
              transaction,
              type: QueryTypes.SELECT,
            },
          );

          if (foreignKeyCheckResult.length > 0) {
            // There are foreign key violations, exit
            throw new ForeignKeyConstraintError({
              message: `Foreign key violations detected: ${JSON.stringify(foreignKeyCheckResult, null, 2)}`,
              table: table.tableName,
            });
          }
        },
      );
    });
  }
}
