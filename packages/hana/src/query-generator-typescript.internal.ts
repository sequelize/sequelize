import type {
  CreateSchemaQueryOptions,
  DropSchemaQueryOptions,
  DropTableQueryOptions,
  Expression,
  IsolationLevel,
  RenameTableQueryOptions,
  StartTransactionQueryOptions,
  TableOrModel,
} from '@sequelize/core';
import type {
  ListSchemasQueryOptions,
  ListTablesQueryOptions,
  RemoveConstraintQueryOptions,
  RemoveIndexQueryOptions,
  ShowConstraintsQueryOptions,
} from '@sequelize/core';
import type { AddLimitOffsetOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator.internal-types.js';
import type {
  EscapeOptions,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator-typescript.js';
import { AbstractQueryGenerator, Literal, Op } from '@sequelize/core';
import { rejectInvalidOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import { joinSQLFragments } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/join-sql-fragments.js';
import { EMPTY_SET } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/object.js';
import { buildJsonPath } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/json.js';
import { generateIndexName } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/string.js';
import {
  CREATE_SCHEMA_QUERY_SUPPORTABLE_OPTIONS,
  DROP_SCHEMA_QUERY_SUPPORTABLE_OPTIONS,
  REMOVE_INDEX_QUERY_SUPPORTABLE_OPTIONS,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator-typescript.js';
import type { HanaDialect } from './dialect.js';
import { HanaQueryGeneratorInternal } from './query-generator.internal.js';
import { DROP_TABLE_QUERY_SUPPORTABLE_OPTIONS } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator-typescript.js';

const DROP_SCHEMA_QUERY_SUPPORTED_OPTIONS = new Set<keyof DropSchemaQueryOptions>([
  'cascade',
]);

const REMOVE_INDEX_QUERY_SUPPORTED_OPTIONS = new Set<keyof RemoveIndexQueryOptions>(['ifExists']);

/**
 * Temporary class to ease the TypeScript migration
 */
export class HanaQueryGeneratorTypeScript extends AbstractQueryGenerator {
  readonly #internals: HanaQueryGeneratorInternal;

  constructor(
    dialect: HanaDialect,
    internals: HanaQueryGeneratorInternal = new HanaQueryGeneratorInternal(dialect),
  ) {
    super(dialect, internals);

    this.#internals = internals;
  }

  createSchemaQuery(schemaName: string, options?: CreateSchemaQueryOptions): string {
    if (!this.dialect.supports.schemas) {
      throw new Error(`Schemas are not supported in ${this.dialect.name}.`);
    }

    if (options) {
      rejectInvalidOptions(
        'createSchemaQuery',
        this.dialect,
        CREATE_SCHEMA_QUERY_SUPPORTABLE_OPTIONS,
        this.dialect.supports.createSchema,
        options,
      );
    }

    return joinSQLFragments([
      'CREATE',
      'SCHEMA',
      this.quoteIdentifier(schemaName),
      options?.authorization
        ? `OWNED BY ${options.authorization instanceof Literal ? this.#internals.formatLiteral(options.authorization) : this.quoteIdentifier(options.authorization)}`
        : '',
    ]);
  }

  listSchemasQuery(options?: ListSchemasQueryOptions) {
    let schemasToSkip = this.#internals.getTechnicalSchemaNames();

    if (options && Array.isArray(options?.skip)) {
      schemasToSkip = [...schemasToSkip, ...options.skip];
    }

    return joinSQLFragments([
      'SELECT SCHEMA_NAME AS "schema"',
      'FROM SYS.SCHEMAS',
      `WHERE SCHEMA_NAME != 'SYS' AND SCHEMA_NAME != 'PUBLIC' AND SCHEMA_NAME NOT LIKE '_SYS%'`,
      `AND SCHEMA_NAME NOT IN (${schemasToSkip.map(schema => this.escape(schema)).join(', ')})`,
    ]);
  }

  describeTableQuery(tableName: TableOrModel) {
    const table = this.extractTableDetails(tableName);

    return joinSQLFragments([
      'SELECT',
      'SYS.TABLE_COLUMNS.COLUMN_NAME AS "ColumnName",',
      'SYS.TABLE_COLUMNS.TABLE_NAME AS "TableName",',
      'SYS.TABLE_COLUMNS.SCHEMA_NAME AS "SchemaName",',
      'SYS.TABLE_COLUMNS.DATA_TYPE_NAME AS "DataTypeName",',
      'SYS.TABLE_COLUMNS.LENGTH AS "Length",',
      'SYS.TABLE_COLUMNS.SCALE AS "Scale",',
      'SYS.TABLE_COLUMNS.IS_NULLABLE AS "IsNullable",',
      'SYS.TABLE_COLUMNS.DEFAULT_VALUE AS "DefaultValue",',
      'SYS.TABLE_COLUMNS.GENERATION_TYPE AS "GenerationType",',
      'pk.IS_PRIMARY_KEY AS "IsPrimaryKey",',
      'SYS.TABLE_COLUMNS.COMMENTS AS "Comments"',
      'FROM SYS.TABLE_COLUMNS',
      'LEFT JOIN',
      '(SELECT SCHEMA_NAME, TABLE_NAME, COLUMN_NAME, IS_PRIMARY_KEY',
      `FROM SYS.CONSTRAINTS WHERE IS_PRIMARY_KEY = 'TRUE') pk`,
      'ON SYS.TABLE_COLUMNS.SCHEMA_NAME = pk.SCHEMA_NAME',
      'AND SYS.TABLE_COLUMNS.TABLE_NAME = pk.TABLE_NAME',
      'AND SYS.TABLE_COLUMNS.COLUMN_NAME = pk.COLUMN_NAME',
      `WHERE SYS.TABLE_COLUMNS.TABLE_NAME = ${this.escape(table.tableName)}`,
      `AND SYS.TABLE_COLUMNS.SCHEMA_NAME = ${table.schema ? this.escape(table.schema) : 'CURRENT_SCHEMA'}`,
    ]);
  }

  listTablesQuery(options?: ListTablesQueryOptions) {
    //"SELECT * FROM SYS.TABLES WHERE SCHEMA_NAME != 'SYS' and SCHEMA_NAME NOT LIKE '_SYS%'"
    return joinSQLFragments([
      'SELECT TABLE_NAME AS "tableName",',
      'SCHEMA_NAME AS "schema"',
      'FROM SYS.TABLES',
      `WHERE SCHEMA_NAME != 'SYS' AND SCHEMA_NAME NOT LIKE '_SYS%'`,
      options?.schema
        ? `AND SCHEMA_NAME = ${this.escape(options.schema)}`
        : `AND SCHEMA_NAME NOT IN (${this.#internals.getTechnicalSchemaNames().map(schema => this.escape(schema)).join(', ')})`,
      'ORDER BY SCHEMA_NAME, TABLE_NAME',
    ]);
  }

  renameTableQuery(
    beforeTableName: TableOrModel,
    afterTableName: TableOrModel,
    options?: RenameTableQueryOptions,
  ): string {
    const beforeTable = this.extractTableDetails(beforeTableName);
    const afterTable = this.extractTableDetails(afterTableName);

    if (beforeTable.schema !== afterTable.schema && !options?.changeSchema) {
      throw new Error(
        'To move a table between schemas, you must set `options.changeSchema` to true.',
      );
    }

    return joinSQLFragments([
      'RENAME TABLE',
      this.quoteTable(beforeTableName),
      'TO',
      afterTable.schema && afterTable.schema === this.dialect.getDefaultSchema()
        ? `${this.quoteIdentifier(afterTable.schema)}.${this.quoteIdentifier(afterTable.tableName)}`
        : this.quoteTable(afterTableName),
    ]);
  }

  dropTableQuery(tableName: TableOrModel, options?: DropTableQueryOptions): string {
    const DROP_TABLE_QUERY_SUPPORTED_OPTIONS = new Set<keyof DropTableQueryOptions>();

    if (this.dialect.supports.dropTable.cascade) {
      DROP_TABLE_QUERY_SUPPORTED_OPTIONS.add('cascade');
    }

    if (options) {
      rejectInvalidOptions(
        'dropTableQuery',
        this.dialect,
        DROP_TABLE_QUERY_SUPPORTABLE_OPTIONS,
        DROP_TABLE_QUERY_SUPPORTED_OPTIONS,
        options,
      );
    }

    const dropSql = joinSQLFragments([
      'DROP TABLE',
      this.quoteTable(tableName),
      options?.cascade ? 'CASCADE' : '',
    ]);

    const table = this.extractTableDetails(tableName);

    return joinSQLFragments([
      'DO BEGIN',
      '  IF EXISTS (',
      '    SELECT * FROM SYS.TABLES',
      `    WHERE TABLE_NAME = ${this.escape(table.tableName)}`,
      `      AND SCHEMA_NAME = ${table.schema ? this.escape(table.schema) : 'CURRENT_SCHEMA'}`,
      '  ) THEN',
      `    ${dropSql};`,
      '  END IF;',
      'END;',
    ]);
  }

  removeConstraintQuery(
    tableName: TableOrModel,
    constraintName: string,
    options?: RemoveConstraintQueryOptions,
  ) {
    const ifExists = options?.ifExists;
    let optionsWithoutIfExists = null;
    if (ifExists) {
      optionsWithoutIfExists = Object.assign({}, options);
      delete optionsWithoutIfExists.ifExists;
    } else {
      optionsWithoutIfExists = options;
    }

    const removeSql = super.removeConstraintQuery(tableName, constraintName, optionsWithoutIfExists);

    if (ifExists) {
      const table = this.extractTableDetails(tableName);
      return joinSQLFragments([
        'DO BEGIN',
        '  IF EXISTS (',
        '    SELECT * FROM SYS.CONSTRAINTS',
        `    WHERE CONSTRAINT_NAME = ${this.escape(constraintName)}`,
        `      AND TABLE_NAME = ${this.escape(table.tableName)}`,
        `      AND SCHEMA_NAME = ${table.schema ? this.escape(table.schema) : 'CURRENT_SCHEMA'}`,
        '    UNION ALL',
        '    SELECT * FROM SYS.REFERENTIAL_CONSTRAINTS',
        `    WHERE CONSTRAINT_NAME = ${this.escape(constraintName)}`,
        `      AND TABLE_NAME = ${this.escape(table.tableName)}`,
        `      AND SCHEMA_NAME = ${table.schema ? this.escape(table.schema) : 'CURRENT_SCHEMA'}`,
        '  ) THEN',
        `    ${removeSql};`,
        '  END IF;',
        'END;',
      ]);
    }

    return removeSql;
  }

  showConstraintsQuery(tableName: TableOrModel, options?: ShowConstraintsQueryOptions) {
    const table = this.extractTableDetails(tableName);

    if (options?.constraintType === 'FOREIGN KEY') {
      return this._showReferentialConstraintsQuery(tableName, options);
    } else if (options?.constraintType) {
      return this._showNonReferentialConstraintsQuery(tableName, options);
    }

    return joinSQLFragments([
      '(',
      this._showNonReferentialConstraintsQuery(tableName, options),
      ')',
      'UNION ALL',
      '(',
      this._showReferentialConstraintsQuery(tableName, options),
      ')',
    ]);
  }

  _showNonReferentialConstraintsQuery(tableName: TableOrModel, options?: ShowConstraintsQueryOptions) {
    const table = this.extractTableDetails(tableName);

    return joinSQLFragments([
      'SELECT SCHEMA_NAME AS "constraintSchema",',
      'CONSTRAINT_NAME AS "constraintName",',
      options?.constraintType
        ? `'${options.constraintType}' AS "constraintType",`
        : joinSQLFragments([
            'CASE',
            `WHEN IS_PRIMARY_KEY = 'TRUE' THEN 'PRIMARY KEY'`,
            `WHEN IS_UNIQUE_KEY = 'TRUE' THEN 'UNIQUE'`,
            `WHEN CHECK_CONDITION IS NOT NULL THEN 'CHECK'`,
            'END AS "constraintType",',
          ]),
      'SCHEMA_NAME AS "tableSchema",',
      'TABLE_NAME AS "tableName",',
      'COLUMN_NAME AS "columnNames",',
      'CHECK_CONDITION AS "definition",',
      `NULL AS "referencedTableSchema",`,
      `NULL AS "referencedTableName",`,
      `NULL AS "referencedColumnNames",`,
      `NULL AS "deleteAction",`,
      `NULL AS "updateAction"`,
      'FROM SYS.CONSTRAINTS',
      `WHERE`,
      `TABLE_NAME = ${this.escape(table.tableName)}`,
      `AND SCHEMA_NAME = ${table.schema ? this.escape(table.schema) : 'CURRENT_SCHEMA'}`,
      options?.constraintType === 'PRIMARY KEY'
        ? `AND IS_PRIMARY_KEY = 'TRUE'`
        : options?.constraintType === 'UNIQUE'
          ? `AND IS_UNIQUE_KEY = 'TRUE'`
          : options?.constraintType === 'CHECK'
            ? `AND IS_PRIMARY_KEY = 'FALSE' AND IS_UNIQUE_KEY = 'FALSE' AND CHECK_CONDITION IS NOT NULL`
            : '',
      options?.columnName ? `AND COLUMN_NAME = ${this.escape(options.columnName)}` : '',
      options?.constraintName ? `AND CONSTRAINT_NAME = ${this.escape(options.constraintName)}` : '',
      'ORDER BY CONSTRAINT_NAME, POSITION',
    ]);
  }

  _showReferentialConstraintsQuery(tableName: TableOrModel, options?: ShowConstraintsQueryOptions) {
    const table = this.extractTableDetails(tableName);

    return joinSQLFragments([
      'SELECT SCHEMA_NAME AS "constraintSchema",',
      'CONSTRAINT_NAME AS "constraintName",',
      `'FOREIGN KEY' AS "constraintType",`,
      'SCHEMA_NAME AS "tableSchema",',
      'TABLE_NAME AS "tableName",',
      'COLUMN_NAME AS "columnNames",',
      'NULL AS "definition",',
      'REFERENCED_SCHEMA_NAME AS "referencedTableSchema",',
      'REFERENCED_TABLE_NAME AS "referencedTableName",',
      'REFERENCED_COLUMN_NAME AS "referencedColumnNames",',
      'DELETE_RULE AS "deleteAction",',
      'UPDATE_RULE AS "updateAction"',
      'FROM SYS.REFERENTIAL_CONSTRAINTS',
      `WHERE TABLE_NAME = ${this.escape(table.tableName)}`,
      `AND SCHEMA_NAME = ${table.schema ? this.escape(table.schema) : 'CURRENT_SCHEMA'}`,
      options?.columnName ? `AND COLUMN_NAME = ${this.escape(options.columnName)}` : '',
      options?.constraintName ? `AND CONSTRAINT_NAME = ${this.escape(options.constraintName)}` : '',
      'ORDER BY CONSTRAINT_NAME, POSITION',
    ]);
  }

  showIndexesQuery(tableName: TableOrModel) {
    const table = this.extractTableDetails(tableName);

    return joinSQLFragments([
      'SELECT',
      'SYS.INDEXES.SCHEMA_NAME AS "schemaName",',
      'SYS.INDEXES.TABLE_NAME AS "tableName",',
      'SYS.INDEXES.INDEX_NAME AS "name",',
      'SYS.INDEXES.INDEX_TYPE AS "type",',
      'SYS.INDEXES.CONSTRAINT AS "constraint",',
      'SYS.INDEX_COLUMNS.COLUMN_NAME AS "columnName",',
      'SYS.INDEX_COLUMNS.POSITION AS "position",',
      'SYS.INDEX_COLUMNS.ASCENDING_ORDER AS "ascendingOrder"',

      'FROM SYS.INDEXES',
      'INNER JOIN SYS.INDEX_COLUMNS',
      'ON SYS.INDEXES.SCHEMA_NAME = SYS.INDEX_COLUMNS.SCHEMA_NAME',
      'AND SYS.INDEXES.TABLE_NAME = SYS.INDEX_COLUMNS.TABLE_NAME',
      'AND SYS.INDEXES.INDEX_NAME = SYS.INDEX_COLUMNS.INDEX_NAME',
      `WHERE SYS.INDEXES.SCHEMA_NAME = ${table.schema ? this.escape(table.schema) : 'CURRENT_SCHEMA'}`,
      `AND SYS.INDEXES.TABLE_NAME = ${this.escape(table.tableName)}`,
    ]);

    // `SELECT * FROM SYS.INDEXES WHERE SCHEMA_NAME ='${}' and TABLE_NAME = '' ${this.quoteTable(tableName)}`;
  }

  getToggleForeignKeyChecksQuery(enable: boolean): string {
    return `SET FOREIGN_KEY_CHECKS=${enable ? '1' : '0'}`;
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

    const dropSql = `DROP INDEX ${this.quoteIdentifier(indexName)}`;

    if (options?.ifExists) {
      const table = this.extractTableDetails(tableName);
      return joinSQLFragments([
        'DO BEGIN',
        '  IF EXISTS (',
        '    SELECT * FROM SYS.INDEXES',
        `    WHERE INDEX_NAME = ${this.escape(indexName)}`,
        `      AND TABLE_NAME = ${this.escape(table.tableName)}`,
        `      AND SCHEMA_NAME = ${table.schema ? this.escape(table.schema) : 'CURRENT_SCHEMA'}`,
        '  ) THEN',
        `    ${dropSql};`,
        '  END IF;',
        'END;',
      ]);
    }

    return dropSql;
  }

  jsonPathExtractionQuery(sqlExpression: string, path: ReadonlyArray<number | string>, unquote: boolean): string {
    const extractQuery = `json_extract(${sqlExpression},${this.escape(buildJsonPath(path))})`;
    if (unquote) {
      return `json_unquote(${extractQuery})`;
    }

    return extractQuery;
  }

  formatUnquoteJson(arg: Expression, options?: EscapeOptions) {
    return `json_unquote(${this.escape(arg, options)})`;
  }

  versionQuery() {
    return `SELECT "VALUE" AS "version" FROM SYS.M_SYSTEM_OVERVIEW `
      + `WHERE "SECTION" = 'System' and "NAME" = 'Version';`;
  }

  tableExistsQuery(tableName: TableOrModel): string {
    const table = this.extractTableDetails(tableName);

    return `SELECT TABLE_NAME FROM "SYS"."TABLES" WHERE SCHEMA_NAME = ${table.schema ? this.escape(table.schema) : 'CURRENT_SCHEMA'} AND TABLE_NAME = ${this.escape(table.tableName)}`;
  }

  setIsolationLevelQuery(isolationLevel: IsolationLevel): string {
    if (!this.dialect.supports.isolationLevels) {
      throw new Error(`Isolation levels are not supported by ${this.dialect.name}.`);
    }

    // hana dialect.supports.connectionTransactionMethods is true,
    // but hana uses SQL statement to set isolation level.
    return `SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`;
  }
}
