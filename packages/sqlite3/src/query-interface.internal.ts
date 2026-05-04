import type { AttributeOptions, QueryRawOptions, Sequelize, TableOrModel } from '@sequelize/core';
import { ForeignKeyConstraintError, QueryTypes, TransactionNestMode } from '@sequelize/core';
import { AbstractQueryInterfaceInternal } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-interface-internal.js';
import { withSqliteForeignKeysOff } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/sql.js';
import type { SqliteDialect } from './dialect.js';
import type { SqliteQueryGenerator } from './query-generator.js';
import type { SqliteQueryInterface } from './query-interface.js';
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

  get #queryInterface(): SqliteQueryInterface {
    return this.dialect.queryInterface;
  }

  async addColumnInternal(
    tableName: TableOrModel,
    columnName: string,
    attribute: AttributeOptions,
    options?: QueryRawOptions,
  ): Promise<void> {
    const table = this.#queryGenerator.extractTableDetails(tableName);

    await withSqliteForeignKeysOff(this.#sequelize, options, async () => {
      await this.#sequelize.transaction(
        {
          nestMode: TransactionNestMode.savepoint,
          transaction: options?.transaction,
        },
        async transaction => {
          const escapedTableName = this.#queryGenerator.escape(table.tableName);
          const [createTableRow] = await this.#sequelize.queryRaw<{ sql: string }>(
            `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ${escapedTableName}`,
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
            `SELECT sql FROM sqlite_master WHERE tbl_name = ${escapedTableName} AND type IN ('index', 'trigger') AND sql IS NOT NULL ORDER BY type, name`,
            { ...options, transaction, type: QueryTypes.SELECT },
          );
          const views = await this.#sequelize.queryRaw<{ name: string; sql: string }>(
            `SELECT name, sql FROM sqlite_master WHERE type = 'view' AND sql IS NOT NULL ORDER BY rowid`,
            { ...options, transaction, type: QueryTypes.SELECT },
          );
          const viewTriggers = await this.#sequelize.queryRaw<{ sql: string }>(
            `SELECT sql FROM sqlite_master WHERE type = 'trigger' AND tbl_name IN (SELECT name FROM sqlite_master WHERE type = 'view') AND sql IS NOT NULL ORDER BY rowid`,
            { ...options, transaction, type: QueryTypes.SELECT },
          );
          const sqliteSequenceExists = await this.#sequelize.queryRaw(
            `SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'sqlite_sequence'`,
            { ...options, transaction, type: QueryTypes.SELECT },
          );
          let autoincrementHighWater: number | undefined;

          if (sqliteSequenceExists.length > 0) {
            const [sequenceRow] = await this.#sequelize.queryRaw<{ seq: number }>(
              `SELECT seq FROM sqlite_sequence WHERE name = ${escapedTableName}`,
              { ...options, transaction, type: QueryTypes.SELECT },
            );
            autoincrementHighWater = sequenceRow?.seq;
          }

          const columnSql = this.#queryGenerator.attributesToSQL(
            { [columnName]: attribute } as unknown as SqliteColumnsDescription,
            {
              context: 'addColumn',
              table: table.tableName,
            },
          );
          const queries = this.#queryGenerator._addColumnToTableQuery(
            tableName,
            createTableRow.sql,
            columnName,
            columnSql[columnName],
            copiedColumnNames,
            schemaObjects.map(schemaObject => schemaObject.sql),
            views,
            viewTriggers.map(trigger => trigger.sql),
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
   */
  async alterTableInternal(
    tableName: TableOrModel,
    columns: SqliteColumnsDescription,
    options?: QueryRawOptions,
  ): Promise<void> {
    const table = this.#queryGenerator.extractTableDetails(tableName);

    await withSqliteForeignKeysOff(this.#sequelize, options, async () => {
      await this.#sequelize.transaction(
        {
          nestMode: TransactionNestMode.savepoint,
          transaction: options?.transaction,
        },
        async transaction => {
          const indexes = await this.#queryInterface.showIndex(tableName, {
            ...options,
            transaction,
          });

          for (const index of indexes) {
            // This index is reserved by SQLite, we can't add it through addIndex and must use "UNIQUE" on the column definition instead.
            if (!index.name.startsWith('sqlite_autoindex_')) {
              continue;
            }

            if (!index.unique) {
              continue;
            }

            for (const field of index.fields) {
              if (columns[field.attribute]) {
                columns[field.attribute].unique = true;
              }
            }
          }

          const sql = this.#queryGenerator._replaceTableQuery(tableName, columns);
          await this.executeQueriesSequentially(sql, { ...options, transaction, raw: true });

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

          await Promise.all(
            indexes.map(async index => {
              // This index is reserved by SQLite, we can't add it through addIndex and must use "UNIQUE" on the column definition instead.
              if (index.name.startsWith('sqlite_autoindex_')) {
                return;
              }

              return this.#sequelize.queryInterface.addIndex(tableName, {
                ...index,
                type: undefined,
                transaction,
                fields: index.fields.map(field => field.attribute),
              });
            }),
          );
        },
      );
    });
  }
}
