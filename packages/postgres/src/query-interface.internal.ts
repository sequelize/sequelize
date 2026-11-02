import type { QueryRawOptions, TableOrModel } from '@sequelize/core';
import { QueryTypes } from '@sequelize/core';
import { AbstractQueryInterfaceInternal } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-interface-internal.js';
import type { PostgresDialect } from './dialect.js';

export class PostgresQueryInterfaceInternal extends AbstractQueryInterfaceInternal {
  constructor(readonly dialect: PostgresDialect) {
    super(dialect);
  }

  /**
   * Unlike {@link AbstractQueryInterfaceInternal#hasUniqueKey}, this ignores partial unique indexes
   * and unique indexes that include expressions, as they do not make the column itself unique.
   *
   * Unique constraints and primary keys are backed by a unique index, so only the indexes need to be checked.
   *
   * @param tableName The table that contains the column
   * @param columnName The name of the column, as it is in the database
   * @param options Query options
   */
  async hasUniqueKey(
    tableName: TableOrModel,
    columnName: string,
    options?: QueryRawOptions,
  ): Promise<boolean> {
    const queryGenerator = this.dialect.queryGenerator;
    const table = queryGenerator.extractTableDetails(tableName);
    // unquoted identifiers are folded to lower case
    const attributeName = this.dialect.sequelize.options.quoteIdentifiers
      ? columnName
      : columnName.toLowerCase();

    const [result] = await this.dialect.sequelize.queryRaw<{ exists: boolean }>(
      [
        'SELECT EXISTS (SELECT 1 FROM pg_index ix',
        'JOIN pg_class t ON t.oid = ix.indrelid',
        'JOIN pg_namespace s ON s.oid = t.relnamespace',
        'JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ix.indkey[0]',
        `WHERE s.nspname = ${queryGenerator.escape(table.schema)}`,
        `AND t.relname = ${queryGenerator.escape(table.tableName)}`,
        `AND a.attname = ${queryGenerator.escape(attributeName)}`,
        'AND ix.indisunique AND ix.indnkeyatts = 1 AND ix.indpred IS NULL AND ix.indexprs IS NULL',
        ') AS "exists"',
      ].join(' '),
      { ...options, type: QueryTypes.SELECT },
    );

    return result.exists;
  }
}
