import type { QueryRawOptions, Sequelize, TableOrModel } from '@sequelize/core';
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
