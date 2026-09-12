import type {
  ConstraintType,
  DropSchemaQueryOptions,
  ListSchemasQueryOptions,
  ListTablesQueryOptions,
  RemoveIndexQueryOptions,
  RenameTableQueryOptions,
  ShowConstraintsQueryOptions,
  TableOrModel,
  TruncateTableQueryOptions,
} from '@sequelize/core';
import { AbstractQueryGenerator, DataTypes, Op } from '@sequelize/core';
import { attributeTypeToSql } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/data-types-utils.js';
import type {
  ENUM,
  NormalizedDataType,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/data-types.js';
import type { EscapeOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator-typescript.js';
import {
  DROP_SCHEMA_QUERY_SUPPORTABLE_OPTIONS,
  REMOVE_INDEX_QUERY_SUPPORTABLE_OPTIONS,
  RENAME_TABLE_QUERY_SUPPORTABLE_OPTIONS,
  TRUNCATE_TABLE_QUERY_SUPPORTABLE_OPTIONS,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator-typescript.js';
import type {
  AttributesToSqlColumns,
  AttributeToSqlColumn,
  AttributeToSqlInput,
  AttributeToSqlOptions,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator.internal-types.js';
import { rejectInvalidOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import { joinSQLFragments } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/join-sql-fragments.js';
import { EMPTY_SET } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/object.js';
import { defaultValueSchemable } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/query-builder-utils.js';
import { generateIndexName } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/string.js';
import isPlainObject from 'lodash/isPlainObject';
import { randomBytes } from 'node:crypto';
import type { Db2Dialect } from './dialect.js';
import { Db2QueryGeneratorInternal } from './query-generator.internal.js';

/**
 * Temporary class to ease the TypeScript migration
 */
export class Db2QueryGeneratorTypeScript extends AbstractQueryGenerator {
  readonly #internals: Db2QueryGeneratorInternal;

  constructor(
    dialect: Db2Dialect,
    internals: Db2QueryGeneratorInternal = new Db2QueryGeneratorInternal(dialect),
  ) {
    super(dialect, internals);

    internals.whereSqlBuilder.setOperatorKeyword(Op.regexp, 'REGEXP_LIKE');
    internals.whereSqlBuilder.setOperatorKeyword(Op.notRegexp, 'NOT REGEXP_LIKE');

    this.#internals = internals;
  }

  dropSchemaQuery(schemaName: string, options?: DropSchemaQueryOptions): string {
    if (options) {
      rejectInvalidOptions(
        'dropSchemaQuery',
        this.dialect,
        DROP_SCHEMA_QUERY_SUPPORTABLE_OPTIONS,
        EMPTY_SET,
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

  describeTableQuery(tableName: TableOrModel) {
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
        : `AND TABSCHEMA NOT LIKE 'SYS%' AND TABSCHEMA NOT IN (${this.#internals
            .getTechnicalSchemaNames()
            .map(schema => this.escape(schema))
            .join(', ')})`,
      'ORDER BY TABSCHEMA, TABNAME',
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

  showConstraintsQuery(tableName: TableOrModel, options?: ShowConstraintsQueryOptions) {
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
      'LEFT JOIN SYSCAT.KEYCOLUSE fk ON r.REFKEYNAME = fk.CONSTNAME AND r.REFTABNAME = fk.TABNAME AND r.REFTABSCHEMA = fk.TABSCHEMA',
      'LEFT JOIN SYSCAT.CHECKS ck ON c.CONSTNAME = ck.CONSTNAME AND c.TABNAME = ck.TABNAME AND c.TABSCHEMA = ck.TABSCHEMA',
      `WHERE c.TABNAME = ${this.escape(table.tableName)}`,
      `AND c.TABSCHEMA = ${this.escape(table.schema)}`,
      options?.columnName ? `AND k.COLNAME = ${this.escape(options.columnName)}` : '',
      options?.constraintName ? `AND c.CONSTNAME = ${this.escape(options.constraintName)}` : '',
      options?.constraintType
        ? `AND c.TYPE = ${this.escape(this.#getConstraintType(options.constraintType))}`
        : '',
      'ORDER BY c.CONSTNAME, k.COLSEQ, fk.COLSEQ',
    ]);
  }

  showIndexesQuery(tableName: TableOrModel) {
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
    tableName: TableOrModel,
    indexNameOrAttributes: string | string[],
    options?: RemoveIndexQueryOptions,
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
    return 'select service_level as "version" from TABLE (sysproc.env_get_inst_info()) as A';
  }

  tableExistsQuery(tableName: TableOrModel): string {
    const table = this.extractTableDetails(tableName);

    return `SELECT TABNAME FROM SYSCAT.TABLES WHERE TABNAME = ${this.escape(table.tableName)} AND TABSCHEMA = ${this.escape(table.schema)}`;
  }

  createSavepointQuery(savepointName: string): string {
    return `SAVEPOINT ${this.quoteIdentifier(savepointName)} ON ROLLBACK RETAIN CURSORS`;
  }

  generateTransactionId(): string {
    return randomBytes(10).toString('hex');
  }

  getRandomFloatFunctionCall(): string {
    return 'RAND()';
  }

  attributeToSql(column: AttributeToSqlInput, options?: AttributeToSqlOptions): string {
    const attribute: AttributeToSqlColumn = isPlainObject(column)
      ? (column as AttributeToSqlColumn)
      : { type: column as NormalizedDataType };

    let template: string;

    if (attribute.type instanceof DataTypes.ENUM) {
      // enums are a special case
      const enumType = attribute.type as ENUM<string>;

      template = enumType.toSql();
      template += ` CHECK (${this.quoteIdentifier(attribute.field!)} IN(${enumType.options.values
        .map(value => {
          return this.escape(value);
        })
        .join(', ')}))`;
    } else {
      template = attributeTypeToSql(attribute.type);
    }

    if (options && options.context === 'changeColumn' && attribute.type) {
      template = `DATA TYPE ${template}`;
    } else if (attribute.allowNull === false || attribute.primaryKey === true) {
      template += ' NOT NULL';
    }

    if (attribute.autoIncrement) {
      let initialValue: number | string = 1;
      if (attribute.initialAutoIncrement) {
        initialValue = attribute.initialAutoIncrement;
      }

      template += ` GENERATED BY DEFAULT AS IDENTITY(START WITH ${initialValue}, INCREMENT BY 1)`;
    }

    if (defaultValueSchemable(attribute.defaultValue, this.dialect)) {
      // `replacements` is not part of AttributeToSqlOptions, but the JS version read it
      template += ` DEFAULT ${this.escape(attribute.defaultValue, { replacements: (options as EscapeOptions | undefined)?.replacements, type: attribute.type })}`;
    }

    if (
      attribute.unique === true &&
      (options?.context !== 'changeColumn' || this.dialect.supports.alterColumn.unique)
    ) {
      template += ' UNIQUE';
    }

    if (attribute.primaryKey) {
      template += ' PRIMARY KEY';
    }

    if (!options?.withoutForeignKeyConstraints && attribute.references) {
      if (options?.context === 'addColumn' && options.tableOrModel && attribute.field) {
        const fkName = this.quoteIdentifier(
          `${this.extractTableDetails(options.tableOrModel).tableName}_${attribute.field}_fidx`,
        );

        template += ` ADD CONSTRAINT ${fkName} FOREIGN KEY (${this.quoteIdentifier(attribute.field)})`;
      }

      template += ` REFERENCES ${this.quoteTable(attribute.references.table)}`;

      if (attribute.references.key) {
        template += ` (${this.quoteIdentifier(attribute.references.key)})`;
      } else {
        template += ` (${this.quoteIdentifier('id')})`;
      }

      if (attribute.onDelete) {
        template += ` ON DELETE ${attribute.onDelete.toUpperCase()}`;
      }

      if (attribute.onUpdate && attribute.onUpdate.toUpperCase() !== 'CASCADE') {
        // Db2 do not support CASCADE option for ON UPDATE clause.
        template += ` ON UPDATE ${attribute.onUpdate.toUpperCase()}`;
      }
    }

    if (attribute.comment && typeof attribute.comment === 'string') {
      template += ` COMMENT ${attribute.comment}`;
    }

    return template;
  }

  attributesToSql(
    columns: AttributesToSqlColumns,
    options?: AttributeToSqlOptions,
  ): Record<string, string> {
    const result: Record<string, string> = Object.create(null);
    const existingConstraints: string[] = [];

    for (const key of Object.keys(columns)) {
      const rawColumn = columns[key];
      const attribute: AttributeToSqlColumn = isPlainObject(rawColumn)
        ? { ...(rawColumn as AttributeToSqlColumn) }
        : { type: rawColumn as NormalizedDataType };
      const columnName = attribute.field || attribute.columnName || key;

      attribute.field = columnName;

      if (attribute.references) {
        if (existingConstraints.includes(this.quoteTable(attribute.references.table))) {
          // db2 rejects more than one cascading constraint to the same table
          attribute.onDelete = '';
          attribute.onUpdate = '';
        } else if (attribute.unique === true) {
          attribute.onDelete = '';
          attribute.onUpdate = '';
        } else {
          existingConstraints.push(this.quoteTable(attribute.references.table));
        }
      }

      result[columnName] = this.attributeToSql(attribute, options);
    }

    return result;
  }
}
