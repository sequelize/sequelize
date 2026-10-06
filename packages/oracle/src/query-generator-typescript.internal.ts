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
import { AbstractQueryGenerator, DataTypes, IsolationLevel } from '@sequelize/core';
import {
  CREATE_SCHEMA_QUERY_SUPPORTABLE_OPTIONS,
  REMOVE_COLUMN_QUERY_SUPPORTABLE_OPTIONS,
  REMOVE_INDEX_QUERY_SUPPORTABLE_OPTIONS,
  RENAME_TABLE_QUERY_SUPPORTABLE_OPTIONS,
  TRUNCATE_TABLE_QUERY_SUPPORTABLE_OPTIONS,
  normalizeAttributeToSqlColumn,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator-typescript.js';
import type {
  AttributeToSqlInput,
  AttributeToSqlOptions,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator.internal-types.js';
import type { TableNameWithSchema } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-interface.js';
import { rejectInvalidOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import { joinSQLFragments } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/join-sql-fragments.js';
import {
  extractModelDefinition,
  isModelStatic,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/model-utils.js';
import { EMPTY_SET } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/object.js';
import { defaultValueSchemable } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/query-builder-utils.js';
import { generateIndexName } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/string.js';
import {
  buildDescribeTableQuery,
  buildForeignKeysQuery,
  buildShowConstraintsQuery,
  buildShowIndexesQuery,
} from './_internal/catalog-queries.js';
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
    return buildDescribeTableQuery(this, tableName, value => this.escape(value));
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
    return buildShowIndexesQuery(this, table, value => this.escape(value));
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
      this.escape(`CREATE USER ${quotedSchema} IDENTIFIED EXTERNALLY DEFAULT TABLESPACE USERS`),
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
    return buildForeignKeysQuery(this, table, value => this.escape(value));
  }

  showConstraintsQuery(tableName: TableOrModel, options?: ShowConstraintsQueryOptions) {
    if (options && options.constraintType === 'FOREIGN KEY') {
      return this.getForeignKeysQuery(tableName);
    }

    return buildShowConstraintsQuery(this, tableName, options, value => this.escape(value));
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

  getRandomFloatFunctionCall(): string {
    return 'DBMS_RANDOM.VALUE()';
  }

  attributeToSql(column: AttributeToSqlInput, options?: AttributeToSqlOptions): string {
    const attribute = normalizeAttributeToSqlColumn(column);

    // handle self referential constraints
    const model = attribute.Model;
    if (
      attribute.references?.table &&
      model?.tableName &&
      this.isSameTable(model.tableName, attribute.references.table)
    ) {
      this.sequelize.log(
        'Oracle does not support self referencial constraints, ' +
          'we will remove it but we recommend restructuring your query',
      );
      attribute.onDelete = '';
    }

    let template: string;

    if (attribute.type instanceof DataTypes.ENUM) {
      // enums are a special case
      template = attribute.type.toSql();
      template += ` CHECK (${this.quoteIdentifier(attribute.field!)} IN(${attribute.type.options.values
        .map(value => {
          return this.escape(value);
        })
        .join(', ')}))`;

      return template;
    }

    if (attribute.type instanceof DataTypes.JSON) {
      template = attribute.type.toSql();
      template += ` CHECK (${this.quoteIdentifier(attribute.field!)} IS JSON)`;

      return template;
    }

    if (attribute.type instanceof DataTypes.BOOLEAN) {
      template = attribute.type.toSql();
      template += ` CHECK (${this.quoteIdentifier(attribute.field!)} IN('1', '0'))`;

      return template;
    }

    if (attribute.autoIncrement) {
      template = ' NUMBER(*,0) GENERATED BY DEFAULT ON NULL AS IDENTITY';
    } else if (attribute.type) {
      let unsignedTemplate = '';
      const typeOptions = (attribute.type as unknown as { options?: { unsigned?: boolean } })
        .options;
      if (typeOptions?.unsigned) {
        unsignedTemplate += ` CHECK(${this.quoteIdentifier(attribute.field!)} >= 0)`;
      }

      template = attribute.type.toString();

      if (attribute.type && defaultValueSchemable(attribute.defaultValue, this.dialect)) {
        template += ` DEFAULT ${this.escape(attribute.defaultValue, { type: attribute.type })}`;
      }

      if (!attribute.autoIncrement) {
        // If autoincrement, not null is set automatically
        if (attribute.allowNull === false) {
          template += ' NOT NULL';
        } else if (
          !attribute.primaryKey &&
          !defaultValueSchemable(attribute.defaultValue, this.dialect)
        ) {
          template += ' NULL';
        }
      }

      template += unsignedTemplate;
    } else {
      template = '';
    }

    if (attribute.primaryKey) {
      template += ' PRIMARY KEY';
    }

    if (!options?.withoutForeignKeyConstraints && attribute.references) {
      template += ` REFERENCES ${this.quoteTable(attribute.references.table)}`;

      if (attribute.references.key) {
        template += ` (${this.quoteIdentifier(attribute.references.key)})`;
      } else {
        template += ` (${this.quoteIdentifier('id')})`;
      }

      if (attribute.onDelete && attribute.onDelete.toUpperCase() !== 'NO ACTION') {
        template += ` ON DELETE ${attribute.onDelete.toUpperCase()}`;
      }
    }

    return template;
  }
}
