import NodeUtil from 'node:util';
import isObject from 'lodash/isObject';
import type { Class } from 'type-fest';
import { ConstraintChecking, Deferrable } from '../../deferrable.js';
import { AssociationPath } from '../../expression-builders/association-path.js';
import { Attribute } from '../../expression-builders/attribute.js';
import { BaseSqlExpression } from '../../expression-builders/base-sql-expression.js';
import { Cast } from '../../expression-builders/cast.js';
import { Col } from '../../expression-builders/col.js';
import { DialectAwareFn } from '../../expression-builders/dialect-aware-fn.js';
import { Fn } from '../../expression-builders/fn.js';
import { Identifier } from '../../expression-builders/identifier.js';
import { JsonPath } from '../../expression-builders/json-path.js';
import { List } from '../../expression-builders/list.js';
import { Literal } from '../../expression-builders/literal.js';
import { Value } from '../../expression-builders/value.js';
import { Where } from '../../expression-builders/where.js';
import { IndexHints } from '../../index-hints.js';
import type { Attributes, Model, ModelStatic } from '../../model.js';
import { Op } from '../../operators.js';
import type { BindOrReplacements, Expression, Sequelize } from '../../sequelize.js';
import { bestGuessDataTypeOfVal } from '../../sql-string.js';
import { TableHints } from '../../table-hints.js';
import { isDictionary, isNullish, isPlainObject, isString, rejectInvalidOptions } from '../../utils/check.js';
import { noOpCol } from '../../utils/deprecations.js';
import { quoteIdentifier } from '../../utils/dialect.js';
import { joinSQLFragments } from '../../utils/join-sql-fragments.js';
import { isModelStatic } from '../../utils/model-utils.js';
import { EMPTY_OBJECT } from '../../utils/object.js';
import { injectReplacements } from '../../utils/sql.js';
import { attributeTypeToSql, validateDataType } from './data-types-utils.js';
import { AbstractDataType } from './data-types.js';
import type { BindParamOptions, DataType } from './data-types.js';
import type { AbstractQueryGenerator } from './query-generator.js';
import type {
  AddConstraintQueryOptions,
  DropTableQueryOptions,
  GetConstraintSnippetQueryOptions,
  ListSchemasQueryOptions,
  ListTablesQueryOptions,
  QuoteTableOptions,
  RemoveColumnQueryOptions,
  RemoveConstraintQueryOptions,
  ShowConstraintsQueryOptions,
} from './query-generator.types.js';
import type { TableName, TableNameWithSchema } from './query-interface.js';
import type { WhereOptions } from './where-sql-builder-types.js';
import { PojoWhere, WhereSqlBuilder, wrapAmbiguousWhere } from './where-sql-builder.js';
import type { AbstractDialect } from './index.js';

export type TableNameOrModel = TableName | ModelStatic;

// keep REMOVE_INDEX_QUERY_SUPPORTABLE_OPTIONS updated when modifying this
export interface RemoveIndexQueryOptions {
  concurrently?: boolean;
  ifExists?: boolean;
  cascade?: boolean;
}

export const DROP_TABLE_QUERY_SUPPORTABLE_OPTIONS = new Set<keyof DropTableQueryOptions>(['cascade']);
export const LIST_TABLES_QUERY_SUPPORTABLE_OPTIONS = new Set<keyof ListTablesQueryOptions>(['schema']);
export const QUOTE_TABLE_SUPPORTABLE_OPTIONS = new Set<keyof QuoteTableOptions>(['indexHints', 'tableHints']);
export const REMOVE_COLUMN_QUERY_SUPPORTABLE_OPTIONS = new Set<keyof RemoveColumnQueryOptions>(['ifExists', 'cascade']);
export const REMOVE_CONSTRAINT_QUERY_SUPPORTABLE_OPTIONS = new Set<keyof RemoveConstraintQueryOptions>(['ifExists', 'cascade']);
export const REMOVE_INDEX_QUERY_SUPPORTABLE_OPTIONS = new Set<keyof RemoveIndexQueryOptions>(['concurrently', 'ifExists', 'cascade']);
export const SHOW_CONSTRAINTS_QUERY_SUPPORTABLE_OPTIONS = new Set<keyof ShowConstraintsQueryOptions>(['columnName', 'constraintName', 'constraintType']);

export interface QueryGeneratorOptions {
  sequelize: Sequelize;
  dialect: AbstractDialect;
}

/**
 * Options accepted by {@link AbstractQueryGeneratorTypeScript#escape}
 */
export interface EscapeOptions extends FormatWhereOptions {
  readonly type?: DataType | undefined;
}

export interface FormatWhereOptions extends Bindable {
  /**
   * These are used to inline replacements into the query, when one is found inside of a {@link Literal}.
   */
  readonly replacements?: BindOrReplacements | undefined;

  /**
   * The model of the main alias. Used to determine the type & column name of attributes referenced in the where clause.
   */
  readonly model?: ModelStatic | undefined;

  /**
   * The alias of the main table corresponding to {@link FormatWhereOptions.model}.
   * Used as the prefix for attributes that do not reference an association, e.g.
   *
   * ```ts
   * const where = { name: 'foo' };
   * ```
   *
   * will produce
   *
   * ```sql
   * WHERE "<mainAlias>"."name" = 'foo'
   * ```
   */
  readonly mainAlias?: string | undefined;
}

/**
 * Methods that support this option are functions that add values to the query.
 * If {@link Bindable.bindParam} is specified, the value will be added to the query as a bind parameter.
 * If it is not specified, the value will be added to the query as a literal.
 */
export interface Bindable {
  bindParam?: ((value: unknown) => string) | undefined;
}

// DO NOT MAKE THIS CLASS PUBLIC!
/**
 * This is a temporary class used to progressively migrate the AbstractQueryGenerator class to TypeScript by slowly moving its functions here.
 * Always use {@link AbstractQueryGenerator} instead.
 */
export class AbstractQueryGeneratorTypeScript {

  protected readonly whereSqlBuilder: WhereSqlBuilder;
  readonly dialect: AbstractDialect;
  protected readonly sequelize: Sequelize;

  constructor(options: QueryGeneratorOptions) {
    if (!options.sequelize) {
      throw new Error('QueryGenerator initialized without options.sequelize');
    }

    if (!options.dialect) {
      throw new Error('QueryGenerator initialized without options.dialect');
    }

    this.sequelize = options.sequelize;
    this.dialect = options.dialect;
    // TODO: remove casting once all AbstractQueryGenerator functions are moved here
    this.whereSqlBuilder = new WhereSqlBuilder(this as unknown as AbstractQueryGenerator);
  }

  protected get options() {
    return this.sequelize.options;
  }

  protected _getTechnicalSchemaNames(): string[] {
    return [];
  }

  listSchemasQuery(_options?: ListSchemasQueryOptions): string {
    if (this.dialect.supports.schemas) {
      throw new Error(`${this.dialect.name} declares supporting schema but listSchemasQuery is not implemented.`);
    }

    throw new Error(`Schemas are not supported in ${this.dialect.name}.`);
  }

  describeTableQuery(tableName: TableNameOrModel) {
    return `DESCRIBE ${this.quoteTable(tableName)};`;
  }

  dropTableQuery(tableName: TableNameOrModel, options?: DropTableQueryOptions): string {
    const DROP_TABLE_QUERY_SUPPORTED_OPTIONS = new Set<keyof DropTableQueryOptions>();

    if (this.dialect.supports.dropTable.cascade) {
      DROP_TABLE_QUERY_SUPPORTED_OPTIONS.add('cascade');
    }

    if (options) {
      rejectInvalidOptions(
        'dropTableQuery',
        this.dialect.name,
        DROP_TABLE_QUERY_SUPPORTABLE_OPTIONS,
        DROP_TABLE_QUERY_SUPPORTED_OPTIONS,
        options,
      );
    }

    return joinSQLFragments([
      'DROP TABLE IF EXISTS',
      this.quoteTable(tableName),
      options?.cascade ? 'CASCADE' : '',
    ]);
  }

  listTablesQuery(_options?: ListTablesQueryOptions): string {
    throw new Error(`listTablesQuery has not been implemented in ${this.dialect.name}.`);
  }

  removeColumnQuery(tableName: TableNameOrModel, attributeName: string, options?: RemoveColumnQueryOptions): string {
    const REMOVE_COLUMN_QUERY_SUPPORTED_OPTIONS = new Set<keyof RemoveColumnQueryOptions>();

    if (this.dialect.supports.removeColumn.cascade) {
      REMOVE_COLUMN_QUERY_SUPPORTED_OPTIONS.add('cascade');
    }

    if (this.dialect.supports.removeColumn.ifExists) {
      REMOVE_COLUMN_QUERY_SUPPORTED_OPTIONS.add('ifExists');
    }

    if (options) {
      rejectInvalidOptions(
        'removeColumnQuery',
        this.dialect.name,
        REMOVE_COLUMN_QUERY_SUPPORTABLE_OPTIONS,
        REMOVE_COLUMN_QUERY_SUPPORTED_OPTIONS,
        options,
      );
    }

    return joinSQLFragments([
      'ALTER TABLE',
      this.quoteTable(tableName),
      'DROP COLUMN',
      options?.ifExists ? 'IF EXISTS' : '',
      this.quoteIdentifier(attributeName),
      options?.cascade ? 'CASCADE' : '',
    ]);
  }

  addConstraintQuery(tableName: TableNameOrModel, options: AddConstraintQueryOptions): string {
    if (!this.dialect.supports.constraints.add) {
      throw new Error(`Add constraint queries are not supported by ${this.dialect.name} dialect`);
    }

    return joinSQLFragments([
      'ALTER TABLE',
      this.quoteTable(tableName),
      'ADD',
      this._getConstraintSnippet(tableName, options),
    ]);
  }

  _getConstraintSnippet(tableName: TableNameOrModel, options: GetConstraintSnippetQueryOptions) {
    const quotedFields = options.fields.map(field => {
      if (typeof field === 'string') {
        return this.quoteIdentifier(field);
      }

      if (field instanceof BaseSqlExpression) {
        return this.formatSqlExpression(field);
      }

      if (field.attribute) {
        throw new Error('The field.attribute property has been removed. Use the field.name property instead');
      }

      if (!field.name) {
        throw new Error(`The following index field has no name: ${field}`);
      }

      return this.quoteIdentifier(field.name);
    });

    const constraintNameParts = options.name ? null : options.fields.map(field => {
      if (typeof field === 'string') {
        return field;
      }

      if (field instanceof BaseSqlExpression) {
        throw new TypeError(`The constraint name must be provided explicitly if one of Sequelize's method (literal(), col(), etc…) is used in the constraint's fields`);
      }

      return field.name;
    });

    let constraintSnippet;
    const table = this.extractTableDetails(tableName);
    const fieldsSqlQuotedString = quotedFields.join(', ');
    const fieldsSqlString = constraintNameParts?.join('_');

    switch (options.type.toUpperCase()) {
      case 'CHECK': {
        if (!this.dialect.supports.constraints.check) {
          throw new Error(`Check constraints are not supported by ${this.dialect.name} dialect`);
        }

        const constraintName = this.quoteIdentifier(options.name || `${table.tableName}_${fieldsSqlString}_ck`);
        constraintSnippet = `CONSTRAINT ${constraintName} CHECK (${this.whereItemsQuery(options.where)})`;
        break;
      }

      case 'UNIQUE': {
        if (!this.dialect.supports.constraints.unique) {
          throw new Error(`Unique constraints are not supported by ${this.dialect.name} dialect`);
        }

        const constraintName = this.quoteIdentifier(options.name || `${table.tableName}_${fieldsSqlString}_uk`);
        constraintSnippet = `CONSTRAINT ${constraintName} UNIQUE (${fieldsSqlQuotedString})`;
        if (options.deferrable) {
          constraintSnippet += ` ${this._getDeferrableConstraintSnippet(options.deferrable)}`;
        }

        break;
      }

      case 'DEFAULT': {
        if (!this.dialect.supports.constraints.default) {
          throw new Error(`Default constraints are not supported by ${this.dialect.name} dialect`);
        }

        if (options.defaultValue === undefined) {
          throw new Error('Default value must be specified for DEFAULT CONSTRAINT');
        }

        const constraintName = this.quoteIdentifier(options.name || `${table.tableName}_${fieldsSqlString}_df`);
        constraintSnippet = `CONSTRAINT ${constraintName} DEFAULT (${this.escape(options.defaultValue, options)}) FOR ${quotedFields[0]}`;
        break;
      }

      case 'PRIMARY KEY': {
        if (!this.dialect.supports.constraints.primaryKey) {
          throw new Error(`Primary key constraints are not supported by ${this.dialect.name} dialect`);
        }

        const constraintName = this.quoteIdentifier(options.name || `${table.tableName}_${fieldsSqlString}_pk`);
        constraintSnippet = `CONSTRAINT ${constraintName} PRIMARY KEY (${fieldsSqlQuotedString})`;
        if (options.deferrable) {
          constraintSnippet += ` ${this._getDeferrableConstraintSnippet(options.deferrable)}`;
        }

        break;
      }

      case 'FOREIGN KEY': {
        if (!this.dialect.supports.constraints.foreignKey) {
          throw new Error(`Foreign key constraints are not supported by ${this.dialect.name} dialect`);
        }

        const references = options.references;
        if (!references || !references.table || !(references.field || references.fields)) {
          throw new Error('Invalid foreign key constraint options. `references` object with `table` and `field` must be specified');
        }

        const referencedTable = this.extractTableDetails(references.table);
        const constraintName = this.quoteIdentifier(options.name || `${table.tableName}_${fieldsSqlString}_${referencedTable.tableName}_fk`);
        const quotedReferences
          = references.field !== undefined
          ? this.quoteIdentifier(references.field)
          : references.fields!.map(f => this.quoteIdentifier(f)).join(', ');
        const referencesSnippet = `${this.quoteTable(referencedTable)} (${quotedReferences})`;
        constraintSnippet = `CONSTRAINT ${constraintName} `;
        constraintSnippet += `FOREIGN KEY (${fieldsSqlQuotedString}) REFERENCES ${referencesSnippet}`;
        if (options.onUpdate) {
          if (!this.dialect.supports.constraints.onUpdate) {
            throw new Error(`Foreign key constraint with onUpdate is not supported by ${this.dialect.name} dialect`);
          }

          constraintSnippet += ` ON UPDATE ${options.onUpdate.toUpperCase()}`;
        }

        if (options.onDelete) {
          constraintSnippet += ` ON DELETE ${options.onDelete.toUpperCase()}`;
        }

        if (options.deferrable) {
          constraintSnippet += ` ${this._getDeferrableConstraintSnippet(options.deferrable)}`;
        }

        break;
      }

      default: {
        throw new Error(`Constraint type ${options.type} is not supported by ${this.dialect.name} dialect`);
      }
    }

    return constraintSnippet;
  }

  protected _getDeferrableConstraintSnippet(deferrable: Deferrable) {
    if (!this.dialect.supports.constraints.deferrable) {
      throw new Error(`Deferrable constraints are not supported by ${this.dialect.name} dialect`);
    }

    switch (deferrable) {
      case Deferrable.INITIALLY_DEFERRED: {
        return 'DEFERRABLE INITIALLY DEFERRED';
      }

      case Deferrable.INITIALLY_IMMEDIATE: {
        return 'DEFERRABLE INITIALLY IMMEDIATE';
      }

      case Deferrable.NOT: {
        return 'NOT DEFERRABLE';
      }

      default: {
        throw new Error(`Unknown constraint checking behavior ${deferrable}`);
      }
    }
  }

  removeConstraintQuery(tableName: TableNameOrModel, constraintName: string, options?: RemoveConstraintQueryOptions) {
    if (!this.dialect.supports.constraints.remove) {
      throw new Error(`Remove constraint queries are not supported by ${this.dialect.name} dialect`);
    }

    if (options) {
      const REMOVE_CONSTRAINT_QUERY_SUPPORTED_OPTIONS = new Set<keyof RemoveConstraintQueryOptions>();
      const { removeOptions } = this.dialect.supports.constraints;
      if (removeOptions.cascade) {
        REMOVE_CONSTRAINT_QUERY_SUPPORTED_OPTIONS.add('cascade');
      }

      if (removeOptions.ifExists) {
        REMOVE_CONSTRAINT_QUERY_SUPPORTED_OPTIONS.add('ifExists');
      }

      rejectInvalidOptions(
        'removeConstraintQuery',
        this.dialect.name,
        REMOVE_CONSTRAINT_QUERY_SUPPORTABLE_OPTIONS,
        REMOVE_CONSTRAINT_QUERY_SUPPORTED_OPTIONS,
        options,
      );
    }

    return joinSQLFragments([
      'ALTER TABLE',
      this.quoteTable(tableName),
      'DROP CONSTRAINT',
      options?.ifExists ? 'IF EXISTS' : '',
      this.quoteIdentifier(constraintName),
      options?.cascade ? 'CASCADE' : '',
    ]);
  }

  setConstraintCheckingQuery(type: ConstraintChecking): string;
  setConstraintCheckingQuery(type: Class<ConstraintChecking>, constraints?: readonly string[]): string;
  setConstraintCheckingQuery(type: ConstraintChecking | Class<ConstraintChecking>, constraints?: readonly string[]) {
    if (!this.dialect.supports.constraints.deferrable) {
      throw new Error(`Deferrable constraints are not supported by ${this.dialect.name} dialect`);
    }

    let constraintFragment = 'ALL';
    if (type instanceof ConstraintChecking) {
      if (type.constraints?.length) {
        constraintFragment = type.constraints.map(constraint => this.quoteIdentifier(constraint)).join(', ');
      }

      return `SET CONSTRAINTS ${constraintFragment} ${type.toString()}`;
    }

    if (constraints?.length) {
      constraintFragment = constraints.map(constraint => this.quoteIdentifier(constraint)).join(', ');
    }

    return `SET CONSTRAINTS ${constraintFragment} ${type.toString()}`;
  }

  showConstraintsQuery(_tableName: TableNameOrModel, _options?: ShowConstraintsQueryOptions): string {
    throw new Error(`showConstraintsQuery has not been implemented in ${this.dialect.name}.`);
  }

  showIndexesQuery(_tableName: TableNameOrModel): string {
    throw new Error(`showIndexesQuery has not been implemented in ${this.dialect.name}.`);
  }

  removeIndexQuery(
    _tableName: TableNameOrModel,
    _indexNameOrAttributes: string | string [],
    _options?: RemoveIndexQueryOptions,
  ): string {
    throw new Error(`removeIndexQuery has not been implemented in ${this.dialect.name}.`);
  }

  /**
   * Generates an SQL query that returns all foreign keys of a table or the foreign key constraint of a given column.
   *
   * @deprecated Use {@link showConstraintsQuery} instead.
   * @param _tableName The table or associated model.
   * @param _columnName The name of the column. Not supported by SQLite.
   * @returns The generated SQL query.
   */
  getForeignKeyQuery(_tableName: TableNameOrModel, _columnName?: string): Error {
    throw new Error(`getForeignKeyQuery has been deprecated. Use showConstraintsQuery instead.`);
  }

  /**
   * Generates an SQL query that drops a foreign key constraint.
   *
   * @deprecated Use {@link removeConstraintQuery} instead.
   * @param _tableName The table or associated model.
   * @param _foreignKey The name of the foreign key constraint.
   */
  dropForeignKeyQuery(_tableName: TableNameOrModel, _foreignKey: string): Error {
    throw new Error(`dropForeignKeyQuery has been deprecated. Use removeConstraintQuery instead.`);
  }

  // TODO: rename to "normalizeTable" & move to sequelize class
  extractTableDetails(
    tableNameOrModel: TableNameOrModel,
    options?: { schema?: string, delimiter?: string },
  ): TableNameWithSchema {
    const tableNameObject = isModelStatic(tableNameOrModel) ? tableNameOrModel.getTableName()
      : isString(tableNameOrModel) ? { tableName: tableNameOrModel }
      : tableNameOrModel;

    if (!isPlainObject(tableNameObject)) {
      throw new Error(`Invalid input received, got ${NodeUtil.inspect(tableNameOrModel)}, expected a Model Class, a TableNameWithSchema object, or a table name string`);
    }

    // @ts-expect-error -- TODO: this is added by getTableName on model, and must be removed
    delete tableNameObject.toString;

    return {
      ...tableNameObject,
      schema: options?.schema || tableNameObject.schema || this.options.schema || this.dialect.getDefaultSchema(),
      delimiter: options?.delimiter || tableNameObject.delimiter || '.',
    };
  }

  /**
   * Quote table name with optional alias and schema attribution
   *
   * @param param table string or object
   * @param options options
   */
  quoteTable(param: TableNameOrModel, options?: QuoteTableOptions): string {
    const QUOTE_TABLE_SUPPORTED_OPTIONS = new Set<keyof QuoteTableOptions>();
    if (this.dialect.supports.indexHints) {
      QUOTE_TABLE_SUPPORTED_OPTIONS.add('indexHints');
    }

    if (this.dialect.supports.tableHints) {
      QUOTE_TABLE_SUPPORTED_OPTIONS.add('tableHints');
    }

    rejectInvalidOptions('quoteTable', this.dialect.name, QUOTE_TABLE_SUPPORTABLE_OPTIONS, QUOTE_TABLE_SUPPORTED_OPTIONS, { ...options });

    if (isModelStatic(param)) {
      param = param.getTableName();
    }

    const tableName = this.extractTableDetails(param);

    if (isObject(param) && ('as' in param || 'name' in param)) {
      throw new Error('parameters "as" and "name" are not allowed in the first parameter of quoteTable, pass them as the second parameter.');
    }

    let sql = '';

    if (this.dialect.supports.schemas) {
      // Some users sync the same set of tables in different schemas for various reasons
      // They then set `searchPath` when running a query to use different schemas.
      // See https://github.com/sequelize/sequelize/pull/15274#discussion_r1020770364
      // For this reason, we treat the default schema as equivalent to "no schema specified"
      if (tableName.schema && tableName.schema !== this.dialect.getDefaultSchema()) {
        sql += `${this.quoteIdentifier(tableName.schema)}.`;
      }

      sql += this.quoteIdentifier(tableName.tableName);
    } else {
      const fakeSchemaPrefix = (tableName.schema && tableName.schema !== this.dialect.getDefaultSchema())
        ? tableName.schema + (tableName.delimiter || '.')
        : '';

      sql += this.quoteIdentifier(fakeSchemaPrefix + tableName.tableName);
    }

    if (options?.alias) {
      sql += ` AS ${this.quoteIdentifier(options.alias === true ? tableName.tableName : options.alias)}`;
    }

    if (options?.indexHints) {
      for (const hint of options.indexHints) {
        if (IndexHints[hint.type]) {
          sql += ` ${IndexHints[hint.type]} INDEX (${hint.values.map(indexName => this.quoteIdentifier(indexName)).join(',')})`;
        } else {
          throw new Error(`The index hint type "${hint.type}" is invalid or not supported by dialect "${this.dialect.name}".`);
        }
      }
    }

    if (options?.tableHints) {
      const hints: TableHints[] = [];
      for (const hint of options.tableHints) {
        if (TableHints[hint]) {
          hints.push(TableHints[hint]);
        } else {
          throw new Error(`The table hint "${hint}" is invalid or not supported by dialect "${this.dialect.name}".`);
        }
      }

      if (hints.length) {
        sql += ` WITH (${hints.join(', ')})`;
      }
    }

    return sql;
  }

  /**
   * Adds quotes to identifier
   *
   * @param identifier
   * @param _force
   */
  // TODO: memoize last result
  quoteIdentifier(identifier: string, _force?: boolean) {
    return quoteIdentifier(identifier, this.dialect.TICK_CHAR_LEFT, this.dialect.TICK_CHAR_RIGHT);
  }

  isSameTable(tableA: TableNameOrModel, tableB: TableNameOrModel) {
    if (tableA === tableB) {
      return true;
    }

    tableA = this.extractTableDetails(tableA);
    tableB = this.extractTableDetails(tableB);

    return tableA.tableName === tableB.tableName && tableA.schema === tableB.schema;
  }

  whereQuery<M extends Model>(where: WhereOptions<Attributes<M>>, options?: FormatWhereOptions) {
    const query = this.whereItemsQuery(where, options);
    if (query && query.length > 0) {
      return `WHERE ${query}`;
    }

    return '';
  }

  whereItemsQuery<M extends Model>(where: WhereOptions<Attributes<M>> | undefined, options?: FormatWhereOptions) {
    return this.whereSqlBuilder.formatWhereOptions(where, options);
  }

  formatSqlExpression(piece: BaseSqlExpression, options?: EscapeOptions): string {
    if (piece instanceof Literal) {
      return this.formatLiteral(piece, options);
    }

    if (piece instanceof Fn) {
      return this.formatFn(piece, options);
    }

    if (piece instanceof List) {
      return this.escapeList(piece.values, options);
    }

    if (piece instanceof Value) {
      return this.escape(piece.value, options);
    }

    if (piece instanceof Identifier) {
      return this.quoteIdentifier(piece.value);
    }

    if (piece instanceof Cast) {
      return this.formatCast(piece, options);
    }

    if (piece instanceof Col) {
      return this.formatCol(piece, options);
    }

    if (piece instanceof Attribute) {
      return this.formatAttribute(piece, options);
    }

    if (piece instanceof Where) {
      if (piece.where instanceof PojoWhere) {
        return this.whereSqlBuilder.formatPojoWhere(piece.where, options);
      }

      return this.whereSqlBuilder.formatWhereOptions(piece.where, options);
    }

    if (piece instanceof JsonPath) {
      return this.formatJsonPath(piece, options);
    }

    if (piece instanceof AssociationPath) {
      return this.formatAssociationPath(piece);
    }

    if (piece instanceof DialectAwareFn) {
      return this.formatDialectAwareFn(piece, options);
    }

    throw new Error(`Unknown sequelize method ${piece.constructor.name}`);
  }

  protected formatAssociationPath(associationPath: AssociationPath): string {
    return `${this.quoteIdentifier(associationPath.associationPath.join('->'))}.${this.quoteIdentifier(associationPath.attributeName)}`;
  }

  protected formatJsonPath(jsonPathVal: JsonPath, options?: EscapeOptions): string {
    const value = this.escape(jsonPathVal.expression, options);

    if (jsonPathVal.path.length === 0) {
      return value;
    }

    return this.jsonPathExtractionQuery(value, jsonPathVal.path, false);
  }

  /**
   * The goal of this method is to execute the equivalent of json_unquote for the current dialect.
   *
   * @param _arg
   * @param _options
   */
  formatUnquoteJson(_arg: Expression, _options: EscapeOptions | undefined): string {
    if (!this.dialect.supports.jsonOperations) {
      throw new Error(`Unquoting JSON is not supported by ${this.dialect.name} dialect.`);
    }

    throw new Error(`formatUnquoteJson has not been implemented in ${this.dialect.name}.`);
  }

  /**
   * @param _sqlExpression ⚠️ This is not an identifier, it's a raw SQL expression. It will be inlined in the query.
   * @param _path The JSON path, where each item is one level of the path
   * @param _unquote Whether the result should be unquoted (depending on dialect: ->> and #>> operators, json_unquote function). Defaults to `false`.
   */
  jsonPathExtractionQuery(_sqlExpression: string, _path: ReadonlyArray<number | string>, _unquote: boolean): string {
    if (!this.dialect.supports.jsonOperations) {
      throw new Error(`JSON Paths are not supported in ${this.dialect.name}.`);
    }

    throw new Error(`jsonPathExtractionQuery has not been implemented in ${this.dialect.name}.`);
  }

  protected formatLiteral(piece: Literal, options?: EscapeOptions): string {
    const sql = piece.val.map(part => {
      if (part instanceof BaseSqlExpression) {
        return this.formatSqlExpression(part, options);
      }

      return part;
    }).join('');

    if (options?.replacements) {
      return injectReplacements(sql, this.dialect, options.replacements, {
        onPositionalReplacement: () => {
          throw new TypeError(`The following literal includes positional replacements (?).
Only named replacements (:name) are allowed in literal() because we cannot guarantee the order in which they will be evaluated:
➜ literal(${JSON.stringify(sql)})`);
        },
      });
    }

    return sql;
  }

  protected formatAttribute(piece: Attribute, options?: EscapeOptions): string {
    const model = options?.model;

    // This handles special attribute syntaxes like $association.references$, json.paths, and attribute::casting
    const columnName = model?.modelDefinition.getColumnNameLoose(piece.attributeName)
      ?? piece.attributeName;

    if (options?.mainAlias) {
      return `${this.quoteIdentifier(options.mainAlias)}.${this.quoteIdentifier(columnName)}`;
    }

    return this.quoteIdentifier(columnName);
  }

  protected formatFn(piece: Fn, options?: EscapeOptions): string {
    // arguments of a function can be anything, it's not necessarily the type of the attribute,
    // so we need to remove the type from their escape options
    const argEscapeOptions = piece.args.length > 0 && options?.type ? { ...options, type: undefined } : options;
    const args = piece.args.map(arg => {
      return this.escape(arg, argEscapeOptions);
    }).join(', ');

    return `${piece.fn}(${args})`;
  }

  protected formatDialectAwareFn(piece: DialectAwareFn, options?: EscapeOptions): string {
    // arguments of a function can be anything, it's not necessarily the type of the attribute,
    // so we need to remove the type from their escape options
    const argEscapeOptions = piece.args.length > 0 && options?.type ? { ...options, type: undefined } : options;

    return piece.apply(this.dialect, argEscapeOptions);
  }

  protected formatCast(cast: Cast, options?: EscapeOptions) {
    const type = this.sequelize.normalizeDataType(cast.type);

    const castSql = wrapAmbiguousWhere(cast.expression, this.escape(cast.expression, { ...options, type }));
    const targetSql = attributeTypeToSql(type).toUpperCase();

    // TODO: if we're casting to the same SQL DataType, we could skip the SQL cast (but keep the JS cast)
    //  This is useful because sometimes you want to cast the Sequelize DataType to another Sequelize DataType,
    //  but they are both the same SQL type, so a SQL cast would be redundant.

    return `CAST(${castSql} AS ${targetSql})`;
  }

  protected formatCol(piece: Col, options?: EscapeOptions) {
    // TODO: can this be removed?
    if (piece.identifiers.length === 1 && piece.identifiers[0].startsWith('*')) {
      return '*';
    }

    // Weird legacy behavior
    const identifiers = piece.identifiers.length === 1 ? piece.identifiers[0] : piece.identifiers;

    // TODO: use quoteIdentifiers?
    // @ts-expect-error -- quote is declared on child class
    return this.quote(identifiers, options?.model, undefined, options);
  }

  /**
   * Escapes a value (e.g. a string, number or date) as an SQL value (as opposed to an identifier).
   *
   * @param value The value to escape
   * @param options The options to use when escaping the value
   */
  escape(value: unknown, options: EscapeOptions = EMPTY_OBJECT): string {
    if (isDictionary(value) && Op.col in value) {
      noOpCol();
      value = new Col(value[Op.col] as string);
    }

    if (value instanceof BaseSqlExpression) {
      return this.formatSqlExpression(value, options);
    }

    if (value === undefined) {
      throw new TypeError('"undefined" cannot be escaped');
    }

    let { type } = options;
    if (type != null) {
      type = this.sequelize.normalizeDataType(type);
    }

    if (
      value === null
      // we handle null values ourselves by default, unless the data type explicitly accepts null
      && (!(type instanceof AbstractDataType) || !type.acceptsNull())
    ) {
      if (options.bindParam) {
        return options.bindParam(null);
      }

      return 'NULL';
    }

    if (type == null || typeof type === 'string') {
      type = bestGuessDataTypeOfVal(value, this.dialect);
    } else {
      type = this.sequelize.normalizeDataType(type);
    }

    this.validate(value, type);

    if (options.bindParam) {
      return type.getBindParamSql(value, options as BindParamOptions);
    }

    return type.escape(value);
  }

  /**
   * Validate a value against a field specification
   *
   * @param value The value to validate
   * @param type The DataType to validate against
   */
  validate(value: unknown, type: DataType) {
    if (this.sequelize.options.noTypeValidation || isNullish(value)) {
      return;
    }

    if (isString(type)) {
      return;
    }

    type = this.sequelize.normalizeDataType(type);

    const error = validateDataType(value, type);
    if (error) {
      throw error;
    }
  }

  /**
   * Escapes an array of values (e.g. strings, numbers or dates) as an SQL List of values.
   *
   * @param values The list of values to escape
   * @param options
   *
   * @example
   * ```ts
   * const values = [1, 2, 3];
   * queryGenerator.escapeList([1, 2, 3]); // '(1, 2, 3)'
   */
  escapeList(values: unknown[], options?: EscapeOptions): string {
    return `(${values.map(value => this.escape(value, options)).join(', ')})`;
  }

  getToggleForeignKeyChecksQuery(_enable: boolean): string {
    throw new Error(`${this.dialect.name} does not support toggling foreign key checks`);
  }

  versionQuery(): string {
    throw new Error(`${this.dialect.name} did not implement versionQuery`);
  }

  tableExistsQuery(tableName: TableNameOrModel): string {
    const table = this.extractTableDetails(tableName);

    return `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME = ${this.escape(table.tableName)} AND TABLE_SCHEMA = ${this.escape(table.schema)}`;
  }
}
