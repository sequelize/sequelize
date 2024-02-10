import type { AttributeOptions } from '../../model.js';
import { Op } from '../../operators.js';
import { rejectInvalidOptions } from '../../utils/check';
import { joinSQLFragments } from '../../utils/join-sql-fragments';
import { isModelStatic } from '../../utils/model-utils.js';
import { generateIndexName } from '../../utils/string';
import { AbstractQueryGenerator } from '../abstract/query-generator';
import {
  DROP_SCHEMA_QUERY_SUPPORTABLE_OPTIONS,
  REMOVE_INDEX_QUERY_SUPPORTABLE_OPTIONS,
  RENAME_TABLE_QUERY_SUPPORTABLE_OPTIONS,
  TRUNCATE_TABLE_QUERY_SUPPORTABLE_OPTIONS,
} from '../abstract/query-generator-typescript';
import type { QueryWithBindParams, RemoveIndexQueryOptions, TableNameOrModel } from '../abstract/query-generator-typescript';
import type {
  BulkInsertQueryOptions,
  DropSchemaQueryOptions,
  InsertQueryOptions,
  ListSchemasQueryOptions,
  ListTablesQueryOptions,
  RenameTableQueryOptions,
  ShowConstraintsQueryOptions,
  TruncateTableQueryOptions,
} from '../abstract/query-generator.types';
import type { ConstraintType } from '../abstract/query-interface.types';
import { Db2QueryGeneratorInternal } from './query-generator-internal.js';
import type { Db2Dialect } from './index.js';

const DROP_SCHEMA_QUERY_SUPPORTED_OPTIONS = new Set<keyof DropSchemaQueryOptions>();
const REMOVE_INDEX_QUERY_SUPPORTED_OPTIONS = new Set<keyof RemoveIndexQueryOptions>();
const RENAME_TABLE_QUERY_SUPPORTED_OPTIONS = new Set<keyof RenameTableQueryOptions>();
const TRUNCATE_TABLE_QUERY_SUPPORTED_OPTIONS = new Set<keyof TruncateTableQueryOptions>();

/**
 * Temporary class to ease the TypeScript migration
 */
export class Db2QueryGeneratorTypeScript extends AbstractQueryGenerator {
  readonly #internals: Db2QueryGeneratorInternal;

  constructor(dialect: Db2Dialect, internals: Db2QueryGeneratorInternal = new Db2QueryGeneratorInternal(dialect)) {
    super(dialect, internals);

    internals.whereSqlBuilder.setOperatorKeyword(Op.regexp, 'REGEXP_LIKE');
    internals.whereSqlBuilder.setOperatorKeyword(Op.notRegexp, 'NOT REGEXP_LIKE');

    this.#internals = internals;
  }

  dropSchemaQuery(schemaName: string, options?: DropSchemaQueryOptions): string {
    if (options) {
      rejectInvalidOptions(
        'dropSchemaQuery',
        this.dialect.name,
        DROP_SCHEMA_QUERY_SUPPORTABLE_OPTIONS,
        DROP_SCHEMA_QUERY_SUPPORTED_OPTIONS,
        options,
      );
    }

    return `DROP SCHEMA ${this.quoteIdentifier(schemaName)} RESTRICT`;
  }

  listSchemasQuery(options?: ListSchemasQueryOptions) {
    let schemasToSkip = this.#internals.getTechnicalSchemaNames();
    if (options && Array.isArray(options?.skip)) {
      schemasToSkip = [...schemasToSkip, ...options.skip];
    }

    return joinSQLFragments([
      'SELECT SCHEMANAME AS "schema" FROM SYSCAT.SCHEMATA',
      `WHERE SCHEMANAME NOT LIKE 'SYS%' AND SCHEMANAME NOT IN (${schemasToSkip.map(schema => this.escape(schema)).join(', ')})`,
    ]);
  }

  describeTableQuery(tableName: TableNameOrModel) {
    const table = this.extractTableDetails(tableName);

    return joinSQLFragments([
      'SELECT COLNAME AS "Name",',
      'TABNAME AS "Table",',
      'TABSCHEMA AS "Schema",',
      'TYPENAME AS "Type",',
      'LENGTH AS "Length",',
      'SCALE AS "Scale",',
      'NULLS AS "IsNull",',
      'DEFAULT AS "Default",',
      'COLNO AS "Colno",',
      'IDENTITY AS "IsIdentity",',
      'KEYSEQ AS "KeySeq",',
      'REMARKS AS "Comment"',
      'FROM SYSCAT.COLUMNS',
      `WHERE TABNAME = ${this.escape(table.tableName)}`,
      `AND TABSCHEMA = ${this.escape(table.schema)}`,
    ]);
  }

  listTablesQuery(options?: ListTablesQueryOptions) {
    return joinSQLFragments([
      'SELECT TABNAME AS "tableName",',
      'TRIM(TABSCHEMA) AS "schema"',
      `FROM SYSCAT.TABLES WHERE TYPE = 'T'`,
      options?.schema
        ? `AND TABSCHEMA = ${this.escape(options.schema)}`
        : `AND TABSCHEMA NOT LIKE 'SYS%' AND TABSCHEMA NOT IN (${this.#internals.getTechnicalSchemaNames().map(schema => this.escape(schema)).join(', ')})`,
      'ORDER BY TABSCHEMA, TABNAME',
    ]);
  }

  renameTableQuery(
    beforeTableName: TableNameOrModel,
    afterTableName: TableNameOrModel,
    options?: RenameTableQueryOptions,
  ): string {
    if (options) {
      rejectInvalidOptions(
        'renameTableQuery',
        this.dialect.name,
        RENAME_TABLE_QUERY_SUPPORTABLE_OPTIONS,
        RENAME_TABLE_QUERY_SUPPORTED_OPTIONS,
        options,
      );
    }

    const beforeTable = this.extractTableDetails(beforeTableName);
    const afterTable = this.extractTableDetails(afterTableName);

    if (beforeTable.schema !== afterTable.schema) {
      throw new Error(`Moving tables between schemas is not supported by ${this.dialect.name} dialect.`);
    }

    return `RENAME TABLE ${this.quoteTable(beforeTableName)} TO ${this.quoteIdentifier(afterTable.tableName)}`;
  }

  truncateTableQuery(tableName: TableNameOrModel, options?: TruncateTableQueryOptions) {
    if (options) {
      rejectInvalidOptions(
        'truncateTableQuery',
        this.dialect.name,
        TRUNCATE_TABLE_QUERY_SUPPORTABLE_OPTIONS,
        TRUNCATE_TABLE_QUERY_SUPPORTED_OPTIONS,
        options,
      );
    }

    return `TRUNCATE TABLE ${this.quoteTable(tableName)} IMMEDIATE`;
  }

  #getConstraintType(type: ConstraintType): string {
    switch (type) {
      case 'CHECK':
        return 'K';
      case 'FOREIGN KEY':
        return 'F';
      case 'PRIMARY KEY':
        return 'P';
      case 'UNIQUE':
        return 'U';
      default:
        throw new Error(`Constraint type ${type} is not supported`);
    }
  }

  showConstraintsQuery(tableName: TableNameOrModel, options?: ShowConstraintsQueryOptions) {
    const table = this.extractTableDetails(tableName);

    return joinSQLFragments([
      'SELECT TRIM(c.TABSCHEMA) AS "constraintSchema",',
      'c.CONSTNAME AS "constraintName",',
      `CASE c.TYPE WHEN 'P' THEN 'PRIMARY KEY' WHEN 'F' THEN 'FOREIGN KEY' WHEN 'K' THEN 'CHECK' WHEN 'U' THEN 'UNIQUE' ELSE NULL END AS "constraintType",`,
      'TRIM(c.TABSCHEMA) AS "tableSchema",',
      'c.TABNAME AS "tableName",',
      'k.COLNAME AS "columnNames",',
      'TRIM(r.REFTABSCHEMA) AS "referencedTableSchema",',
      'r.REFTABNAME AS "referencedTableName",',
      'fk.COLNAME AS "referencedColumnNames",',
      `CASE r.DELETERULE WHEN 'A' THEN 'NO ACTION' WHEN 'C' THEN 'CASCADE' WHEN 'N' THEN 'SET NULL' WHEN 'R' THEN 'RESTRICT' ELSE NULL END AS "deleteAction",`,
      `CASE r.UPDATERULE WHEN 'A' THEN 'NO ACTION' WHEN 'R' THEN 'RESTRICT' ELSE NULL END AS "updateAction",`,
      'ck.TEXT AS "definition"',
      'FROM SYSCAT.TABCONST c',
      'LEFT JOIN SYSCAT.REFERENCES r ON c.CONSTNAME = r.CONSTNAME AND c.TABNAME = r.TABNAME AND c.TABSCHEMA = r.TABSCHEMA',
      'LEFT JOIN SYSCAT.KEYCOLUSE k ON c.CONSTNAME = k.CONSTNAME AND c.TABNAME = k.TABNAME AND c.TABSCHEMA = k.TABSCHEMA',
      'LEFT JOIN SYSCAT.KEYCOLUSE fk ON r.REFKEYNAME = fk.CONSTNAME',
      'LEFT JOIN SYSCAT.CHECKS ck ON c.CONSTNAME = ck.CONSTNAME AND c.TABNAME = ck.TABNAME AND c.TABSCHEMA = ck.TABSCHEMA',
      `WHERE c.TABNAME = ${this.escape(table.tableName)}`,
      `AND c.TABSCHEMA = ${this.escape(table.schema)}`,
      options?.columnName ? `AND k.COLNAME = ${this.escape(options.columnName)}` : '',
      options?.constraintName ? `AND c.CONSTNAME = ${this.escape(options.constraintName)}` : '',
      options?.constraintType ? `AND c.TYPE = ${this.escape(this.#getConstraintType(options.constraintType))}` : '',
      'ORDER BY c.CONSTNAME, k.COLSEQ, fk.COLSEQ',
    ]);
  }

  showIndexesQuery(tableName: TableNameOrModel) {
    const table = this.extractTableDetails(tableName);

    return joinSQLFragments([
      'SELECT',
      'i.INDNAME AS "name",',
      'i.TABNAME AS "tableName",',
      'i.UNIQUERULE AS "keyType",',
      'i.INDEXTYPE AS "type",',
      'c.COLNAME AS "columnName",',
      'c.COLORDER AS "columnOrder"',
      'FROM SYSCAT.INDEXES i',
      'INNER JOIN SYSCAT.INDEXCOLUSE c ON i.INDNAME = c.INDNAME AND i.INDSCHEMA = c.INDSCHEMA',
      `WHERE TABNAME = ${this.escape(table.tableName)}`,
      `AND TABSCHEMA = ${this.escape(table.schema)}`,
      'ORDER BY i.INDNAME, c.COLSEQ;',
    ]);
  }

  removeIndexQuery(
    tableName: TableNameOrModel,
    indexNameOrAttributes: string | string[],
    options?: RemoveIndexQueryOptions,
  ) {
    if (options) {
      rejectInvalidOptions(
        'removeIndexQuery',
        this.dialect.name,
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

    return `DROP INDEX ${this.quoteIdentifier(indexName)}`;
  }

  versionQuery() {
    return 'select service_level as "version" from TABLE (sysproc.env_get_inst_info()) as A';
  }

  tableExistsQuery(tableName: TableNameOrModel): string {
    const table = this.extractTableDetails(tableName);

    return `SELECT TABNAME FROM SYSCAT.TABLES WHERE TABNAME = ${this.escape(table.tableName)} AND TABSCHEMA = ${this.escape(table.schema)}`;
  }

  bulkInsertQuery(
    tableName: TableNameOrModel,
    values: Array<Record<string, unknown>>,
    options?: BulkInsertQueryOptions,
    attributeHash?: Record<string, AttributeOptions>,
  ): string {
    const query = super.bulkInsertQuery(tableName, values, { ...options, returning: false }, attributeHash);

    if (options?.returning) {
      const model = isModelStatic(tableName) ? tableName : options.model;
      const attributeMap = new Map<string, AttributeOptions>();
      if (model) {
        for (const [column, attribute] of model.modelDefinition.physicalAttributes.entries()) {
          attributeMap.set(attribute?.columnName ?? column, attribute);
        }
      } else if (attributeHash) {
        for (const [column, attribute] of Object.entries(attributeHash)) {
          attributeMap.set(attribute?.columnName ?? column, attribute);
        }
      }

      return joinSQLFragments([
        'SELECT',
        this.#internals.getReturnFields(options, attributeMap).join(', '),
        'FROM FINAL TABLE (',
        query,
        ')',
      ]);
    }

    return query;
  }

  insertQuery(
    tableName: TableNameOrModel,
    value: Record<string, unknown>,
    options?: InsertQueryOptions,
    attributeHash?: Record<string, AttributeOptions>,
  ): QueryWithBindParams {
    const { query, bind } = super.insertQuery(tableName, value, { ...options, returning: false }, attributeHash);

    if (options?.returning) {
      const model = isModelStatic(tableName) ? tableName : options.model;
      const attributeMap = new Map<string, AttributeOptions>();
      if (model) {
        for (const [column, attribute] of model.modelDefinition.physicalAttributes.entries()) {
          attributeMap.set(attribute?.columnName ?? column, attribute);
        }
      } else if (attributeHash) {
        for (const [column, attribute] of Object.entries(attributeHash)) {
          attributeMap.set(attribute?.columnName ?? column, attribute);
        }
      }

      return {
        query: joinSQLFragments([
          'SELECT',
          this.#internals.getReturnFields(options, attributeMap).join(', '),
          'FROM FINAL TABLE (',
          query,
          ')',
        ]),
        bind,
      };
    }

    return { query, bind };
  }
}
