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

// quoted strings, quoted identifiers and comments, which scanSql skips
const CLOSING_DELIMITERS = new Map([
  ["'", "'"],
  ['"', '"'],
  ['`', '`'],
  ['[', ']'],
  ['--', '\n'],
  ['/*', '*/'],
]);

/**
 * Calls `visit` with each character of `sql` that is not inside a quoted string, quoted identifier or comment,
 * and the parenthesis depth once that character is read, until `visit` returns true.
 *
 * @param sql
 * @param start index to start reading at
 * @param visit
 * @returns the index `visit` returned true at, or -1
 */
function scanSql(
  sql: string,
  start: number,
  visit: (char: string, index: number, depth: number) => boolean,
): number {
  let depth = 0;
  for (let i = start; i < sql.length; i++) {
    const opening = ['--', '/*'].find(delimiter => sql.startsWith(delimiter, i)) ?? sql[i];
    const closing = CLOSING_DELIMITERS.get(opening);
    if (closing) {
      // an escaped quote ('it''s') is read as two adjacent quoted strings
      const closingIndex = sql.indexOf(closing, i + opening.length);
      if (closingIndex === -1) {
        return -1;
      }

      i = closingIndex + closing.length - 1;
      continue;
    }

    if (sql[i] === '(') {
      depth++;
    } else if (sql[i] === ')') {
      depth--;
    }

    if (visit(sql[i], i, depth)) {
      return i;
    }
  }

  return -1;
}

/**
 * Returns the expression of each generated column declared in a CREATE TABLE statement, keyed by column name.
 * SQLite keeps these expressions nowhere but in the statement it stores in sqlite_master.
 *
 * @param createTableSql
 */
export function getGeneratedColumnExpressions(createTableSql: string): Map<string, string> {
  // the column definitions are the comma-separated parts of the outermost parentheses
  const definitions: string[] = [];
  let definitionStart = -1;
  scanSql(createTableSql, 0, (char, index, depth) => {
    if (depth === 1 && (char === '(' || char === ',')) {
      if (definitionStart !== -1) {
        definitions.push(createTableSql.slice(definitionStart, index));
      }

      definitionStart = index + 1;
    } else if (depth === 0 && char === ')') {
      definitions.push(createTableSql.slice(definitionStart, index));

      return true;
    }

    return false;
  });

  const expressions = new Map<string, string>();
  for (const definition of definitions) {
    const name = /^\s*(?:"((?:[^"]|"")*)"|`((?:[^`]|``)*)`|\[([^\]]*)]|(\S+))/.exec(definition)!;

    // the generation clause is "[GENERATED ALWAYS] AS (expression)"
    const asIndex = scanSql(
      definition,
      name[0].length,
      (char, index, depth) =>
        depth === 0 &&
        /[\s)]/.test(definition[index - 1]) &&
        /^as\s*\(/i.test(definition.slice(index)),
    );
    if (asIndex === -1) {
      continue;
    }

    const open = definition.indexOf('(', asIndex);
    const close = scanSql(definition, open, (char, _index, depth) => char === ')' && depth === 0);
    expressions.set(
      name[1]?.replaceAll('""', '"') ?? name[2]?.replaceAll('``', '`') ?? name[3] ?? name[4],
      definition.slice(open + 1, close),
    );
  }

  return expressions;
}
