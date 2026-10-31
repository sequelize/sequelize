// Copyright (c) 2025, Oracle and/or its affiliates. All rights reserved

import type {
  BoundQuery,
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
import { AbstractQueryGenerator, DataTypes, IsolationLevel, ParameterStyle } from '@sequelize/core';
import { attributeTypeToSql } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/data-types-utils.js';
import type { ParameterOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator-typescript.js';
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
import { rejectInvalidOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import { joinSQLFragments } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/join-sql-fragments.js';
import {
  extractModelDefinition,
  isModelStatic,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/model-utils.js';
import { EMPTY_SET } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/object.js';
import { defaultValueSchemable } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/query-builder-utils.js';
import { createBindParamGenerator } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/sql.js';
import { generateIndexName } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/string.js';
import { pojo } from '@sequelize/utils';
import { inspect } from 'node:util';
import type { OracleDialect } from './dialect.js';
import { OracleQueryGeneratorInternal } from './query-generator.internal.js';

type CatalogQueryOptions = Pick<ParameterOptions, 'parameterStyle'>;
type BindCatalogQueryOptions = {
  parameterStyle: ParameterStyle.BIND | `${ParameterStyle.BIND}`;
};
type ReplacementCatalogQueryOptions = {
  parameterStyle?: ParameterStyle.REPLACEMENT | `${ParameterStyle.REPLACEMENT}` | undefined;
};
type ValueToSql = (value: unknown) => string;
type BoundCatalogQuery = BoundQuery & { bind: Record<string, unknown> };

export class OracleQueryGeneratorTypeScript extends AbstractQueryGenerator {
  readonly #internals: OracleQueryGeneratorInternal;

  constructor(
    dialect: OracleDialect,
    internals: OracleQueryGeneratorInternal = new OracleQueryGeneratorInternal(dialect),
  ) {
    super(dialect, internals);

    this.#internals = internals;
  }

  describeTableQuery(tableName: TableOrModel, options: BindCatalogQueryOptions): BoundCatalogQuery;
  describeTableQuery(tableName: TableOrModel, options?: ReplacementCatalogQueryOptions): string;
  describeTableQuery(
    tableName: TableOrModel,
    options?: CatalogQueryOptions,
  ): string | BoundCatalogQuery;
  describeTableQuery(
    tableName: TableOrModel,
    options?: CatalogQueryOptions,
  ): string | BoundCatalogQuery {
    return this.#catalogQuery(options, valueToSql => {
      const table = this.extractTableDetails(tableName);
      const owner = this.#ownerToSql(table.schema, valueToSql);

      return [
        'SELECT atc.COLUMN_NAME, atc.DATA_TYPE, atc.DATA_LENGTH, atc.CHAR_LENGTH, atc.DEFAULT_LENGTH, atc.NULLABLE, ucc.constraint_type ',
        'FROM all_tab_columns atc ',
        'LEFT OUTER JOIN ',
        '(SELECT acc.column_name, acc.table_name, ac.constraint_type FROM all_cons_columns acc INNER JOIN all_constraints ac ON acc.constraint_name = ac.constraint_name) ucc ',
        'ON (atc.table_name = ucc.table_name AND atc.COLUMN_NAME = ucc.COLUMN_NAME) ',
        owner === 'USER' ? 'WHERE atc.OWNER = USER ' : `WHERE (atc.OWNER = ${owner}) `,
        `AND (atc.TABLE_NAME = ${valueToSql(this.getCatalogName(table.tableName))})`,
        'ORDER BY atc.COLUMN_NAME, CONSTRAINT_TYPE DESC',
      ].join('');
    });
  }

  removeIndexQuery(
    tableName: TableOrModel,
    indexNameOrAttributes: string | string[],
    options?: RemoveIndexQueryOptions,
  ) {
    rejectInvalidOptions(
      'removeIndexQuery',
      this.dialect,
      REMOVE_INDEX_QUERY_SUPPORTABLE_OPTIONS,
      EMPTY_SET,
      options,
    );

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

  showIndexesQuery(tableName: TableOrModel, options: BindCatalogQueryOptions): BoundCatalogQuery;
  showIndexesQuery(tableName: TableOrModel, options?: ReplacementCatalogQueryOptions): string;
  showIndexesQuery(
    tableName: TableOrModel,
    options?: CatalogQueryOptions,
  ): string | BoundCatalogQuery;
  showIndexesQuery(
    tableName: TableOrModel,
    options?: CatalogQueryOptions,
  ): string | BoundCatalogQuery {
    return this.#catalogQuery(options, valueToSql => {
      const table = this.extractTableDetails(tableName);

      return [
        'SELECT i.index_name,i.table_name, i.column_name, u.uniqueness, i.descend, c.constraint_type ',
        'FROM all_ind_columns i ',
        'INNER JOIN all_indexes u ',
        'ON (u.table_name = i.table_name AND u.index_name = i.index_name) ',
        'LEFT OUTER JOIN all_constraints c ',
        'ON (c.table_name = i.table_name AND c.index_name = i.index_name) ',
        `WHERE i.table_name = ${valueToSql(this.getCatalogName(table.tableName))}`,
        ` AND u.table_owner = ${this.#ownerToSql(table.schema, valueToSql)}`,
        ' ORDER BY index_name, column_position',
      ].join('');
    });
  }

  #catalogQuery(
    options: CatalogQueryOptions | undefined,
    buildQuery: (valueToSql: ValueToSql) => string,
  ): string | BoundCatalogQuery {
    if (options?.parameterStyle !== ParameterStyle.BIND) {
      return buildQuery(value => this.escape(value));
    }

    const bind = pojo<Record<string, unknown>>();
    const bindParam = createBindParamGenerator(bind);

    return {
      query: buildQuery(value => {
        if (typeof value !== 'string') {
          throw new TypeError(
            `Catalog queries only accept strings as bind parameters, but received ${inspect(value)}.`,
          );
        }

        return bindParam(value);
      }),
      bind,
    };
  }

  #ownerToSql(schema: string | undefined, valueToSql: ValueToSql): string {
    const owner = this.getCatalogName(schema);

    return owner ? valueToSql(owner) : 'USER';
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
    rejectInvalidOptions(
      'renameTableQuery',
      this.dialect,
      RENAME_TABLE_QUERY_SUPPORTABLE_OPTIONS,
      EMPTY_SET,
      options,
    );

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
    options?: RemoveColumnQueryOptions,
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

  createSchemaQuery(schema: string, options?: CreateSchemaQueryOptions): string {
    rejectInvalidOptions(
      'createSchemaQuery',
      this.dialect,
      CREATE_SCHEMA_QUERY_SUPPORTABLE_OPTIONS,
      EMPTY_SET,
      options,
    );

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

  truncateTableQuery(tableName: TableOrModel, options?: TruncateTableQueryOptions): string {
    rejectInvalidOptions(
      'truncateTableQuery',
      this.dialect,
      TRUNCATE_TABLE_QUERY_SUPPORTABLE_OPTIONS,
      EMPTY_SET,
      options,
    );

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

  getForeignKeysQuery(tableName: TableOrModel, options: BindCatalogQueryOptions): BoundCatalogQuery;
  getForeignKeysQuery(tableName: TableOrModel, options?: ReplacementCatalogQueryOptions): string;
  getForeignKeysQuery(
    tableName: TableOrModel,
    options?: CatalogQueryOptions,
  ): string | BoundCatalogQuery;
  getForeignKeysQuery(
    tableName: TableOrModel,
    options?: CatalogQueryOptions,
  ): string | BoundCatalogQuery {
    return this.#catalogQuery(options, valueToSql => {
      // We don't call quoteTable as we don't want the schema in the table name, Oracle seperates it on another field
      const table = this.extractTableDetails(tableName);

      return [
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
        ` AND a.table_name = ${valueToSql(this.getCatalogName(table.tableName))}`,
        ` AND a.owner = ${this.#ownerToSql(table.schema, valueToSql)}`,
        ' ORDER BY a.table_name, a.column_name, b.column_name',
      ].join('');
    });
  }

  showConstraintsQuery(
    tableName: TableOrModel,
    options: ShowConstraintsQueryOptions & BindCatalogQueryOptions,
  ): BoundCatalogQuery;
  showConstraintsQuery(
    tableName: TableOrModel,
    options?: ShowConstraintsQueryOptions & ReplacementCatalogQueryOptions,
  ): string;
  showConstraintsQuery(
    tableName: TableOrModel,
    options?: ShowConstraintsQueryOptions & CatalogQueryOptions,
  ): string | BoundCatalogQuery;
  showConstraintsQuery(
    tableName: TableOrModel,
    options?: ShowConstraintsQueryOptions & CatalogQueryOptions,
  ): string | BoundCatalogQuery {
    if (options?.constraintType === 'FOREIGN KEY') {
      return this.getForeignKeysQuery(tableName, options);
    }

    return this.#catalogQuery(options, valueToSql => {
      const table = this.extractTableDetails(tableName);

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
        `WHERE C.TABLE_NAME =${valueToSql(this.getCatalogName(table.tableName))}`,
        `AND C.OWNER =${this.#ownerToSql(table.schema, valueToSql)}`,
        options?.constraintName
          ? `AND C.CONSTRAINT_NAME =${valueToSql(options.constraintName)}`
          : '',
        options?.constraintType
          ? `AND A.CONSTRAINT_TYPE =${valueToSql(this.getConstraintType(options.constraintType))}`
          : '',
        'ORDER BY C.CONSTRAINT_NAME, C.POSITION',
      ]);
    });
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

    // A primary key is already unique, and Oracle rejects both on the same column (ORA-02261)
    const isUnique =
      attribute.unique === true && !attribute.primaryKey && options?.context !== 'changeColumn';
    if (isUnique && attribute.type) {
      this.#internals.assertTypeCanBeUnique(attribute.field, attributeTypeToSql(attribute.type));
    }

    const uniqueTemplate = isUnique ? ' UNIQUE' : '';

    if (attribute.type instanceof DataTypes.ENUM) {
      // enums are a special case
      template = attribute.type.toSql();
      template += ` CHECK (${this.quoteIdentifier(attribute.field!)} IN(${attribute.type.options.values
        .map(value => {
          return this.escape(value);
        })
        .join(', ')}))`;
      template += uniqueTemplate;

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
      template += uniqueTemplate;

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

    template += uniqueTemplate;

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
