import pick from 'lodash/pick';
import { Op } from '../../operators.js';
import type { Expression } from '../../sequelize.js';
import { rejectInvalidOptions } from '../../utils/check';
import { joinSQLFragments } from '../../utils/join-sql-fragments';
import { buildJsonPath } from '../../utils/json.js';
import { generateIndexName } from '../../utils/string';
import { AbstractQueryGenerator } from '../abstract/query-generator';
import { REMOVE_INDEX_QUERY_SUPPORTABLE_OPTIONS } from '../abstract/query-generator-typescript';
import type {
  EscapeOptions,
  QueryGeneratorOptions,
  RemoveIndexQueryOptions,
  TableNameOrModel,
} from '../abstract/query-generator-typescript';
import type { NormalizedChangeColumnDefinition, ShowConstraintsQueryOptions } from '../abstract/query-generator.types.js';
import type { TableNameWithSchema } from '../abstract/query-interface.js';

const REMOVE_INDEX_QUERY_SUPPORTED_OPTIONS = new Set<keyof RemoveIndexQueryOptions>();

/**
 * When using changeColumnsQuery, these are the column properties that will use a 'CHANGE COLUMN' query in MySQL/MariaDB.
 * 'CHANGE COLUMN' requires specifying the whole column definition, otherwise it will reset the other properties to their default values.
 *
 * @internal
 */
export const PROPERTIES_NEEDING_CHANGE_COLUMN = ['type', 'allowNull', 'autoIncrement', 'comment'];

/**
 * Temporary class to ease the TypeScript migration
 */
export class MySqlQueryGeneratorTypeScript extends AbstractQueryGenerator {
  constructor(options: QueryGeneratorOptions) {
    super(options);

    this.whereSqlBuilder.setOperatorKeyword(Op.regexp, 'REGEXP');
    this.whereSqlBuilder.setOperatorKeyword(Op.notRegexp, 'NOT REGEXP');
  }

  _attributeToChangeColumn(
    tableName: TableNameWithSchema,
    columnName: string,
    columnDefinition: NormalizedChangeColumnDefinition,
  ) {
    const {
      type, allowNull, unique,
      autoIncrement, autoIncrementIdentity,
      defaultValue, dropDefaultValue,
      references, onUpdate, onDelete,
      comment,
    } = columnDefinition;

    if (autoIncrementIdentity !== undefined) {
      throw new Error(`${this.dialect.name} does not support autoIncrementIdentity`);
    }

    const sql = [];

    const fieldsForChangeColumn = Object.values(pick(columnDefinition, PROPERTIES_NEEDING_CHANGE_COLUMN));

    // TABLE t1 MODIFY b INT NOT NULL;
    if (fieldsForChangeColumn.some(val => val !== undefined)) {

      if (fieldsForChangeColumn.includes(undefined) || (defaultValue === undefined && dropDefaultValue !== true)) {
        throw new Error(`In ${this.dialect.name}, changeColumnsQuery uses CHANGE COLUMN, which requires specifying the complete column definition.
To prevent unintended changes to the properties of the column, we require that if one of the following properties is specified (set to a non-undefined value):
> type, allowNull, autoIncrement, comment
Then all of the following properties must be specified too (set to a non-undefined value):
> type, allowNull, autoIncrement, comment, defaultValue (or set dropDefaultValue to true)
Table: ${this.quoteTable(tableName)}
Column: ${this.quoteIdentifier(columnName)}`);
      }

      sql.push(`MODIFY ${this.quoteIdentifier(columnName)} ${this.attributeToSQL(columnDefinition, {
        context: 'changeColumn',
        tableName,
        columnName,
      })}`);
    } else {
      // if MODIFY COLUMN is used, we don't need to include these, as they will be changed by MODIFY COLUMN anyway

      if (defaultValue !== undefined) {
        sql.push(`ALTER COLUMN ${this.quoteIdentifier(columnName)} SET DEFAULT ${this.escape(columnDefinition.defaultValue)}`);
      }

      if (dropDefaultValue) {
        sql.push(`ALTER COLUMN ${this.quoteIdentifier(columnName)} DROP DEFAULT`);
      }
    }

    // only 'true' is accepted for unique in changeColumns, because they're single column uniques.
    // more complex uniques use addIndex and removing a unique uses removeIndex
    if (unique === true) {
      const uniqueName = generateIndexName(tableName.tableName, {
        fields: [columnName],
        unique: true,
      });

      sql.push(`ADD CONSTRAINT ${this.quoteIdentifier(uniqueName)} UNIQUE (${this.quoteIdentifier(columnName)})`);
    }

    if (references !== undefined) {
      const targetTable = this.extractTableDetails(references.model);

      let fkSql = `ADD FOREIGN KEY (${this.quoteIdentifier(columnName)}) REFERENCES ${this.quoteTable(targetTable)}(${this.quoteIdentifier(references.key)})`;

      if (onUpdate) {
        fkSql += ` ON UPDATE ${onUpdate}`;
      }

      if (onDelete) {
        fkSql += ` ON DELETE ${onDelete}`;
      }

      if (references.deferrable) {
        const deferrable = typeof references.deferrable === 'function'
          ? new references.deferrable()
          : references.deferrable;

        fkSql += ` ${deferrable.toSql()}`;
      }

      sql.push(fkSql);
    }

    return sql.join(', ');
  }

  describeTableQuery(tableName: TableNameOrModel) {
    return `SHOW FULL COLUMNS FROM ${this.quoteTable(tableName)};`;
  }

  showConstraintsQuery(tableName: TableNameOrModel, options?: ShowConstraintsQueryOptions) {
    const table = this.extractTableDetails(tableName);

    return joinSQLFragments([
      'SELECT c.CONSTRAINT_CATALOG AS constraintCatalog,',
      'c.CONSTRAINT_SCHEMA AS constraintSchema,',
      'c.CONSTRAINT_NAME AS constraintName,',
      'c.CONSTRAINT_TYPE AS constraintType,',
      'c.TABLE_SCHEMA AS tableSchema,',
      'c.TABLE_NAME AS tableName,',
      'kcu.COLUMN_NAME AS columnNames,',
      'kcu.REFERENCED_TABLE_NAME AS referencedTableName,',
      'kcu.REFERENCED_COLUMN_NAME AS referencedColumnNames,',
      'r.DELETE_RULE AS deleteAction,',
      'r.UPDATE_RULE AS updateAction',
      'FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS c',
      'LEFT JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS r ON c.CONSTRAINT_CATALOG = r.CONSTRAINT_CATALOG',
      'AND c.CONSTRAINT_SCHEMA = r.CONSTRAINT_SCHEMA AND c.CONSTRAINT_NAME = r.CONSTRAINT_NAME AND c.TABLE_NAME = r.TABLE_NAME',
      'LEFT JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu ON r.CONSTRAINT_CATALOG = kcu.CONSTRAINT_CATALOG',
      'AND r.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME AND r.TABLE_NAME = kcu.TABLE_NAME',
      `WHERE c.TABLE_NAME = ${this.escape(table.tableName)}`,
      `AND c.TABLE_SCHEMA = ${this.escape(table.schema)}`,
      options?.constraintName ? `AND c.CONSTRAINT_NAME = ${this.escape(options.constraintName)}` : '',
      'ORDER BY c.CONSTRAINT_NAME',
    ]);
  }

  showIndexesQuery(tableName: TableNameOrModel) {
    return `SHOW INDEX FROM ${this.quoteTable(tableName)}`;
  }

  getToggleForeignKeyChecksQuery(enable: boolean): string {
    return `SET FOREIGN_KEY_CHECKS=${enable ? '1' : '0'}`;
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

    return `DROP INDEX ${this.quoteIdentifier(indexName)} ON ${this.quoteTable(tableName)}`;
  }

  getForeignKeyQuery(tableName: TableNameOrModel, columnName?: string) {
    const table = this.extractTableDetails(tableName);

    return joinSQLFragments([
      'SELECT CONSTRAINT_NAME as constraintName,',
      'CONSTRAINT_SCHEMA as constraintSchema,',
      'TABLE_NAME as tableName,',
      'TABLE_SCHEMA as tableSchema,',
      'COLUMN_NAME as columnName,',
      'REFERENCED_TABLE_SCHEMA as referencedTableSchema,',
      'REFERENCED_TABLE_NAME as referencedTableName,',
      'REFERENCED_COLUMN_NAME as referencedColumnName',
      'FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE',
      'WHERE',
      `TABLE_NAME = ${this.escape(table.tableName)}`,
      `AND TABLE_SCHEMA = ${this.escape(table.schema!)}`,
      columnName && `AND COLUMN_NAME = ${this.escape(columnName)}`,
      'AND REFERENCED_TABLE_NAME IS NOT NULL',
    ]);
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
    return 'SELECT VERSION() as `version`';
  }
}
