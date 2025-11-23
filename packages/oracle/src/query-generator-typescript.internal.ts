// Copyright (c) 2025, Oracle and/or its affiliates. All rights reserved

import type {
  BulkDeleteQueryOptions,
  CreateSchemaQueryOptions,
  RemoveColumnQueryOptions,
  RemoveConstraintQueryOptions,
  RemoveIndexQueryOptions,
  RenameTableQueryOptions,
  ShowConstraintsQueryOptions,
  TableOrModel,
  TruncateTableQueryOptions,
} from '@sequelize/core';
import { AbstractQueryGenerator, IsolationLevel } from '@sequelize/core';
import {
  CREATE_SCHEMA_QUERY_SUPPORTABLE_OPTIONS,
  REMOVE_COLUMN_QUERY_SUPPORTABLE_OPTIONS,
  REMOVE_INDEX_QUERY_SUPPORTABLE_OPTIONS,
  RENAME_TABLE_QUERY_SUPPORTABLE_OPTIONS,
  TRUNCATE_TABLE_QUERY_SUPPORTABLE_OPTIONS,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator-typescript.js';
import type { TableNameWithSchema } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-interface.js';
import { rejectInvalidOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import { joinSQLFragments } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/join-sql-fragments.js';
import {
  extractModelDefinition,
  isModelStatic,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/model-utils.js';
import { EMPTY_SET } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/object.js';
import { generateIndexName } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/string.js';
import type { OracleDialect } from './dialect.js';
import { OracleQueryGeneratorInternal } from './query-generator.internal.js';

export class OracleQueryGeneratorTypeScript extends AbstractQueryGenerator {
  readonly #internals: OracleQueryGeneratorInternal;

  constructor(
    dialect: OracleDialect,
    internals: OracleQueryGeneratorInternal = new OracleQueryGeneratorInternal(dialect),
  ) {
    super(dialect, internals);

    this.#internals = internals;
  }

  describeTableQuery(tableName: TableOrModel) {
    const table = this.extractTableDetails(tableName);
    const currTableName = this.getCatalogName(table.tableName);
    const schema = this.getCatalogName(table.schema);

    return [
      'SELECT atc.COLUMN_NAME, atc.DATA_TYPE, atc.DATA_LENGTH, atc.CHAR_LENGTH, atc.DEFAULT_LENGTH, atc.NULLABLE, ucc.constraint_type ',
      'FROM all_tab_columns atc ',
      'LEFT OUTER JOIN ',
      '(SELECT acc.column_name, acc.table_name, ac.constraint_type FROM all_cons_columns acc INNER JOIN all_constraints ac ON acc.constraint_name = ac.constraint_name) ucc ',
      'ON (atc.table_name = ucc.table_name AND atc.COLUMN_NAME = ucc.COLUMN_NAME) ',
      schema ? `WHERE (atc.OWNER = ${this.escape(schema)}) ` : 'WHERE atc.OWNER = USER ',
      `AND (atc.TABLE_NAME = ${this.escape(currTableName)})`,
      'ORDER BY atc.COLUMN_NAME, CONSTRAINT_TYPE DESC',
    ].join('');
  }

  removeIndexQuery(
    tableName: TableOrModel,
    indexNameOrAttributes: string | string[],
    options: RemoveIndexQueryOptions,
  ) {
    if (options) {
      rejectInvalidOptions(
        'removeIndexQuery',
        this.dialect,
        REMOVE_INDEX_QUERY_SUPPORTABLE_OPTIONS,
        EMPTY_SET,
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
    return `SELECT VERSION_FULL AS "version" FROM PRODUCT_COMPONENT_VERSION WHERE PRODUCT LIKE 'Oracle%'`;
  }

  /**
   * Returns the value as it is stored in the Oracle DB
   *
   * @param value
   */
  getCatalogName(value: string | undefined) {
    if (value && this.options.quoteIdentifiers === false) {
      const quotedValue = this.quoteIdentifier(value);
      if (quotedValue === value) {
        value = value.toUpperCase();
      }
    }

    return value;
  }

  showIndexesQuery(table: TableNameWithSchema) {
    const [tableName, owner] = this.getSchemaNameAndTableName(table);
    const sql = [
      'SELECT i.index_name,i.table_name, i.column_name, u.uniqueness, i.descend, c.constraint_type ',
      'FROM all_ind_columns i ',
      'INNER JOIN all_indexes u ',
      'ON (u.table_name = i.table_name AND u.index_name = i.index_name) ',
      'LEFT OUTER JOIN all_constraints c ',
      'ON (c.table_name = i.table_name AND c.index_name = i.index_name) ',
      `WHERE i.table_name = ${this.escape(tableName)}`,
      ' AND u.table_owner = ',
      owner ? this.escape(owner) : 'USER',
      ' ORDER BY index_name, column_position',
    ];

    return sql.join('');
  }

  /**
   * Returns the tableName and schemaName as it is stored the Oracle DB
   *
   * @param table
   */
  getSchemaNameAndTableName(table: any) {
    table = this.extractTableDetails(table);
    const tableName = this.getCatalogName(table.tableName || table);
    const schemaName = this.getCatalogName(table.schema);

    return [tableName, schemaName];
  }

  removeConstraintQuery(
    tableName: TableOrModel,
    constraintName: string,
    options?: RemoveConstraintQueryOptions,
  ) {
    if (constraintName.startsWith('sys')) {
      return joinSQLFragments([
        'ALTER TABLE',
        this.quoteTable(tableName),
        'DROP CONSTRAINT',
        options?.ifExists ? 'IF EXISTS' : '',
        constraintName,
        options?.cascade ? 'CASCADE' : '',
      ]);
    }

    return super.removeConstraintQuery(tableName, constraintName, options);
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
    const renamedTable = afterTable.tableName;

    if (beforeTable.schema !== afterTable.schema) {
      throw new Error(
        `Moving tables between schemas is not supported by ${this.dialect.name} dialect.`,
      );
    }

    return `ALTER TABLE ${this.quoteTable(beforeTableName)} RENAME TO ${this.quoteTable(renamedTable)}`;
  }

  removeColumnQuery(
    tableName: TableOrModel,
    attributeName: string,
    options: RemoveColumnQueryOptions,
  ): string {
    rejectInvalidOptions(
      'removeColumnQuery',
      this.dialect,
      REMOVE_COLUMN_QUERY_SUPPORTABLE_OPTIONS,
      EMPTY_SET,
      options,
    );

    return joinSQLFragments([
      'ALTER TABLE',
      this.quoteTable(tableName),
      'DROP COLUMN',
      this.quoteIdentifier(attributeName),
    ]);
  }

  createSchemaQuery(schema: string, options: CreateSchemaQueryOptions): string {
    if (options) {
      rejectInvalidOptions(
        'createSchemaQuery',
        this.dialect,
        CREATE_SCHEMA_QUERY_SUPPORTABLE_OPTIONS,
        EMPTY_SET,
        options,
      );
    }

    const quotedSchema = this.quoteIdentifier(schema);

    return [
      'DECLARE',
      'USER_FOUND BOOLEAN := FALSE;',
      'BEGIN',
      ' BEGIN',
      '   EXECUTE IMMEDIATE ',
      this.escape(`CREATE USER ${quotedSchema} IDENTIFIED BY 12345 DEFAULT TABLESPACE USERS`),
      ';',
      '   EXCEPTION WHEN OTHERS THEN',
      '     IF SQLCODE != -1920 THEN',
      '       RAISE;',
      '     ELSE',
      '       USER_FOUND := TRUE;',
      '     END IF;',
      ' END;',
      ' IF NOT USER_FOUND THEN',
      '    EXECUTE IMMEDIATE ',
      this.escape(`GRANT "CONNECT" TO ${quotedSchema}`),
      ';',
      '    EXECUTE IMMEDIATE ',
      this.escape(`GRANT CREATE TABLE TO ${quotedSchema}`),
      ';',
      '    EXECUTE IMMEDIATE ',
      this.escape(`GRANT CREATE VIEW TO ${quotedSchema}`),
      ';',
      '    EXECUTE IMMEDIATE ',
      this.escape(`GRANT CREATE ANY TRIGGER TO ${quotedSchema}`),
      ';',
      '    EXECUTE IMMEDIATE ',
      this.escape(`GRANT CREATE ANY PROCEDURE TO ${quotedSchema}`),
      ';',
      '    EXECUTE IMMEDIATE ',
      this.escape(`GRANT CREATE SEQUENCE TO ${quotedSchema}`),
      ';',
      '    EXECUTE IMMEDIATE ',
      this.escape(`GRANT CREATE SYNONYM TO ${quotedSchema}`),
      ';',
      '    EXECUTE IMMEDIATE ',
      this.escape(`ALTER USER ${quotedSchema} QUOTA UNLIMITED ON USERS`),
      ';',
      ' END IF;',
      'END;',
    ].join(' ');
  }

  truncateTableQuery(tableName: TableOrModel, options: TruncateTableQueryOptions): string {
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

  getConstraintType(type: string) {
    switch (type) {
      case 'CHECK':
        return 'C';
      case 'FOREIGN KEY':
        return 'R';
      case 'PRIMARY KEY':
        return 'P';
      case 'UNIQUE':
        return 'U';
      default:
        throw new Error(`Constraint type ${type} is not supported`);
    }
  }

  getForeignKeysQuery(table: TableOrModel) {
    // We don't call quoteTable as we don't want the schema in the table name, Oracle seperates it on another field
    const tableDetails = this.extractTableDetails(table);
    const tableName = this.getCatalogName(tableDetails.tableName);
    const schemaName = this.getCatalogName(tableDetails.schema);
    const sql = [
      'SELECT DISTINCT  a.table_name "tableName", a.constraint_name "constraintName", c.owner "tableSchema", a.owner "constraintSchema", a.column_name "columnNames",',
      `CASE c.CONSTRAINT_TYPE WHEN 'P' THEN 'PRIMARY KEY' WHEN 'R' THEN 'FOREIGN KEY' WHEN 'C' THEN 'CHECK' WHEN 'U' THEN 'UNIQUE' ELSE NULL END "constraintType",`,
      ' c.r_owner "referencedTableSchema",',
      ' c.DELETE_RULE "deleteAction",',
      ` 'NO ACTION' AS "updateAction",`,
      ' b.table_name "referencedTableName", b.column_name "referencedColumnNames"',
      ' FROM all_cons_columns a',
      ' JOIN all_constraints c ON a.owner = c.owner AND a.constraint_name = c.constraint_name',
      ' JOIN all_cons_columns b ON c.r_owner = b.owner AND c.r_constraint_name = b.constraint_name',
      " WHERE c.constraint_type  = 'R'",
      ' AND a.table_name = ',
      this.escape(tableName),
      ' AND a.owner = ',
      tableDetails.schema && schemaName !== '' ? this.escape(schemaName) : 'USER',
      ' ORDER BY a.table_name, a.column_name, b.column_name',
    ].join('');

    return sql;
  }

  showConstraintsQuery(tableName: TableOrModel, options?: ShowConstraintsQueryOptions) {
    if (options && options.constraintType === 'FOREIGN KEY') {
      return this.getForeignKeysQuery(tableName);
    }

    const tableInfo = this.extractTableDetails(tableName);
    const schema = this.getCatalogName(tableInfo.schema);
    const table = this.getCatalogName(tableInfo.tableName);

    return joinSQLFragments([
      'SELECT C.CONSTRAINT_NAME "constraintName",',
      `CASE A.CONSTRAINT_TYPE WHEN 'P' THEN 'PRIMARY KEY' WHEN 'R' THEN 'FOREIGN KEY' WHEN 'C' THEN 'CHECK' WHEN 'U' THEN 'UNIQUE' ELSE NULL END "constraintType",`,
      'C.TABLE_NAME "tableName",',
      'A.OWNER "tableSchema",',
      'C.OWNER "constraintSchema",',
      'C.COLUMN_NAME "columnNames",',
      'A.SEARCH_CONDITION "definition"',
      'FROM ALL_CONS_COLUMNS C',
      'INNER JOIN ALL_CONSTRAINTS A ON C.CONSTRAINT_NAME = A.CONSTRAINT_NAME',
      'AND C.OWNER = A.OWNER',
      `WHERE C.TABLE_NAME =${this.escape(table)}`,
      `AND C.OWNER =${this.escape(schema)}`,
      options?.constraintName
        ? `AND C.CONSTRAINT_NAME =${this.escape(options.constraintName)}`
        : '',
      options?.constraintType
        ? `AND A.CONSTRAINT_TYPE =${this.escape(this.getConstraintType(options.constraintType))}`
        : '',
      'ORDER BY C.CONSTRAINT_NAME, C.POSITION',
    ]);
  }

  bulkDeleteQuery(tableName: TableOrModel, options: BulkDeleteQueryOptions): string {
    const table = this.quoteTable(tableName);
    const modelDefinition = extractModelDefinition(tableName);
    const whereOptions = isModelStatic(tableName) ? { ...options, model: tableName } : options;
    let queryTmpl;

    let whereClause = this.whereQuery(options.where, whereOptions);
    whereClause = whereClause.replace('WHERE', '');

    if (options.limit && this.dialect.supports.delete.limit) {
      if (!modelDefinition) {
        throw new Error(
          'Using LIMIT in bulkDeleteQuery requires specifying a model or model definition.',
        );
      }

      const whereTmpl = whereClause ? ` AND ${whereClause}` : '';
      queryTmpl = `DELETE FROM ${table} WHERE rowid IN (SELECT rowid FROM ${table} WHERE rownum <= ${this.escape(options.limit)}${whereTmpl})`;
    } else {
      const whereTmpl = whereClause ? ` WHERE${whereClause}` : '';
      queryTmpl = `DELETE FROM ${table}${whereTmpl}`;
    }

    return queryTmpl;
  }

  setIsolationLevelQuery(isolationLevel: IsolationLevel): string {
    switch (isolationLevel) {
      case IsolationLevel.READ_UNCOMMITTED:
      case IsolationLevel.READ_COMMITTED:
        return 'SET TRANSACTION ISOLATION LEVEL READ COMMITTED';
      case IsolationLevel.REPEATABLE_READ:
      case IsolationLevel.SERIALIZABLE:
        // Serializable mode is equal to Snapshot Isolation (SI)
        // defined in ANSI std.
        return 'SET TRANSACTION ISOLATION LEVEL SERIALIZABLE';
      default:
        throw new Error(
          `The ${isolationLevel} isolation level is not supported by ${this.dialect.name}.`,
        );
    }
  }

  commitTransactionQuery() {
    return 'COMMIT TRANSACTION';
  }

  rollbackTransactionQuery(): string {
    if (this.dialect.supports.connectionTransactionMethods) {
      throw new Error(
        `rollbackTransactionQuery is not supported by the ${this.dialect.name} dialect.`,
      );
    }

    return 'ROLLBACK TRANSACTION';
  }
}
