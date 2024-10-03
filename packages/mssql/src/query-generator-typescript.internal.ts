import type {
  AddTemporalTableQueryOptions,
  BulkDeleteQueryOptions,
  ChangeTemporalTableQueryOptions,
  ConstraintType,
  CreateDatabaseQueryOptions,
  Expression,
  ListDatabasesQueryOptions,
  ListSchemasQueryOptions,
  ListTablesQueryOptions,
  RemoveIndexQueryOptions,
  RemoveTemporalTableQueryOptions,
  RenameTableQueryOptions,
  ShowConstraintsQueryOptions,
  ShowTemporalPeriodsQueryOptions,
  ShowTemporalTablesQueryOptions,
  TableOrModel,
  TruncateTableQueryOptions,
} from '@sequelize/core';
import {
  AbstractQueryGenerator,
  HistoryRetentionPeriodUnit,
  TemporalPeriodType,
  TemporalTableType,
} from '@sequelize/core';
import type { EscapeOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator-typescript.js';
import {
  ADD_TEMPORAL_TABLE_QUERY_SUPPORTABLE_OPTIONS,
  CREATE_DATABASE_QUERY_SUPPORTABLE_OPTIONS,
  REMOVE_INDEX_QUERY_SUPPORTABLE_OPTIONS,
  TRUNCATE_TABLE_QUERY_SUPPORTABLE_OPTIONS,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator-typescript.js';
import { rejectInvalidOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import { joinSQLFragments } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/join-sql-fragments.js';
import { buildJsonPath } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/json.js';
import { EMPTY_SET } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/object.js';
import { generateIndexName } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/string.js';
import { randomBytes } from 'node:crypto';
import type { MsSqlDialect } from './dialect.js';
import { MsSqlQueryGeneratorInternal } from './query-generator.internal.js';

const ADD_TEMPORAL_TABLE_QUERY_SUPPORTED_OPTIONS = new Set<keyof AddTemporalTableQueryOptions>([
  'historyRetentionPeriod',
  'historyTable',
  'systemPeriodRowStart',
  'systemPeriodRowEnd',
  'temporalTableType',
]);
const CREATE_DATABASE_QUERY_SUPPORTED_OPTIONS = new Set<keyof CreateDatabaseQueryOptions>([
  'collate',
]);
const REMOVE_INDEX_QUERY_SUPPORTED_OPTIONS = new Set<keyof RemoveIndexQueryOptions>(['ifExists']);

/**
 * Temporary class to ease the TypeScript migration
 */
export class MsSqlQueryGeneratorTypeScript extends AbstractQueryGenerator {
  readonly #internals: MsSqlQueryGeneratorInternal;

  constructor(
    dialect: MsSqlDialect,
    internals: MsSqlQueryGeneratorInternal = new MsSqlQueryGeneratorInternal(dialect),
  ) {
    super(dialect, internals);

    this.#internals = internals;
  }

  createDatabaseQuery(database: string, options?: CreateDatabaseQueryOptions) {
    if (options) {
      rejectInvalidOptions(
        'createDatabaseQuery',
        this.dialect,
        CREATE_DATABASE_QUERY_SUPPORTABLE_OPTIONS,
        CREATE_DATABASE_QUERY_SUPPORTED_OPTIONS,
        options,
      );
    }

    return joinSQLFragments([
      `IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = ${this.escape(database)})`,
      `CREATE DATABASE ${this.quoteIdentifier(database)}`,
      options?.collate ? `COLLATE ${this.escape(options.collate)}` : '',
    ]);
  }

  listDatabasesQuery(options?: ListDatabasesQueryOptions) {
    let databasesToSkip = this.#internals.getTechnicalDatabaseNames();
    if (options && Array.isArray(options?.skip)) {
      databasesToSkip = [...databasesToSkip, ...options.skip];
    }

    return joinSQLFragments([
      'SELECT [name] FROM sys.databases',
      `WHERE [name] NOT IN (${databasesToSkip.map(database => this.escape(database)).join(', ')})`,
    ]);
  }

  listSchemasQuery(options?: ListSchemasQueryOptions) {
    const schemasToSkip = ['dbo', 'guest', ...this.#internals.getTechnicalSchemaNames()];

    if (options?.skip) {
      schemasToSkip.push(...options.skip);
    }

    return joinSQLFragments([
      'SELECT [name] AS [schema] FROM sys.schemas',
      `WHERE [name] NOT IN (${schemasToSkip.map(schema => this.escape(schema)).join(', ')})`,
    ]);
  }

  describeTableQuery(tableName: TableOrModel) {
    const table = this.extractTableDetails(tableName);

    return joinSQLFragments([
      'SELECT',
      `c.COLUMN_NAME AS 'Name',`,
      `c.DATA_TYPE AS 'Type',`,
      `c.CHARACTER_MAXIMUM_LENGTH AS 'Length',`,
      `c.IS_NULLABLE as 'IsNull',`,
      `COLUMN_DEFAULT AS 'Default',`,
      `pk.CONSTRAINT_TYPE AS 'Constraint',`,
      `COLUMNPROPERTY(OBJECT_ID('[' + c.TABLE_SCHEMA + '].[' + c.TABLE_NAME + ']'), c.COLUMN_NAME, 'IsIdentity') as 'IsIdentity',`,
      `CAST(prop.value AS NVARCHAR) AS 'Comment'`,
      'FROM',
      'INFORMATION_SCHEMA.TABLES t',
      'INNER JOIN',
      'INFORMATION_SCHEMA.COLUMNS c ON t.TABLE_NAME = c.TABLE_NAME AND t.TABLE_SCHEMA = c.TABLE_SCHEMA',
      'LEFT JOIN (SELECT tc.table_schema, tc.table_name,',
      'cu.column_name, tc.CONSTRAINT_TYPE',
      'FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc',
      'JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE  cu',
      'ON tc.table_schema=cu.table_schema and tc.table_name=cu.table_name',
      'and tc.constraint_name=cu.constraint_name',
      `and tc.CONSTRAINT_TYPE='PRIMARY KEY') pk`,
      'ON pk.table_schema=c.table_schema',
      'AND pk.table_name=c.table_name',
      'AND pk.column_name=c.column_name',
      'INNER JOIN sys.columns AS sc',
      `ON sc.object_id = object_id('[' + t.table_schema + '].[' + t.table_name + ']') AND sc.name = c.column_name`,
      'LEFT JOIN sys.extended_properties prop ON prop.major_id = sc.object_id',
      'AND prop.minor_id = sc.column_id',
      `AND prop.name = 'MS_Description'`,
      `WHERE t.TABLE_NAME = ${this.escape(table.tableName)}`,
      `AND t.TABLE_SCHEMA = ${this.escape(table.schema)}`,
    ]);
  }

  listTablesQuery(options?: ListTablesQueryOptions) {
    const schemaSql = options?.schema
      ? `AND s.name = ${this.escape(options.schema)}`
      : `AND s.name NOT IN (${this.#internals
          .getTechnicalSchemaNames()
          .map(schema => this.escape(schema))
          .join(', ')})`;

    return joinSQLFragments([
      `SELECT t.name AS [tableName], s.name AS [schema] FROM sys.tables t`,
      `INNER JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE t.type = 'U'`,
      schemaSql,
      `EXCEPT`,
      `SELECT OBJECT_NAME(t.history_table_id) AS [tableName], s.name AS [schema] FROM sys.tables t`,
      `INNER JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE t.type = 'U'`,
      schemaSql,
      'ORDER BY s.name, t.name',
    ]);
  }

  renameTableQuery(
    beforeTableName: TableOrModel,
    afterTableName: TableOrModel,
    options?: RenameTableQueryOptions,
  ): string {
    const beforeTable = this.extractTableDetails(beforeTableName);
    const afterTable = this.extractTableDetails(afterTableName);

    if (beforeTable.schema !== afterTable.schema) {
      if (!options?.changeSchema) {
        throw new Error(
          'To move a table between schemas, you must set `options.changeSchema` to true.',
        );
      }

      if (beforeTable.tableName !== afterTable.tableName) {
        throw new Error(
          `Renaming a table and moving it to a different schema is not supported by ${this.dialect.name}.`,
        );
      }

      return `ALTER SCHEMA ${this.quoteIdentifier(afterTable.schema)} TRANSFER ${this.quoteTable(beforeTableName)}`;
    }

    return `EXEC sp_rename '${this.quoteTable(beforeTableName)}', ${this.escape(afterTable.tableName)}`;
  }

  truncateTableQuery(tableName: TableOrModel, options?: TruncateTableQueryOptions) {
    if (options) {
      rejectInvalidOptions(
        'truncateTableQuery',
        this.dialect,
        TRUNCATE_TABLE_QUERY_SUPPORTABLE_OPTIONS,
        EMPTY_SET,
        options,
      );
    }

    return `TRUNCATE TABLE ${this.quoteTable(tableName)}`;
  }

  addTemporalTableQuery(tableOrModel: TableOrModel, options: AddTemporalTableQueryOptions) {
    if (options) {
      rejectInvalidOptions(
        'addTemporalTableQuery',
        this.dialect,
        ADD_TEMPORAL_TABLE_QUERY_SUPPORTABLE_OPTIONS,
        ADD_TEMPORAL_TABLE_QUERY_SUPPORTED_OPTIONS,
        options,
      );
    }

    if (options.temporalTableType !== TemporalTableType.SYSTEM_PERIOD) {
      throw new Error(
        `${options.temporalTableType} tables are not supported in ${this.dialect.name}.`,
      );
    }

    const table = this.extractTableDetails(tableOrModel);
    const quoteTbl = this.quoteTable(tableOrModel);
    const rowEnd = options?.systemPeriodRowEnd || 'SysEndTime';
    const rowStart = options?.systemPeriodRowStart || 'SysStartTime';
    const quoteRowEnd = this.quoteIdentifier(rowEnd);
    const quoteRowStart = this.quoteIdentifier(rowStart);
    const queries: string[] = [
      joinSQLFragments([
        `ALTER TABLE ${quoteTbl} ADD`,
        `${quoteRowStart} DATETIME2 GENERATED ALWAYS AS ROW START HIDDEN NOT NULL CONSTRAINT [DF__${table.tableName.slice(0, 9)}__${rowStart.slice(0, 13)}] DEFAULT SYSUTCDATETIME(),`,
        `${quoteRowEnd} DATETIME2 GENERATED ALWAYS AS ROW END HIDDEN NOT NULL CONSTRAINT [DF__${table.tableName.slice(0, 9)}__${rowEnd.slice(0, 13)}] DEFAULT CONVERT(DATETIME2, '9999-12-31 23:59:59.99999999'),`,
        `PERIOD FOR SYSTEM_TIME (${quoteRowStart}, ${quoteRowEnd})`,
      ]),
    ];

    const historyTableSql = [];
    if (options.historyTable) {
      const historyTable = this.extractTableDetails(options.historyTable);
      const quoteHistoryTable = this.quoteIdentifier(historyTable.tableName);
      const quoteHistorySchema = this.quoteIdentifier(historyTable.schema);
      historyTableSql.push(`HISTORY_TABLE = ${quoteHistorySchema}.${quoteHistoryTable}`);
    }

    if (
      options.historyRetentionPeriod?.unit &&
      options.historyRetentionPeriod.unit !== HistoryRetentionPeriodUnit.INFINITE
    ) {
      if (!Number.isInteger(options?.historyRetentionPeriod?.length)) {
        throw new TypeError('Invalid history retention period length.');
      }

      historyTableSql.push(
        `HISTORY_RETENTION_PERIOD = ${options?.historyRetentionPeriod?.length} ${options?.historyRetentionPeriod?.unit}`,
      );
    }

    queries.push(
      joinSQLFragments([
        `ALTER TABLE ${quoteTbl} SET (SYSTEM_VERSIONING = ON`,
        historyTableSql.length > 0 ? `(${historyTableSql.join(', ')})` : '',
        `)`,
      ]),
    );

    return queries;
  }

  changeTemporalTableQuery(tableOrModel: TableOrModel, options: ChangeTemporalTableQueryOptions) {
    const quoteTbl = this.quoteTable(tableOrModel);

    if (options.temporalTableType === TemporalTableType.NON_TEMPORAL) {
      return `ALTER TABLE ${quoteTbl} SET (SYSTEM_VERSIONING = OFF)`;
    }

    if (options.temporalTableType !== TemporalTableType.SYSTEM_PERIOD) {
      throw new Error(
        `${options.temporalTableType} tables are not supported in ${this.dialect.name}.`,
      );
    }

    // If a history table name is not provided, a new history table will be created.
    if (!options.historyTable) {
      throw new Error('A history table name must be provided to change a temporal table.');
    }

    const historyTable = this.extractTableDetails(options.historyTable);
    const quoteHistoryTable = this.quoteIdentifier(historyTable.tableName);
    const quoteHistorySchema = this.quoteIdentifier(historyTable.schema);
    const historyTableSql = [`HISTORY_TABLE = ${quoteHistorySchema}.${quoteHistoryTable}`];

    if (options.historyRetentionPeriod?.unit) {
      if (options.historyRetentionPeriod.unit === HistoryRetentionPeriodUnit.INFINITE) {
        historyTableSql.push(`HISTORY_RETENTION_PERIOD = ${options.historyRetentionPeriod.unit}`);
      } else if (!Number.isInteger(options?.historyRetentionPeriod?.length)) {
        throw new TypeError('Invalid history retention period length.');
      } else {
        historyTableSql.push(
          `HISTORY_RETENTION_PERIOD = ${options?.historyRetentionPeriod?.length} ${options?.historyRetentionPeriod?.unit}`,
        );
      }
    }

    return joinSQLFragments([
      `ALTER TABLE ${quoteTbl} SET (SYSTEM_VERSIONING = ON`,
      historyTableSql.length > 0 ? `(${historyTableSql.join(', ')})` : '',
      `)`,
    ]);
  }

  removeTemporalTableQuery(tableOrModel: TableOrModel, options: RemoveTemporalTableQueryOptions) {
    if (!options.temporalPeriods) {
      throw new Error('Temporal periods must be provided to remove a temporal table.');
    }

    const quoteTbl = this.quoteTable(tableOrModel);
    const queries: string[] = [`ALTER TABLE ${quoteTbl} SET (SYSTEM_VERSIONING = OFF)`];

    const table = this.extractTableDetails(tableOrModel);
    for (const period of options.temporalPeriods) {
      if (period.type === TemporalPeriodType.SYSTEM) {
        queries.push(
          `ALTER TABLE ${quoteTbl} DROP PERIOD FOR SYSTEM_TIME`,
          joinSQLFragments([
            `ALTER TABLE ${quoteTbl} DROP`,
            `CONSTRAINT IF EXISTS [DF__${table.tableName.slice(0, 9)}__${period.rowStart.slice(0, 13)}],`,
            `CONSTRAINT IF EXISTS [DF__${table.tableName.slice(0, 9)}__${period.rowEnd.slice(0, 13)}],`,
            `COLUMN ${this.quoteIdentifier(period.rowStart)},`,
            `COLUMN ${this.quoteIdentifier(period.rowEnd)}`,
          ]),
        );
      } else {
        throw new Error(`Unsupported temporal period type: ${period.type}.`);
      }
    }

    return queries;
  }

  showTemporalPeriodsQuery(options?: ShowTemporalPeriodsQueryOptions) {
    return joinSQLFragments([
      'SELECT p.name, p.period_type_desc AS [type], rowStart.name AS [rowStart], rowEnd.name AS [rowEnd] FROM sys.periods p',
      'INNER JOIN sys.columns rowStart ON p.object_id = rowStart.object_id AND p.start_column_id = rowStart.column_id',
      'INNER JOIN sys.columns rowEnd ON p.object_id = rowEnd.object_id AND p.end_column_id = rowEnd.column_id',
      options?.tableOrModel
        ? `WHERE p.object_id = OBJECT_ID('${this.quoteTable(options.tableOrModel)}', 'U')`
        : '',
    ]);
  }

  showTemporalTablesQuery(options?: ShowTemporalTablesQueryOptions) {
    const table = options?.tableOrModel
      ? this.extractTableDetails(options.tableOrModel)
      : undefined;

    return joinSQLFragments([
      'SELECT t.[name] AS [tableName],',
      's.[name] AS [schema],',
      't.[temporal_type_desc] AS [type],',
      'h.[name] AS [historyTableName],',
      'OBJECT_SCHEMA_NAME(h.object_id) AS [historySchema],',
      't.[history_retention_period] AS [historyRetentionPeriodLength],',
      't.[history_retention_period_unit_desc] AS [historyRetentionPeriodUnit]',
      'FROM sys.tables t',
      'INNER JOIN sys.schemas s ON t.schema_id = s.schema_id',
      'LEFT JOIN sys.tables h ON t.history_table_id = h.object_id',
      `WHERE t.temporal_type_desc = 'SYSTEM_VERSIONED_TEMPORAL_TABLE'`,
      table ? `AND t.[name] = ${this.escape(table.tableName)}` : '',
      table ? `AND s.[name] = ${this.escape(table.schema)}` : '',
    ]);
  }

  #getConstraintType(type: ConstraintType): string {
    switch (type) {
      case 'CHECK':
        return 'CHECK_CONSTRAINT';
      case 'DEFAULT':
        return 'DEFAULT_CONSTRAINT';
      case 'FOREIGN KEY':
        return 'FOREIGN_KEY_CONSTRAINT';
      case 'PRIMARY KEY':
        return 'PRIMARY_KEY_CONSTRAINT';
      case 'UNIQUE':
        return 'UNIQUE_CONSTRAINT';
      default:
        throw new Error(`Constraint type ${type} is not supported`);
    }
  }

  showConstraintsQuery(tableName: TableOrModel, options?: ShowConstraintsQueryOptions) {
    const table = this.extractTableDetails(tableName);

    return joinSQLFragments([
      `SELECT DB_NAME() AS constraintCatalog`,
      `, s.[name] AS constraintSchema`,
      `, c.constraintName`,
      `, REPLACE(LEFT(c.constraintType, CHARINDEX('_CONSTRAINT', c.constraintType) - 1), '_', ' ') AS constraintType`,
      `, DB_NAME() AS tableCatalog`,
      `, s.[name] AS tableSchema`,
      `, t.[name] AS tableName`,
      `, c.columnNames`,
      `, c.referencedTableSchema`,
      `, c.referencedTableName`,
      `, c.referencedColumnNames`,
      `, c.deleteAction`,
      `, c.updateAction`,
      `, c.definition`,
      `FROM sys.tables t`,
      `INNER JOIN sys.schemas s ON t.schema_id = s.schema_id`,
      `INNER JOIN (`,
      `SELECT kc.[name] AS constraintName, kc.[type_desc] AS constraintType, kc.[parent_object_id] AS constraintTableId, c.[name] AS columnNames, null as referencedTableSchema`,
      `, null AS referencedTableName, null AS referencedColumnNames, null AS deleteAction, null AS updateAction, null AS [definition], null AS column_id FROM sys.key_constraints kc`,
      `LEFT JOIN sys.indexes i ON kc.name = i.name LEFT JOIN sys.index_columns ic ON ic.index_id = i.index_id AND ic.object_id = kc.parent_object_id LEFT JOIN sys.columns c ON c.column_id = ic.column_id AND c.object_id = kc.parent_object_id`,
      `UNION ALL SELECT [name] AS constraintName, [type_desc] AS constraintType, [parent_object_id] AS constraintTableId, null AS columnNames, null as referencedTableSchema, null AS referencedTableName`,
      `, null AS referencedColumnNames, null AS deleteAction, null AS updateAction, [definition], null AS column_id FROM sys.check_constraints c UNION ALL`,
      `SELECT dc.[name] AS constraintName, dc.[type_desc] AS constraintType, dc.[parent_object_id] AS constraintTableId, c.[name] AS columnNames, null as referencedTableSchema`,
      `, null AS referencedTableName, null AS referencedColumnNames, null AS deleteAction, null AS updateAction, [definition], null AS column_id FROM sys.default_constraints dc`,
      `INNER JOIN sys.columns c ON dc.parent_column_id = c.column_id AND dc.parent_object_id = c.object_id UNION ALL`,
      `SELECT k.[name] AS constraintName, k.[type_desc] AS constraintType, k.[parent_object_id] AS constraintTableId, fcol.[name] AS columnNames, OBJECT_SCHEMA_NAME(k.[referenced_object_id]) as referencedTableSchema`,
      `, OBJECT_NAME(k.[referenced_object_id]) AS referencedTableName, rcol.[name] AS referencedColumnNames, k.[delete_referential_action_desc] AS deleteAction, k.[update_referential_action_desc] AS updateAction`,
      `, null AS [definition], rcol.column_id FROM sys.foreign_keys k INNER JOIN sys.foreign_key_columns c ON k.[object_id] = c.constraint_object_id`,
      `INNER JOIN sys.columns fcol ON c.parent_column_id = fcol.column_id AND c.parent_object_id = fcol.object_id INNER JOIN sys.columns rcol ON c.referenced_column_id = rcol.column_id AND c.referenced_object_id = rcol.object_id`,
      `) c ON t.object_id = c.constraintTableId`,
      `WHERE s.name = ${this.escape(table.schema)} AND t.name = ${this.escape(table.tableName)}`,
      options?.columnName ? `AND c.columnNames = ${this.escape(options.columnName)}` : '',
      options?.constraintName
        ? `AND c.constraintName = ${this.escape(options.constraintName)}`
        : '',
      options?.constraintType
        ? `AND c.constraintType = ${this.escape(this.#getConstraintType(options.constraintType))}`
        : '',
      `ORDER BY c.constraintName, c.column_id`,
    ]);
  }

  showIndexesQuery(tableName: TableOrModel) {
    const table = this.extractTableDetails(tableName);
    const objectId = table?.schema ? `${table.schema}.${table.tableName}` : `${table.tableName}`;

    return joinSQLFragments([
      'SELECT',
      'I.[name] AS [index_name],',
      'I.[type_desc] AS [index_type],',
      'C.[name] AS [column_name],',
      'IC.[is_descending_key],',
      'IC.[is_included_column],',
      'I.[is_unique],',
      'I.[is_primary_key],',
      'I.[is_unique_constraint]',
      'FROM sys.indexes I',
      'INNER JOIN sys.index_columns IC ON IC.index_id = I.index_id AND IC.object_id = I.object_id',
      'INNER JOIN sys.columns C ON IC.object_id = C.object_id AND IC.column_id = C.column_id',
      `WHERE I.[object_id] = OBJECT_ID(${this.escape(objectId)}) ORDER BY I.[name];`,
    ]);
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
      'ON',
      this.quoteTable(tableName),
    ]);
  }

  createSavepointQuery(savepointName: string): string {
    return `SAVE TRANSACTION ${this.quoteIdentifier(savepointName)}`;
  }

  rollbackSavepointQuery(savepointName: string): string {
    return `ROLLBACK TRANSACTION ${this.quoteIdentifier(savepointName)}`;
  }

  generateTransactionId(): string {
    return randomBytes(10).toString('hex');
  }

  jsonPathExtractionQuery(
    sqlExpression: string,
    path: ReadonlyArray<number | string>,
    unquote: boolean,
  ): string {
    if (!unquote) {
      throw new Error(
        `JSON Paths are not supported in ${this.dialect.name} without unquoting the JSON value.`,
      );
    }

    return `JSON_VALUE(${sqlExpression}, ${this.escape(buildJsonPath(path))})`;
  }

  formatUnquoteJson(arg: Expression, options?: EscapeOptions) {
    return `JSON_VALUE(${this.escape(arg, options)})`;
  }

  versionQuery() {
    // Uses string manipulation to convert the MS Maj.Min.Patch.Build to semver Maj.Min.Patch
    return `DECLARE @ms_ver NVARCHAR(20);
SET @ms_ver = REVERSE(CONVERT(NVARCHAR(20), SERVERPROPERTY('ProductVersion')));
SELECT REVERSE(SUBSTRING(@ms_ver, CHARINDEX('.', @ms_ver)+1, 20)) AS 'version'`;
  }

  getUuidV4FunctionCall(): string {
    return 'NEWID()';
  }

  bulkDeleteQuery(tableOrModel: TableOrModel, options: BulkDeleteQueryOptions) {
    const sql = super.bulkDeleteQuery(tableOrModel, options);

    return `${sql}; SELECT @@ROWCOUNT AS AFFECTEDROWS;`;
  }
}
