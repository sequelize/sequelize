import type {
  AddIndexQueryOptions,
  ListSchemasQueryOptions,
  ListTablesQueryOptions,
  RenameTableQueryOptions,
  ShowConstraintsQueryOptions,
  TableOrModel,
  TruncateTableQueryOptions,
} from '@sequelize/core';
import { AbstractQueryGenerator } from '@sequelize/core';
// import { AbstractQueryGenerator, BaseSqlExpression } from '@sequelize/core';
import {
  ADD_INDEX_QUERY_SUPPORTABLE_OPTIONS,
  RENAME_TABLE_QUERY_SUPPORTABLE_OPTIONS,
  TRUNCATE_TABLE_QUERY_SUPPORTABLE_OPTIONS,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator-typescript.js';
import { BaseSqlExpression } from '@sequelize/core/_non-semver-use-at-your-own-risk_/expression-builders/base-sql-expression.js';
import { rejectInvalidOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import { joinSQLFragments } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/join-sql-fragments.js';
import { EMPTY_SET } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/object.js';
import { generateIndexName } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/string.js';
import { inspect } from '@sequelize/utils';
import type { IBMiDialect } from './dialect.js';
import { IBMiQueryGeneratorInternal } from './query-generator.internal.js';

/**
 * Temporary class to ease the TypeScript migration
 */
export class IBMiQueryGeneratorTypeScript extends AbstractQueryGenerator {
  readonly #internals: IBMiQueryGeneratorInternal;

  constructor(
    dialect: IBMiDialect,
    internals: IBMiQueryGeneratorInternal = new IBMiQueryGeneratorInternal(dialect),
  ) {
    super(dialect, internals);

    this.#internals = internals;
  }

  listSchemasQuery(options?: ListSchemasQueryOptions) {
    return joinSQLFragments([
      `SELECT DISTINCT SCHEMA_NAME AS "schema" FROM QSYS2.SYSSCHEMAAUTH WHERE GRANTEE = CURRENT USER`,
      `AND SCHEMA_NAME NOT LIKE 'Q%' AND SCHEMA_NAME NOT LIKE 'SYS%'`,
      options?.skip && Array.isArray(options.skip) && options.skip.length > 0
        ? `AND SCHEMA_NAME NOT IN (${options?.skip.map(schema => this.escape(schema)).join(', ')})`
        : '',
    ]);
  }

  describeTableQuery(tableName: TableOrModel) {
    const table = this.extractTableDetails(tableName);

    return joinSQLFragments([
      'SELECT',
      'QSYS2.SYSCOLUMNS.*,',
      'QSYS2.SYSCST.CONSTRAINT_NAME,',
      'QSYS2.SYSCST.CONSTRAINT_TYPE',
      'FROM QSYS2.SYSCOLUMNS',
      'LEFT OUTER JOIN QSYS2.SYSCSTCOL',
      'ON QSYS2.SYSCOLUMNS.TABLE_SCHEMA = QSYS2.SYSCSTCOL.TABLE_SCHEMA',
      'AND QSYS2.SYSCOLUMNS.TABLE_NAME = QSYS2.SYSCSTCOL.TABLE_NAME',
      'AND QSYS2.SYSCOLUMNS.COLUMN_NAME = QSYS2.SYSCSTCOL.COLUMN_NAME',
      'LEFT JOIN QSYS2.SYSCST',
      'ON QSYS2.SYSCSTCOL.CONSTRAINT_NAME = QSYS2.SYSCST.CONSTRAINT_NAME',
      'WHERE QSYS2.SYSCOLUMNS.TABLE_SCHEMA =',
      table.schema ? this.escape(table.schema) : 'CURRENT SCHEMA',
      'AND QSYS2.SYSCOLUMNS.TABLE_NAME =',
      this.escape(table.tableName),
    ]);
  }

  listTablesQuery(options?: ListTablesQueryOptions) {
    return joinSQLFragments([
      'SELECT TABLE_NAME AS "tableName",',
      'TABLE_SCHEMA AS "schema"',
      `FROM QSYS2.SYSTABLES WHERE TABLE_TYPE = 'T'`,
      options?.schema
        ? `AND TABLE_SCHEMA = ${this.escape(options.schema)}`
        : `AND TABLE_SCHEMA NOT LIKE 'Q%' AND TABLE_SCHEMA NOT LIKE 'SYS%'`,
      'ORDER BY TABLE_SCHEMA, TABLE_NAME',
    ]);
  }

  renameTableQuery(
    beforeTableName: TableOrModel,
    afterTableName: TableOrModel,
    options?: RenameTableQueryOptions,
  ): string {
    if (options) {
      rejectInvalidOptions(
        'renameTableQuery',
        this.dialect,
        RENAME_TABLE_QUERY_SUPPORTABLE_OPTIONS,
        EMPTY_SET,
        options,
      );
    }

    const beforeTable = this.extractTableDetails(beforeTableName);
    const afterTable = this.extractTableDetails(afterTableName);

    if (beforeTable.schema !== afterTable.schema) {
      throw new Error(
        `Moving tables between schemas is not supported by ${this.dialect.name} dialect.`,
      );
    }

    return `RENAME TABLE ${this.quoteTable(beforeTableName)} TO ${this.quoteIdentifier(afterTable.tableName)}`;
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

    return `TRUNCATE TABLE ${this.quoteTable(tableName)} IMMEDIATE`;
  }

  showConstraintsQuery(tableName: TableOrModel, options?: ShowConstraintsQueryOptions) {
    const table = this.extractTableDetails(tableName);

    return joinSQLFragments([
      'SELECT c.CONSTRAINT_SCHEMA AS "constraintSchema",',
      'c.CONSTRAINT_NAME AS "constraintName",',
      'c.CONSTRAINT_TYPE AS "constraintType",',
      'c.TABLE_SCHEMA AS "tableSchema",',
      'c.TABLE_NAME AS "tableName",',
      'k.COLUMN_NAME AS "columnNames",',
      'fk.TABLE_SCHEMA AS "referencedTableSchema",',
      'fk.TABLE_NAME AS "referencedTableName",',
      'fk.COLUMN_NAME AS "referencedColumnNames",',
      'r.DELETE_RULE AS "deleteRule",',
      'r.UPDATE_RULE AS "updateRule",',
      'ch.CHECK_CLAUSE AS "definition",',
      'c.IS_DEFERRABLE AS "isDeferrable",',
      'c.INITIALLY_DEFERRED AS "initiallyDeferred"',
      'FROM QSYS2.SYSCST c',
      'LEFT JOIN QSYS2.SYSREFCST r ON c.CONSTRAINT_NAME = r.CONSTRAINT_NAME AND c.CONSTRAINT_SCHEMA = r.CONSTRAINT_SCHEMA',
      'LEFT JOIN QSYS2.SYSKEYCST k ON c.CONSTRAINT_NAME = k.CONSTRAINT_NAME AND c.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA',
      'LEFT JOIN QSYS2.SYSKEYCST fk ON r.UNIQUE_CONSTRAINT_NAME = k.CONSTRAINT_NAME AND r.UNIQUE_CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA',
      'LEFT JOIN QSYS2.SYSCHKCST ch ON c.CONSTRAINT_NAME = ch.CONSTRAINT_NAME AND c.CONSTRAINT_SCHEMA = ch.CONSTRAINT_SCHEMA',
      `WHERE c.TABLE_NAME = ${this.escape(table.tableName)}`,
      'AND c.TABLE_SCHEMA =',
      table.schema ? this.escape(table.schema) : 'CURRENT SCHEMA',
      options?.columnName ? `AND k.COLUMN_NAME = ${this.escape(options.columnName)}` : '',
      options?.constraintName
        ? `AND c.CONSTRAINT_NAME = ${this.escape(options.constraintName)}`
        : '',
      options?.constraintType
        ? `AND c.CONSTRAINT_TYPE = ${this.escape(options.constraintType)}`
        : '',
      'ORDER BY c.CONSTRAINT_NAME, k.ORDINAL_POSITION, fk.ORDINAL_POSITION',
    ]);
  }

  addIndexQuery(tableOrModel: TableOrModel, options: AddIndexQueryOptions): string {
    rejectInvalidOptions(
      'addIndexQuery',
      this.dialect,
      ADD_INDEX_QUERY_SUPPORTABLE_OPTIONS,
      this.dialect.supports.addIndex,
      options,
    );

    const table = this.extractTableDetails(tableOrModel);
    const indexOptions = { ...options };
    if (!Array.isArray(indexOptions.fields) || indexOptions.fields.length < 0) {
      throw new Error(
        `Property "fields" for addIndex requires an array with at least one value. Received: ${inspect(indexOptions.fields)}`,
      );
    }

    if ('method' in indexOptions) {
      throw new Error('Property "method" for addIndex has been renamed to "using".');
    }

    const columnSql = indexOptions.fields.map(column => {
      if (typeof column === 'string') {
        column = { name: column };
      }

      if (column instanceof BaseSqlExpression) {
        return this.formatSqlExpression(column);
      }

      if ('attribute' in column) {
        throw new Error('Property "attribute" for addIndex fields has been renamed to "name".');
      }

      if (!column.name) {
        throw new Error(`The following index column has no name: ${inspect(column)}`);
      }

      let result = this.quoteIdentifier(column.name);

      if (column.collate) {
        throw new Error(
          `The ${this.dialect.name} dialect does not support collate on index fields.`,
        );
      }

      const operator = column.operator || indexOptions.operator;
      if (operator) {
        throw new Error(
          `The ${this.dialect.name} dialect does not support operator on index fields.`,
        );
      }

      if (column.length) {
        throw new Error(
          `The ${this.dialect.name} dialect does not support length on index fields.`,
        );
      }

      if (column.order) {
        result += ` ${column.order}`;
      }

      return result;
    });

    indexOptions.prefix = indexOptions.prefix || table.tableName;
    if (indexOptions.prefix && typeof indexOptions.prefix === 'string') {
      indexOptions.prefix = indexOptions.prefix.replaceAll('.', '_');
    }

    if (indexOptions.type && indexOptions.type.toLowerCase() === 'unique') {
      indexOptions.unique = true;
      delete indexOptions.type;
    }

    let includeSql: string | undefined;
    if (indexOptions.include) {
      if (indexOptions.include instanceof BaseSqlExpression) {
        includeSql = `INCLUDE ${this.formatSqlExpression(indexOptions.include)}`;
      } else if (Array.isArray(indexOptions.include)) {
        includeSql = `INCLUDE (${indexOptions.include.map(column => (column instanceof BaseSqlExpression ? this.formatSqlExpression(column) : this.quoteIdentifier(column))).join(', ')})`;
      } else {
        throw new TypeError(
          'The include option for indexes must be an array or an sql expression.',
        );
      }
    }

    // Although the function is 'addIndex', and the values are passed through
    // the 'indexes' key of a table, Db2 for i doesn't allow REFERENCES to
    // work against a UNIQUE INDEX, only a UNIQUE constraint.
    if (options.unique) {
      return joinSQLFragments([
        'BEGIN',
        "DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42891' BEGIN END;",
        this.addConstraintQuery(table, {
          fields: indexOptions.fields,
          name: options.name || generateIndexName(table, indexOptions),
          type: 'UNIQUE',
        }),
        ';',
        'END',
      ]);
    }

    // The index will be incorrectly scoped if we don't specify the schema name,
    // which will cause it to error if another schema contains a table that uses an index with an identical name
    const quotedIndexName = table.schema
      ? // 'quoteTable' isn't the best name: it quotes any identifier.
        // in this case, the goal is to produce '"schema_name"."index_name"' to scope the index in this schema
        this.quoteTable({
          schema: table.schema,
          tableName: options.name || generateIndexName(table, indexOptions),
        })
      : this.quoteIdentifier(options.name || generateIndexName(table, indexOptions));

    return joinSQLFragments([
      'CREATE',
      indexOptions.unique ? 'UNIQUE INDEX' : 'INDEX',
      quotedIndexName,
      `ON ${this.quoteTable(tableOrModel)}`,
      `(${columnSql.join(', ')})`,
      indexOptions.include ? includeSql : '',
      indexOptions.where ? this.whereQuery(indexOptions.where) : '',
    ]);
  }

  showIndexesQuery(tableName: TableOrModel) {
    const table = this.extractTableDetails(tableName);

    // TODO [+odbc]: check if the query also works when capitalized (for consistency)
    return joinSQLFragments([
      'select QSYS2.SYSCSTCOL.CONSTRAINT_NAME as NAME, QSYS2.SYSCSTCOL.COLUMN_NAME, QSYS2.SYSCST.CONSTRAINT_TYPE, QSYS2.SYSCST.TABLE_SCHEMA,',
      'QSYS2.SYSCST.TABLE_NAME from QSYS2.SYSCSTCOL left outer join QSYS2.SYSCST on QSYS2.SYSCSTCOL.TABLE_SCHEMA = QSYS2.SYSCST.TABLE_SCHEMA and',
      'QSYS2.SYSCSTCOL.TABLE_NAME = QSYS2.SYSCST.TABLE_NAME and QSYS2.SYSCSTCOL.CONSTRAINT_NAME = QSYS2.SYSCST.CONSTRAINT_NAME where',
      'QSYS2.SYSCSTCOL.TABLE_SCHEMA =',
      table.schema ? this.escape(table.schema) : 'CURRENT SCHEMA',
      `and QSYS2.SYSCSTCOL.TABLE_NAME = ${this.escape(table.tableName)} union select QSYS2.SYSKEYS.INDEX_NAME AS NAME,`,
      `QSYS2.SYSKEYS.COLUMN_NAME, CAST('INDEX' AS VARCHAR(11)), QSYS2.SYSINDEXES.TABLE_SCHEMA, QSYS2.SYSINDEXES.TABLE_NAME from QSYS2.SYSKEYS`,
      'left outer join QSYS2.SYSINDEXES on QSYS2.SYSKEYS.INDEX_NAME = QSYS2.SYSINDEXES.INDEX_NAME where QSYS2.SYSINDEXES.TABLE_SCHEMA =',
      table.schema ? this.escape(table.schema) : 'CURRENT SCHEMA',
      'and QSYS2.SYSINDEXES.TABLE_NAME =',
      this.escape(table.tableName),
    ]);
  }

  // Version queries
  versionQuery() {
    return 'SELECT CONCAT(OS_VERSION, CONCAT(\'.\', OS_RELEASE)) AS "version" FROM SYSIBMADM.ENV_SYS_INFO';
  }

  tableExistsQuery(tableName: TableOrModel): string {
    const table = this.extractTableDetails(tableName);

    return joinSQLFragments([
      `SELECT TABLE_NAME FROM QSYS2.SYSTABLES WHERE TABLE_NAME = ${this.escape(table.tableName)} AND TABLE_SCHEMA = `,
      table.schema ? this.escape(table.schema) : 'CURRENT SCHEMA',
    ]);
  }

  createSavepointQuery(savepointName: string): string {
    return `SAVEPOINT ${this.quoteIdentifier(savepointName)} ON ROLLBACK RETAIN CURSORS`;
  }
}
