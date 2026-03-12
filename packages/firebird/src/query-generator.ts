import { AbstractQueryGenerator } from '@sequelize/core';
import { TRUNCATE_TABLE_QUERY_SUPPORTABLE_OPTIONS } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator-typescript.js';
import type {
  TableOrModel,
  TruncateTableQueryOptions,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator.types.js';
import { rejectInvalidOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import { joinSQLFragments } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/join-sql-fragments.js';
import type { FirebirdDialect } from './dialect.js';
import { FirebirdQueryGeneratorInternal } from './query-generator.internal.js';

/**
 * FirebirdQueryGenerator
 *
 * Key Firebird SQL differences:
 *  - FIRST / SKIP instead of LIMIT / OFFSET
 *  - Double-quoted identifiers
 *  - No TRUNCATE TABLE → DELETE FROM
 *  - Sequences + BEFORE INSERT triggers for auto-increment
 *  - RDB$DATABASE as the "dual" table
 *  - No RENAME TABLE support
 */
export class FirebirdQueryGenerator extends AbstractQueryGenerator {
  declare dialect: FirebirdDialect;

  constructor(
    dialect: FirebirdDialect,
    internals: FirebirdQueryGeneratorInternal = new FirebirdQueryGeneratorInternal(dialect),
  ) {
    super(dialect, internals);
  }

  // ── Version ──────────────────────────────────────────────────────────────────

  override versionQuery(): string {
    return `SELECT rdb$get_context('SYSTEM', 'ENGINE_VERSION') AS "version" FROM RDB$DATABASE`;
  }

  // ── Tables ──────────────────────────────────────────────────────────────────

  override listTablesQuery(): string {
    return joinSQLFragments([
      'SELECT TRIM(RDB$RELATION_NAME) AS "tableName"',
      'FROM RDB$RELATIONS',
      'WHERE RDB$SYSTEM_FLAG = 0',
      'AND RDB$VIEW_BLR IS NULL',
      'ORDER BY RDB$RELATION_NAME',
    ]);
  }

  override tableExistsQuery(tableName: TableOrModel): string {
    const table = this.extractTableDetails(tableName);

    return joinSQLFragments([
      'SELECT TRIM(RDB$RELATION_NAME) AS "tableName"',
      'FROM RDB$RELATIONS',
      'WHERE RDB$SYSTEM_FLAG = 0',
      'AND RDB$VIEW_BLR IS NULL',
      `AND TRIM(RDB$RELATION_NAME) = ${this.escape(table.tableName)}`,
    ]);
  }

  override truncateTableQuery(
    tableName: TableOrModel,
    options?: TruncateTableQueryOptions,
  ): string {
    if (options) {
      rejectInvalidOptions(
        'truncateTableQuery',
        this.dialect,
        TRUNCATE_TABLE_QUERY_SUPPORTABLE_OPTIONS,
        this.dialect.supports.truncate,
        options,
      );
    }

    // Firebird has no TRUNCATE TABLE; use DELETE FROM instead
    return `DELETE FROM ${this.quoteTable(tableName)}`;
  }

  override renameTableQuery(): string {
    throw new Error('Firebird does not support renaming tables. Recreate the table manually.');
  }

  // ── Indexes ─────────────────────────────────────────────────────────────────

  override showIndexesQuery(tableName: TableOrModel): string {
    const table = this.extractTableDetails(tableName);

    return joinSQLFragments([
      'SELECT',
      '  TRIM(i.RDB$INDEX_NAME)   AS "name",',
      '  TRIM(s.RDB$FIELD_NAME)   AS "column_name",',
      '  i.RDB$UNIQUE_FLAG        AS "unique",',
      '  i.RDB$INDEX_TYPE         AS "descending"',
      'FROM RDB$INDICES i',
      'JOIN RDB$INDEX_SEGMENTS s ON s.RDB$INDEX_NAME = i.RDB$INDEX_NAME',
      `WHERE TRIM(i.RDB$RELATION_NAME) = ${this.escape(table.tableName)}`,
      'ORDER BY s.RDB$FIELD_POSITION',
    ]);
  }

  override removeIndexQuery(
    tableName: TableOrModel,
    indexNameOrAttributes: string | string[],
  ): string {
    let indexName: string;

    if (typeof indexNameOrAttributes === 'string') {
      indexName = indexNameOrAttributes;
    } else {
      const table = this.extractTableDetails(tableName);
      indexName = `${table.tableName}_${indexNameOrAttributes.join('_')}`.toLowerCase();
    }

    return `DROP INDEX ${this.quoteIdentifier(indexName)}`;
  }

  // ── Describe table ───────────────────────────────────────────────────────────

  override describeTableQuery(tableName: TableOrModel): string {
    const table = this.extractTableDetails(tableName);

    return joinSQLFragments([
      'SELECT',
      '  TRIM(rf.RDB$FIELD_NAME) AS "Field",',
      '  CASE f.RDB$FIELD_TYPE',
      "    WHEN 7   THEN 'SMALLINT'",
      "    WHEN 8   THEN 'INTEGER'",
      "    WHEN 10  THEN 'FLOAT'",
      "    WHEN 12  THEN 'DATE'",
      "    WHEN 13  THEN 'TIME'",
      "    WHEN 14  THEN 'CHAR'",
      "    WHEN 16  THEN 'BIGINT'",
      "    WHEN 23  THEN 'BOOLEAN'",
      "    WHEN 27  THEN 'DOUBLE PRECISION'",
      "    WHEN 35  THEN 'TIMESTAMP'",
      "    WHEN 37  THEN 'VARCHAR'",
      "    WHEN 261 THEN 'BLOB'",
      "    ELSE 'UNKNOWN'",
      '  END AS "Type",',
      "  IIF(rf.RDB$NULL_FLAG = 1, 'NO', 'YES') AS \"Null\",",
      '  rf.RDB$DEFAULT_SOURCE AS "Default",',
      "  IIF(rc.RDB$CONSTRAINT_TYPE = 'PRIMARY KEY', 'PRI', '') AS \"Key\"",
      'FROM RDB$RELATION_FIELDS rf',
      'JOIN RDB$FIELDS f ON f.RDB$FIELD_NAME = rf.RDB$FIELD_SOURCE',
      'LEFT JOIN RDB$INDEX_SEGMENTS iseg ON iseg.RDB$FIELD_NAME = rf.RDB$FIELD_NAME',
      'LEFT JOIN RDB$RELATION_CONSTRAINTS rc',
      '  ON  rc.RDB$INDEX_NAME    = iseg.RDB$INDEX_NAME',
      '  AND rc.RDB$RELATION_NAME = rf.RDB$RELATION_NAME',
      "  AND rc.RDB$CONSTRAINT_TYPE = 'PRIMARY KEY'",
      `WHERE TRIM(rf.RDB$RELATION_NAME) = ${this.escape(table.tableName)}`,
      'ORDER BY rf.RDB$FIELD_POSITION',
    ]);
  }

  // ── Sequences (auto-increment) ───────────────────────────────────────────────

  createSequenceQuery(sequenceName: string): string {
    return `CREATE SEQUENCE ${this.quoteIdentifier(sequenceName)}`;
  }

  createAutoIncrementTriggerQuery(
    tableName: string,
    columnName: string,
    sequenceName: string,
  ): string {
    const triggerName = `${tableName}_BI`.toUpperCase();

    return joinSQLFragments([
      `CREATE OR ALTER TRIGGER ${this.quoteIdentifier(triggerName)}`,
      `FOR ${this.quoteTable(tableName)}`,
      'ACTIVE BEFORE INSERT POSITION 0',
      'AS',
      'BEGIN',
      `  IF (NEW.${this.quoteIdentifier(columnName)} IS NULL) THEN`,
      `    NEW.${this.quoteIdentifier(columnName)} = NEXT VALUE FOR ${this.quoteIdentifier(sequenceName)};`,
      'END',
    ]);
  }
}
