import type { AttributeOptions, QueryRawOptions, Sequelize, TableOrModel } from '@sequelize/core';
import { ForeignKeyConstraintError, QueryTypes, TransactionNestMode } from '@sequelize/core';
import { AbstractQueryInterfaceInternal } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-interface-internal.js';
import { withSqliteForeignKeysOff } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/sql.js';
import type { SqliteDialect } from './dialect.js';
import type { SqliteQueryGenerator } from './query-generator.js';
import type { SqliteColumnsDescription } from './query-interface.types.js';

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
      catalog: 'sqlite_master' | 'sqlite_temp_master';
      schemaName: 'main' | 'temp';
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
            schemaCatalog: 'sqlite_master' | 'sqlite_temp_master';
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
          const views = await this.#sequelize.queryRaw<{ name: string; sql: string }>(
            `SELECT name, sql FROM ${createTableRow.schemaCatalog} WHERE type = 'view' AND sql IS NOT NULL ORDER BY rowid`,
            { ...options, transaction, type: QueryTypes.SELECT },
          );
          const viewTriggers = await this.#sequelize.queryRaw<{ sql: string }>(
            `SELECT sql FROM ${createTableRow.schemaCatalog} WHERE type = 'trigger' AND tbl_name IN (SELECT name FROM ${createTableRow.schemaCatalog} WHERE type = 'view') AND sql IS NOT NULL ORDER BY rowid`,
            { ...options, transaction, type: QueryTypes.SELECT },
          );
          let autoincrementHighWater: number | undefined;

          if (createTableRow.schemaCatalog === 'sqlite_master') {
            const sqliteSequenceExists = await this.#sequelize.queryRaw(
              `SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'sqlite_sequence'`,
              { ...options, transaction, type: QueryTypes.SELECT },
            );

            if (sqliteSequenceExists.length > 0) {
              const [sequenceRow] = await this.#sequelize.queryRaw<{ seq: number }>(
                `SELECT seq FROM sqlite_sequence WHERE name = ${escapedTableName}`,
                { ...options, transaction, type: QueryTypes.SELECT },
              );
              autoincrementHighWater = sequenceRow?.seq;
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
          const recreatedViews =
            createTableRow.schemaCatalog === 'sqlite_temp_master'
              ? views.map(view => ({
                  ...view,
                  sql: view.sql.replace(/^CREATE\s+VIEW\b/i, 'CREATE TEMP VIEW'),
                }))
              : views;
          const recreatedViewTriggers =
            createTableRow.schemaCatalog === 'sqlite_temp_master'
              ? viewTriggers.map(trigger =>
                  trigger.sql.replace(/^CREATE\s+TRIGGER\b/i, 'CREATE TEMP TRIGGER'),
                )
              : viewTriggers.map(trigger => trigger.sql);
          const queries = this.#queryGenerator._addColumnToTableQuery(
            tableName,
            createTableSql,
            physicalColumnName,
            columnDefinition,
            copiedColumnNames,
            schemaObjects.map(schemaObject => schemaObject.sql),
            recreatedViews,
            recreatedViewTriggers,
            autoincrementHighWater,
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
   */
  async alterTableInternal(
    tableName: TableOrModel,
    columns: SqliteColumnsDescription,
    options?: QueryRawOptions,
    replacedColumnNames: readonly string[] = [],
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
            schemaCatalog: 'sqlite_master' | 'sqlite_temp_master';
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
          let autoincrementHighWater: number | undefined;
          if (
            schemaRow?.schemaCatalog === 'sqlite_master' &&
            /\bAUTOINCREMENT\b/i.test(schemaRow.sql)
          ) {
            const [sequenceRow] = await this.#sequelize.queryRaw<{ seq: number }>(
              `SELECT seq FROM sqlite_sequence WHERE name = ${this.#queryGenerator.escape(table.tableName)}`,
              { ...options, transaction, type: QueryTypes.SELECT },
            );
            autoincrementHighWater = sequenceRow?.seq;
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

          const createTableSql =
            schemaRow?.schemaCatalog === 'sqlite_temp_master'
              ? schemaRow.sql.replace(/^CREATE\s+TABLE\b/i, 'CREATE TEMP TABLE')
              : schemaRow?.sql;
          const sql = this.#queryGenerator._replaceTableQuery(
            tableName,
            columns,
            createTableSql,
            replacedColumnNames,
            autoincrementHighWater,
          );
          await this.executeQueriesSequentially(sql, { ...options, transaction, raw: true });
          await this.executeQueriesSequentially(
            schemaObjects.map(schemaObject => schemaObject.sql),
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
