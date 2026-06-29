import type {
  BulkDeleteQueryOptions,
  GetConstraintSnippetQueryOptions,
  ListTablesQueryOptions,
  RemoveColumnQueryOptions,
  RemoveIndexQueryOptions,
  ShowConstraintsQueryOptions,
  StartTransactionQueryOptions,
  TableOrModel,
  TruncateTableQueryOptions,
} from '@sequelize/core';
import { AbstractQueryGenerator, IsolationLevel } from '@sequelize/core';
import {
  LIST_TABLES_QUERY_SUPPORTABLE_OPTIONS,
  REMOVE_INDEX_QUERY_SUPPORTABLE_OPTIONS,
  START_TRANSACTION_QUERY_SUPPORTABLE_OPTIONS,
  TRUNCATE_TABLE_QUERY_SUPPORTABLE_OPTIONS,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator-typescript.js';
import { rejectInvalidOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import { joinSQLFragments } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/join-sql-fragments.js';
import { extractModelDefinition } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/model-utils.js';
import { EMPTY_SET } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/object.js';
import { generateIndexName } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/string.js';
import { randomBytes } from 'node:crypto';
import type { SqliteDialect } from './dialect.js';
import { SqliteQueryGeneratorInternal } from './query-generator.internal.js';
import type { SqliteColumnsDescription } from './query-interface.types.js';
import {
  findSqlClosingParenthesis,
  findSqlOpeningParenthesis,
  getSqlColumnName,
} from './sqlite-schema-parser.js';

const REMOVE_INDEX_QUERY_SUPPORTED_OPTIONS = new Set<keyof RemoveIndexQueryOptions>(['ifExists']);
const TRUNCATE_TABLE_QUERY_SUPPORTED_OPTIONS = new Set<keyof TruncateTableQueryOptions>([
  'restartIdentity',
]);

function replaceCreateTableName(createTableSql: string, replacement: string): string {
  const tableName =
    /^(\s*CREATE\s+(?:(?:TEMP|TEMPORARY)\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?)(?:"(?:[^"]|"")*"|`(?:[^`]|``)*`|\[(?:[^\]]|\]\])*\]|[^\s(]+)/i.exec(
      createTableSql,
    );

  if (!tableName) {
    throw new Error(`Could not parse CREATE TABLE statement: ${createTableSql}`);
  }

  return `${tableName[1]}${replacement}${createTableSql.slice(tableName[0].length)}`;
}

function splitColumnDefinitions(createTableSql: string): {
  closingParenthesis: number;
  definitions: string[];
  openingParenthesis: number;
} {
  const openingParenthesis = findSqlOpeningParenthesis(createTableSql);
  const closingParenthesis = findSqlClosingParenthesis(createTableSql, openingParenthesis);
  if (openingParenthesis === -1 || closingParenthesis === -1) {
    throw new Error(`Could not parse CREATE TABLE statement: ${createTableSql}`);
  }

  const definitions: string[] = [];
  let definitionStart = openingParenthesis + 1;
  let depth = 0;
  let closingQuote: string | undefined;
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = definitionStart; index < closingParenthesis; index++) {
    const character = createTableSql[index];

    if (inLineComment) {
      if (character === '\n' || character === '\r') {
        inLineComment = false;
      }

      continue;
    }

    if (inBlockComment) {
      if (character === '*' && createTableSql[index + 1] === '/') {
        inBlockComment = false;
        index++;
      }

      continue;
    }

    if (closingQuote) {
      if (character === closingQuote) {
        if (createTableSql[index + 1] === closingQuote) {
          index++;
        } else {
          closingQuote = undefined;
        }
      }

      continue;
    }

    if (character === '-' && createTableSql[index + 1] === '-') {
      inLineComment = true;
      index++;
    } else if (character === '/' && createTableSql[index + 1] === '*') {
      inBlockComment = true;
      index++;
    } else if (character === "'" || character === '"' || character === '`') {
      closingQuote = character;
    } else if (character === '[') {
      closingQuote = ']';
    } else if (character === '(') {
      depth++;
    } else if (character === ')') {
      depth--;
    } else if (character === ',' && depth === 0) {
      definitions.push(createTableSql.slice(definitionStart, index).trim());
      definitionStart = index + 1;
    }
  }

  definitions.push(createTableSql.slice(definitionStart, closingParenthesis).trim());

  return { closingParenthesis, definitions, openingParenthesis };
}

function replaceColumnDefinitions(
  createTableSql: string,
  replacements: ReadonlyMap<string, string | undefined>,
): string {
  const { closingParenthesis, definitions, openingParenthesis } =
    splitColumnDefinitions(createTableSql);
  const replacedDefinitions = definitions.flatMap(definition => {
    const columnName = getSqlColumnName(definition)?.toLowerCase();
    if (!columnName || !replacements.has(columnName)) {
      return [definition];
    }

    const replacement = replacements.get(columnName);

    return replacement === undefined ? [] : [replacement];
  });

  return `${createTableSql.slice(0, openingParenthesis + 1)}${replacedDefinitions.join(', ')}${createTableSql.slice(closingParenthesis)}`;
}

/**
 * Temporary class to ease the TypeScript migration
 */
export class SqliteQueryGeneratorTypeScript extends AbstractQueryGenerator {
  readonly #internals: SqliteQueryGeneratorInternal;

  constructor(
    dialect: SqliteDialect,
    internals: SqliteQueryGeneratorInternal = new SqliteQueryGeneratorInternal(dialect),
  ) {
    super(dialect, internals);

    this.#internals = internals;
  }

  describeTableQuery(tableName: TableOrModel) {
    const pragma =
      this.dialect.supports.generatedColumns.stored ||
      this.dialect.supports.generatedColumns.virtual
        ? 'TABLE_XINFO'
        : 'TABLE_INFO';

    return `PRAGMA ${pragma}(${this.quoteTable(tableName)})`;
  }

  describeCreateTableQuery(tableName: TableOrModel) {
    const escapedTableName = this.escapeTable(tableName);

    return `SELECT sql FROM sqlite_temp_master WHERE tbl_name = ${escapedTableName} UNION ALL SELECT sql FROM sqlite_master WHERE tbl_name = ${escapedTableName};`;
  }

  listTablesQuery(options?: ListTablesQueryOptions) {
    if (options) {
      rejectInvalidOptions(
        'listTablesQuery',
        this.dialect,
        LIST_TABLES_QUERY_SUPPORTABLE_OPTIONS,
        EMPTY_SET,
        options,
      );
    }

    return "SELECT name AS `tableName` FROM sqlite_master WHERE type='table' AND name != 'sqlite_sequence'";
  }

  truncateTableQuery(tableName: TableOrModel, options?: TruncateTableQueryOptions) {
    if (options) {
      rejectInvalidOptions(
        'truncateTableQuery',
        this.dialect,
        TRUNCATE_TABLE_QUERY_SUPPORTABLE_OPTIONS,
        TRUNCATE_TABLE_QUERY_SUPPORTED_OPTIONS,
        options,
      );
    }

    const sql = [`DELETE FROM ${this.quoteTable(tableName)}`];
    if (options?.restartIdentity) {
      sql.push(
        `DELETE FROM ${this.quoteTable('sqlite_sequence')} WHERE ${this.quoteIdentifier('name')} = ${this.escapeTable(tableName)}`,
      );
    }

    return sql;
  }

  showConstraintsQuery(tableName: TableOrModel, _options?: ShowConstraintsQueryOptions) {
    return joinSQLFragments([
      'SELECT sql FROM sqlite_master',
      `WHERE tbl_name = ${this.escapeTable(tableName)}`,
    ]);
  }

  showIndexesQuery(tableName: TableOrModel) {
    return `PRAGMA INDEX_LIST(${this.quoteTable(tableName)})`;
  }

  getToggleForeignKeyChecksQuery(enable: boolean): string {
    return `PRAGMA foreign_keys = ${enable ? 'ON' : 'OFF'}`;
  }

  renameColumnQuery(
    tableName: TableOrModel,
    attrNameBefore: string,
    attrNameAfter: string,
    _attributes: SqliteColumnsDescription,
  ): string {
    return `ALTER TABLE ${this.quoteTable(tableName)} RENAME COLUMN ${this.quoteIdentifier(attrNameBefore)} TO ${this.quoteIdentifier(attrNameAfter)}`;
  }

  removeColumnQuery(
    _table: TableOrModel,
    _columnName: string,
    _options?: RemoveColumnQueryOptions,
  ): string {
    throw new Error(`removeColumnQuery is not supported in ${this.dialect.name}.`);
  }

  removeIndexQuery(
    tableName: TableOrModel,
    indexNameOrAttributes: string | string[],
    options?: RemoveIndexQueryOptions,
  ) {
    if (options) {
      rejectInvalidOptions(
        'removeIndexQuery',
        this.dialect,
        REMOVE_INDEX_QUERY_SUPPORTABLE_OPTIONS,
        REMOVE_INDEX_QUERY_SUPPORTED_OPTIONS,
        options,
      );
    }

    let indexName: string;
    if (Array.isArray(indexNameOrAttributes)) {
      const table = this.extractTableDetails(tableName);
      indexName = generateIndexName(table, { fields: indexNameOrAttributes });
    } else {
      indexName = indexNameOrAttributes;
    }

    return joinSQLFragments([
      'DROP INDEX',
      options?.ifExists ? 'IF EXISTS' : '',
      this.quoteIdentifier(indexName),
    ]);
  }

  // SQLite does not support renaming columns. The following is a workaround.
  _replaceColumnQuery(
    tableName: TableOrModel,
    attrNameBefore: string,
    attrNameAfter: string,
    attributes: SqliteColumnsDescription,
  ) {
    const table = this.extractTableDetails(tableName);
    const backupTable = this.extractTableDetails(
      `${table.tableName}_${randomBytes(8).toString('hex')}`,
      table,
    );
    const quotedTableName = this.quoteTable(table);
    const quotedBackupTableName = this.quoteTable(backupTable);

    const tableAttributes = this.attributesToSQL(attributes);
    const copiedAttributes = Object.keys(tableAttributes).filter(
      attributeName => attributes[attributeName].generatedAs === undefined,
    );
    const attributeNamesImport = copiedAttributes
      .map(attr => {
        return attrNameAfter === attr
          ? `${this.quoteIdentifier(attrNameBefore)} AS ${this.quoteIdentifier(attr)}`
          : this.quoteIdentifier(attr);
      })
      .join(', ');
    const attributeNamesExport = copiedAttributes
      .map(attr => this.quoteIdentifier(attr))
      .join(', ');

    return [
      this.createTableQuery(backupTable, tableAttributes),
      `INSERT INTO ${quotedBackupTableName} SELECT ${attributeNamesImport} FROM ${quotedTableName};`,
      `DROP TABLE ${quotedTableName};`,
      this.createTableQuery(table, tableAttributes),
      `INSERT INTO ${quotedTableName} SELECT ${attributeNamesExport} FROM ${quotedBackupTableName};`,
      `DROP TABLE ${quotedBackupTableName};`,
    ];
  }

  // SQLite has limited ALTER TABLE capapibilites which requires the below workaround involving recreating tables.
  // This leads to issues with losing data or losing foreign key references.
  _replaceTableQuery(
    tableName: TableOrModel,
    attributes: SqliteColumnsDescription,
    createTableSql?: string,
    replacedColumnNames: readonly string[] = [],
    autoincrementHighWater?: number,
    views: ReadonlyArray<{ name: string; schemaName: 'main' | 'temp'; sql: string }> = [],
    viewTriggerSql: readonly string[] = [],
  ) {
    const table = this.extractTableDetails(tableName);
    const backupTable = this.extractTableDetails(
      `${table.tableName}_${randomBytes(8).toString('hex')}`,
      table,
    );
    const quotedTableName = this.quoteTable(table);
    const quotedBackupTableName = this.quoteTable(backupTable);

    const tableAttributes = this.attributesToSQL(attributes);
    // Generated columns cannot be inserted into explicitly. SQLite recomputes both
    // VIRTUAL and STORED columns while the ordinary columns are copied.
    const attributeNames = Object.keys(tableAttributes)
      .filter(attributeName => attributes[attributeName].generatedAs === undefined)
      .map(attr => this.quoteIdentifier(attr))
      .join(', ');

    let replacementTableSql = createTableSql;
    if (replacementTableSql && replacedColumnNames.length > 0) {
      const replacements = new Map<string, string | undefined>();
      for (const columnName of replacedColumnNames) {
        const attributeName = Object.keys(tableAttributes).find(
          name => name.toLowerCase() === columnName.toLowerCase(),
        );
        replacements.set(
          columnName.toLowerCase(),
          attributeName
            ? `${this.quoteIdentifier(attributeName)} ${tableAttributes[attributeName]}`
            : undefined,
        );
      }

      replacementTableSql = replaceColumnDefinitions(replacementTableSql, replacements);
    }

    const backupTableSql = replacementTableSql
      ? replaceCreateTableName(replacementTableSql, quotedBackupTableName)
      : this.createTableQuery(backupTable, tableAttributes);

    const queries = [
      backupTableSql,
      `INSERT INTO ${quotedBackupTableName} SELECT ${attributeNames} FROM ${quotedTableName};`,
      ...views.map(
        view =>
          `DROP VIEW ${this.quoteIdentifier(view.schemaName)}.${this.quoteIdentifier(view.name)};`,
      ),
      `DROP TABLE ${quotedTableName};`,
      `ALTER TABLE ${quotedBackupTableName} RENAME TO ${quotedTableName};`,
      ...views.map(view => view.sql),
      ...viewTriggerSql,
    ];

    if (autoincrementHighWater !== undefined) {
      queries.push(
        `UPDATE sqlite_sequence SET seq = MAX(seq, ${this.escape(autoincrementHighWater)}) WHERE name = ${this.escape(table.tableName)};`,
      );
    }

    return queries;
  }

  _addColumnToTableQuery(
    tableName: TableOrModel,
    createTableSql: string,
    columnName: string,
    columnDefinition: string,
    copiedColumnNames: readonly string[],
    schemaObjectSql: readonly string[],
    views: ReadonlyArray<{ name: string; schemaName: 'main' | 'temp'; sql: string }>,
    viewTriggerSql: readonly string[],
    autoincrementHighWater?: number,
  ) {
    const table = this.extractTableDetails(tableName);
    const backupTable = this.extractTableDetails(
      `${table.tableName}_${randomBytes(8).toString('hex')}`,
      table,
    );
    const quotedTableName = this.quoteTable(table);
    const quotedBackupTableName = this.quoteTable(backupTable);
    const openingParenthesis = findSqlOpeningParenthesis(createTableSql);
    const closingParenthesis = findSqlClosingParenthesis(createTableSql, openingParenthesis);

    if (openingParenthesis === -1 || closingParenthesis === -1) {
      throw new Error(`Could not parse CREATE TABLE statement: ${createTableSql}`);
    }

    const tableSqlWithColumn = `${createTableSql.slice(0, closingParenthesis)}, ${this.quoteIdentifier(columnName)} ${columnDefinition}${createTableSql.slice(closingParenthesis)}`;
    const backupTableSql = replaceCreateTableName(tableSqlWithColumn, quotedBackupTableName);
    const copiedColumns = copiedColumnNames.map(name => this.quoteIdentifier(name)).join(', ');
    const queries = [
      backupTableSql,
      `INSERT INTO ${quotedBackupTableName} (${copiedColumns}) SELECT ${copiedColumns} FROM ${quotedTableName};`,
      ...views.map(
        view =>
          `DROP VIEW ${this.quoteIdentifier(view.schemaName)}.${this.quoteIdentifier(view.name)};`,
      ),
      `DROP TABLE ${quotedTableName};`,
      `ALTER TABLE ${quotedBackupTableName} RENAME TO ${this.quoteIdentifier(table.tableName)};`,
      ...views.map(view => view.sql),
      ...viewTriggerSql,
      ...schemaObjectSql,
    ];

    if (autoincrementHighWater !== undefined) {
      queries.push(
        `INSERT INTO sqlite_sequence (name, seq) SELECT ${this.escape(table.tableName)}, ${this.escape(autoincrementHighWater)} WHERE NOT EXISTS (SELECT 1 FROM sqlite_sequence WHERE name = ${this.escape(table.tableName)});`,
        `UPDATE sqlite_sequence SET seq = MAX(seq, ${this.escape(autoincrementHighWater)}) WHERE name = ${this.escape(table.tableName)};`,
      );
    }

    return queries;
  }

  private escapeTable(tableName: TableOrModel): string {
    const table = this.extractTableDetails(tableName);

    if (table.schema) {
      return this.escape(`${table.schema}${table.delimiter}${table.tableName}`);
    }

    return this.escape(table.tableName);
  }

  versionQuery() {
    return 'SELECT sqlite_version() as `version`';
  }

  tableExistsQuery(tableName: TableOrModel): string {
    return `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ${this.escapeTable(tableName)}`;
  }

  /**
   * Generates an SQL query to check if there are any foreign key violations in the db schema
   *
   * @param tableName
   */
  foreignKeyCheckQuery(tableName: TableOrModel) {
    return `PRAGMA foreign_key_check(${this.quoteTable(tableName)});`;
  }

  setIsolationLevelQuery(isolationLevel: IsolationLevel): string {
    switch (isolationLevel) {
      case IsolationLevel.REPEATABLE_READ:
        throw new Error(
          `The ${isolationLevel} isolation level is not supported by ${this.dialect.name}.`,
        );
      case IsolationLevel.READ_UNCOMMITTED:
        return 'PRAGMA read_uncommitted = 1';
      case IsolationLevel.READ_COMMITTED:
        throw new Error(
          `The ${isolationLevel} isolation level is not supported by ${this.dialect.name}.`,
        );
      case IsolationLevel.SERIALIZABLE:
        return 'PRAGMA read_uncommitted = 0';
      default:
        throw new Error(`Unknown isolation level: ${isolationLevel}`);
    }
  }

  startTransactionQuery(options?: StartTransactionQueryOptions): string {
    if (options) {
      rejectInvalidOptions(
        'startTransactionQuery',
        this.dialect,
        START_TRANSACTION_QUERY_SUPPORTABLE_OPTIONS,
        this.dialect.supports.startTransaction,
        options,
      );
    }

    return joinSQLFragments([
      'BEGIN',
      // Use the transaction type from the options, or the default transaction type from the dialect
      options?.transactionType ?? this.sequelize.options.transactionType,
      'TRANSACTION',
    ]);
  }

  bulkDeleteQuery(tableOrModel: TableOrModel, options: BulkDeleteQueryOptions) {
    const table = this.quoteTable(tableOrModel);
    const modelDefinition = extractModelDefinition(tableOrModel);
    const whereOptions = { ...options, model: modelDefinition };
    const whereFragment = whereOptions.where
      ? this.whereQuery(whereOptions.where, whereOptions)
      : '';

    if (whereOptions.limit) {
      return joinSQLFragments([
        `DELETE FROM ${table} WHERE rowid IN (`,
        `SELECT rowid FROM ${table}`,
        whereFragment,
        this.#internals.addLimitAndOffset(whereOptions),
        ')',
      ]);
    }

    return joinSQLFragments([`DELETE FROM ${table}`, whereFragment]);
  }

  /**
   * Temporary function until we have moved the query generation of addConstraint here.
   *
   * @param tableName
   * @param options
   */
  _TEMPORARY_getConstraintSnippet(
    tableName: TableOrModel,
    options: GetConstraintSnippetQueryOptions,
  ): string {
    return this.#internals.getConstraintSnippet(tableName, options);
  }

  getRandomFloatFunctionCall(): string {
    // sqlite's RANDOM generates a value between -9223372036854775808 and +9223372036854775807, so we need to transform it to be between 0 and 1
    return '((RANDOM() + 9223372036854775808.0) / 18446744073709551616.0)';
  }
}
