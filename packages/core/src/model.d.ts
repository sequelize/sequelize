import type {
  AllowArray,
  AllowReadonlyArray,
  AnyFunction,
  Nullish,
  StrictRequiredBy,
} from '@sequelize/utils';
import type { SetRequired } from 'type-fest';
import type { AbstractConnection } from './abstract-dialect/connection-manager.js';
import type { DataType, NormalizedDataType } from './abstract-dialect/data-types.js';
import type { IndexField, IndexOptions, TableName } from './abstract-dialect/query-interface';
import type {
  Association,
  BelongsToAssociation,
  BelongsToManyAssociation,
  BelongsToManyOptions,
  BelongsToOptions,
  HasManyAssociation,
  HasManyOptions,
  HasOneAssociation,
  HasOneOptions,
} from './associations/index';
import type { Deferrable } from './deferrable';
import type { IndexHints } from './enums.js';
import type { DynamicSqlExpression } from './expression-builders/base-sql-expression.js';
import type { Cast } from './expression-builders/cast.js';
import type { Col } from './expression-builders/col.js';
import type { Fn } from './expression-builders/fn.js';
import type { Literal } from './expression-builders/literal.js';
import type { Where } from './expression-builders/where.js';
import type { Lock, Op, TableHints, Transaction, WhereOptions } from './index';
import type { ValidationOptions } from './instance-validator';
import type { ModelHooks } from './model-hooks.js';
import { ModelTypeScript } from './model-typescript.js';
import type { QueryOptions, Sequelize, SyncOptions } from './sequelize';
import type { COMPLETES_TRANSACTION } from './transaction';
import type { MakeNullishOptional, OmitConstructors } from './utils/types.js';

export interface Logging {
  /**
   * A function that gets executed while running the query to log the sql.
   */
  logging?: false | ((sql: string, timing?: number) => void) | undefined;

  /**
   * Pass query execution time in milliseconds as second argument to logging function (options.logging).
   */
  benchmark?: boolean | undefined;
}

export interface Poolable {
  /**
   * Force the query to use the write pool, regardless of the query type.
   *
   * @default false
   */
  useMaster?: boolean;
}

export interface Transactionable {
  /**
   * The transaction in which this query must be run.
   * Mutually exclusive with {@link Transactionable.connection}.
   *
   * If the Sequelize disableClsTransactions option has not been set to true, and a transaction is running in the current AsyncLocalStorage context,
   * that transaction will be used, unless null or another Transaction is manually specified here.
   */
  transaction?: Transaction | null | undefined;

  /**
   * The connection on which this query must be run.
   * Mutually exclusive with {@link Transactionable.transaction}.
   *
   * Can be used to ensure that a query is run on the same connection as a previous query, which is useful when
   * configuring session options.
   *
   * Specifying this option takes precedence over CLS Transactions. If a transaction is running in the current
   * AsyncLocalStorage context, it will be ignored in favor of the specified connection.
   */
  connection?: AbstractConnection | null | undefined;

  /**
   * Indicates if the query completes the transaction
   * Internal only
   *
   * @private
   * @hidden
   */
  [COMPLETES_TRANSACTION]?: boolean | undefined;
}

export interface SearchPathable {
  /**
   * An optional parameter to specify the schema search_path (Postgres only)
   */
  searchPath?: string;
}

export interface Filterable<TAttributes = any> {
  /**
   * The `WHERE` clause. Can be many things from a hash of attributes to raw SQL.
   *
   * Visit {@link https://sequelize.org/docs/v7/core-concepts/model-querying-basics/} for more information.
   */
  where?: WhereOptions<TAttributes>;
}

export interface Projectable<TAttributes = any> {
  /**
   * If an array: a list of the attributes that you want to select.
   * Attributes can also be raw SQL (`literal`), `fn`, `col`, and `cast`
   *
   * To rename an attribute, you can pass an array, with two elements:
   * - The first is the name of the attribute (or `literal`, `fn`, `col`, `cast`),
   * - and the second is the name to give to that attribute in the returned instance.
   *
   * If `include` is used: selects all the attributes of the model,
   * plus some additional ones. Useful for aggregations.
   *
   * @example
   * ```javascript
   * { attributes: { include: [[literal('COUNT(id)'), 'total']] }
   * ```
   *
   * If `exclude` is used: selects all the attributes of the model,
   * except the one specified in exclude. Useful for security purposes
   *
   * @example
   * ```javascript
   * { attributes: { exclude: ['password'] } }
   * ```
   */
  attributes?: FindAttributeOptions<TAttributes>;
}

export interface Paranoid {
  /**
   * If true, only non-deleted records will be returned. If false, both deleted and non-deleted records will
   * be returned.
   *
   * Only applies if {@link InitOptions.paranoid} is true for the model.
   *
   * @default true
   */
  paranoid?: boolean;
}

export type GroupOption = AllowArray<string | Fn | Col | Literal>;

/**
 * Options to pass to Model on drop
 */
export interface DropOptions extends Logging {
  /**
   * Also drop all objects depending on this table, such as views. Only works in postgres
   */
  cascade?: boolean;
}

/**
 * Schema Options provided for applying a schema to a model
 */
export interface SchemaOptions {
  schema: string;

  /**
   * The character(s) that separates the schema name from the table name
   */
  schemaDelimiter?: string | undefined;
}

/**
 * Scope Options for Model.scope
 */
export interface ScopeOptions {
  /**
   * The scope(s) to apply. Scopes can either be passed as consecutive arguments, or as an array of arguments.
   * To apply simple scopes and scope functions with no arguments, pass them as strings. For scope function,
   * pass an object, with a `method` property. The value can either be a string, if the method does not take
   * any arguments, or an array, where the first element is the name of the method, and consecutive elements
   * are arguments to that method. Pass null to remove all scopes, including the default.
   */
  method: string | readonly [string, ...unknown[]];
}

type InvalidInSqlArray = ColumnReference | Fn | Cast | null | Literal;

type AllowAnyAll<T> =
  | T
  // Op.all: [x, z] results in ALL (ARRAY[x, z])
  // Some things cannot go in ARRAY. Op.values must be used to support them.
  | {
      [Op.all]:
        | Array<Exclude<T, InvalidInSqlArray>>
        | Literal
        | { [Op.values]: Array<T | DynamicValues<T>> };
    }
  | {
      [Op.any]:
        | Array<Exclude<T, InvalidInSqlArray>>
        | Literal
        | { [Op.values]: Array<T | DynamicValues<T>> };
    };

// number is always allowed because -Infinity & +Infinity are valid
/**
 * This type represents a valid input when describing a {@link DataTypes.RANGE}.
 */
export type Rangable<T> =
  | readonly [
      lower: T | InputRangePart<T> | number | null,
      higher: T | InputRangePart<T> | number | null,
    ]
  | EmptyRange;

/**
 * This type represents the output of the {@link DataTypes.RANGE} data type.
 */
// number is always allowed because -Infinity & +Infinity are valid
export type Range<T> =
  | readonly [lower: RangePart<T> | number | null, higher: RangePart<T> | number | null]
  | EmptyRange;

type EmptyRange = [];

export type RangePart<T> = { value: T | number | null; inclusive: boolean };
export type InputRangePart<T> = { value: T | number | null; inclusive?: boolean };

/**
 * Internal type - prone to changes. Do not export.
 *
 * @private
 */
export type ColumnReference = Col | { [Op.col]: string };

/**
 * Internal type - prone to changes. Do not export.
 *
 * @private
 */
type WhereSerializableValue = boolean | string | number | Buffer | Date;

/**
 * Internal type - prone to changes. Do not export.
 *
 * @private
 */
type OperatorValues<AcceptableValues> =
  | StaticValues<AcceptableValues>
  | DynamicValues<AcceptableValues>;

/**
 * Represents acceptable Dynamic values.
 *
 * Dynamic values, as opposed to {@link StaticValues}. i.e. column references, functions, etc...
 */
type DynamicValues<AcceptableValues> =
  | Literal
  | ColumnReference
  | Fn
  | Cast
  // where() can only be used on boolean attributes
  | (AcceptableValues extends boolean ? Where : never);

/**
 * Represents acceptable Static values.
 *
 * Static values, as opposed to {@link DynamicValues}. i.e. booleans, strings, etc...
 */
type StaticValues<Type> =
  Type extends Range<infer RangeType>
    ? [lower: RangeType | RangePart<RangeType>, higher: RangeType | RangePart<RangeType>]
    : Type extends any[]
      ? { readonly [Key in keyof Type]: StaticValues<Type[Key]> }
      : Type extends null
        ? Type | WhereSerializableValue | null
        : Type | WhereSerializableValue;

/**
 * Operators that can be used in {@link WhereOptions}
 *
 * @typeParam AttributeType - The JS type of the attribute the operator is operating on.
 *
 * See https://sequelize.org/docs/v7/core-concepts/model-querying-basics/#operators
 */
// TODO: default to something more strict than `any` which lists serializable values
export interface WhereOperators<AttributeType = any> {
  /**
   * @example `[Op.eq]: 6,` becomes `= 6`
   * @example `[Op.eq]: [6, 7]` becomes `= ARRAY[6, 7]`
   * @example `[Op.eq]: null` becomes `IS NULL`
   * @example `[Op.eq]: true` becomes `= true`
   * @example `[Op.eq]: literal('raw sql')` becomes `= raw sql`
   * @example `[Op.eq]: col('column')` becomes `= "column"`
   * @example `[Op.eq]: fn('NOW')` becomes `= NOW()`
   */
  [Op.eq]?: AllowAnyAll<OperatorValues<AttributeType>>;

  /**
   * @example `[Op.ne]: 20,` becomes `!= 20`
   * @example `[Op.ne]: [20, 21]` becomes `!= ARRAY[20, 21]`
   * @example `[Op.ne]: null` becomes `IS NOT NULL`
   * @example `[Op.ne]: true` becomes `!= true`
   * @example `[Op.ne]: literal('raw sql')` becomes `!= raw sql`
   * @example `[Op.ne]: col('column')` becomes `!= "column"`
   * @example `[Op.ne]: fn('NOW')` becomes `!= NOW()`
   */
  [Op.ne]?: WhereOperators<AttributeType>[typeof Op.eq]; // accepts the same types as Op.eq

  /**
   * @example `[Op.is]: null` becomes `IS NULL`
   * @example `[Op.is]: true` becomes `IS TRUE`
   * @example `[Op.is]: literal('value')` becomes `IS value`
   */
  [Op.is]?: Extract<AttributeType, null | boolean> | Literal;

  /** Example: `[Op.isNot]: null,` becomes `IS NOT NULL` */
  [Op.isNot]?: WhereOperators<AttributeType>[typeof Op.is]; // accepts the same types as Op.is

  /** @example `[Op.gte]: 6` becomes `>= 6` */
  [Op.gte]?: AllowAnyAll<OperatorValues<NonNullable<AttributeType>>>;

  /** @example `[Op.lte]: 10` becomes `<= 10` */
  [Op.lte]?: WhereOperators<AttributeType>[typeof Op.gte]; // accepts the same types as Op.gte

  /** @example `[Op.lt]: 10` becomes `< 10` */
  [Op.lt]?: WhereOperators<AttributeType>[typeof Op.gte]; // accepts the same types as Op.gte

  /** @example `[Op.gt]: 6` becomes `> 6` */
  [Op.gt]?: WhereOperators<AttributeType>[typeof Op.gte]; // accepts the same types as Op.gte

  /**
   * @example `[Op.between]: [6, 10],` becomes `BETWEEN 6 AND 10`
   */
  [Op.between]?:
    | [
        lowerInclusive: OperatorValues<NonNullable<AttributeType>>,
        higherInclusive: OperatorValues<NonNullable<AttributeType>>,
      ]
    | Literal;

  /** @example `[Op.notBetween]: [11, 15],` becomes `NOT BETWEEN 11 AND 15` */
  [Op.notBetween]?: WhereOperators<AttributeType>[typeof Op.between];

  /** @example `[Op.in]: [1, 2],` becomes `IN (1, 2)` */
  [Op.in]?: ReadonlyArray<OperatorValues<NonNullable<AttributeType>>> | Literal;

  /** @example `[Op.notIn]: [1, 2],` becomes `NOT IN (1, 2)` */
  [Op.notIn]?: WhereOperators<AttributeType>[typeof Op.in];

  /**
   * @example `[Op.like]: '%hat',` becomes `LIKE '%hat'`
   * @example `[Op.like]: { [Op.any]: ['cat', 'hat'] }` becomes `LIKE ANY (ARRAY['cat', 'hat'])`
   */
  [Op.like]?: AllowAnyAll<OperatorValues<Extract<AttributeType, string>>>;

  /**
   * @example `[Op.notLike]: '%hat'` becomes `NOT LIKE '%hat'`
   * @example `[Op.notLike]: { [Op.any]: ['cat', 'hat']}` becomes `NOT LIKE ANY (ARRAY['cat', 'hat'])`
   */
  [Op.notLike]?: WhereOperators<AttributeType>[typeof Op.like];

  /**
   * case insensitive PG only
   *
   * @example `[Op.iLike]: '%hat'` becomes `ILIKE '%hat'`
   * @example `[Op.iLike]: { [Op.any]: ['cat', 'hat']}` becomes `ILIKE ANY (ARRAY['cat', 'hat'])`
   */
  [Op.iLike]?: WhereOperators<AttributeType>[typeof Op.like];

  /**
   * PG only
   *
   * @example `[Op.notILike]: '%hat'` becomes `NOT ILIKE '%hat'`
   * @example `[Op.notILike]: { [Op.any]: ['cat', 'hat']}` becomes `NOT ILIKE ANY (ARRAY['cat', 'hat'])`
   */
  [Op.notILike]?: WhereOperators<AttributeType>[typeof Op.like];

  /**
   * PG array & range 'overlaps' operator
   *
   * @example `[Op.overlap]: [1, 2]` becomes `&& [1, 2]`
   */
  // https://www.postgresql.org/docs/14/functions-range.html range && range
  // https://www.postgresql.org/docs/14/functions-array.html array && array
  [Op.overlap]?: AllowAnyAll<
    | // RANGE && RANGE
    (AttributeType extends Range<infer RangeType>
        ? Rangable<RangeType>
        : // ARRAY && ARRAY
          AttributeType extends any[]
          ? StaticValues<NonNullable<AttributeType>>
          : never)
    | DynamicValues<AttributeType>
  >;

  /**
   * PG array & range 'contains' operator
   *
   * @example `[Op.contains]: [1, 2]` becomes `@> [1, 2]`
   */
  // https://www.postgresql.org/docs/14/functions-json.html jsonb @> jsonb
  // https://www.postgresql.org/docs/14/functions-range.html range @> range ; range @> element
  // https://www.postgresql.org/docs/14/functions-array.html array @> array
  [Op.contains]?: // RANGE @> ELEMENT
  AttributeType extends Range<infer RangeType>
    ? OperatorValues<OperatorValues<NonNullable<RangeType>>>
    : // jsonb @> ELEMENT
      AttributeType extends object
      ? OperatorValues<Partial<AttributeType>>
      :
          | never
          // ARRAY @> ARRAY ; RANGE @> RANGE
          | WhereOperators<AttributeType>[typeof Op.overlap];

  /**
   * PG array & range 'contained by' operator
   *
   * @example `[Op.contained]: [1, 2]` becomes `<@ [1, 2]`
   */
  [Op.contained]?: AttributeType extends any[]
    ? // ARRAY <@ ARRAY ; RANGE <@ RANGE
      WhereOperators<AttributeType>[typeof Op.overlap]
    : // ELEMENT <@ RANGE
      AllowAnyAll<OperatorValues<Rangable<AttributeType>>>;

  /**
   * Strings starts with value.
   */
  [Op.startsWith]?: OperatorValues<Extract<AttributeType, string>>;
  /**
   * Strings not starts with value.
   */
  [Op.notStartsWith]?: WhereOperators<AttributeType>[typeof Op.startsWith];
  /**
   * String ends with value.
   */
  [Op.endsWith]?: WhereOperators<AttributeType>[typeof Op.startsWith];
  /**
   * String not ends with value.
   */
  [Op.notEndsWith]?: WhereOperators<AttributeType>[typeof Op.startsWith];
  /**
   * String contains value.
   */
  [Op.substring]?: WhereOperators<AttributeType>[typeof Op.startsWith];
  /**
   * String not contains value.
   */
  [Op.notSubstring]?: WhereOperators<AttributeType>[typeof Op.startsWith];

  /**
   * MySQL/PG only
   *
   * Matches regular expression, case sensitive
   *
   * @example `[Op.regexp]: '^[h|a|t]'` becomes `REGEXP/~ '^[h|a|t]'`
   */
  [Op.regexp]?: AllowAnyAll<OperatorValues<Extract<AttributeType, string>>>;

  /**
   * MySQL/PG only
   *
   * Does not match regular expression, case sensitive
   *
   * @example `[Op.notRegexp]: '^[h|a|t]'` becomes `NOT REGEXP/!~ '^[h|a|t]'`
   */
  [Op.notRegexp]?: WhereOperators<AttributeType>[typeof Op.regexp];

  /**
   * PG only
   *
   * Matches regular expression, case insensitive
   *
   * @example `[Op.iRegexp]: '^[h|a|t]'` becomes `~* '^[h|a|t]'`
   */
  [Op.iRegexp]?: WhereOperators<AttributeType>[typeof Op.regexp];

  /**
   * PG only
   *
   * Does not match regular expression, case insensitive
   *
   * @example `[Op.notIRegexp]: '^[h|a|t]'` becomes `!~* '^[h|a|t]'`
   */
  [Op.notIRegexp]?: WhereOperators<AttributeType>[typeof Op.regexp];

  /** @example `[Op.match]: Sequelize.fn('to_tsquery', 'fat & rat')` becomes `@@ to_tsquery('fat & rat')` */
  [Op.match]?: AllowAnyAll<DynamicValues<AttributeType>>;

  /**
   * PG only
   *
   * Whether the range is strictly left of the other range.
   *
   * @example
   * ```typescript
   * { rangeAttribute: { [Op.strictLeft]: [1, 2] } }
   * // results in
   * // "rangeAttribute" << [1, 2)
   * ```
   *
   * https://www.postgresql.org/docs/14/functions-range.html
   */
  [Op.strictLeft]?: AttributeType extends Range<infer RangeType>
    ? Rangable<RangeType>
    : never | DynamicValues<AttributeType>;

  /**
   * PG only
   *
   * Whether the range is strictly right of the other range.
   *
   * @example
   * ```typescript
   * { rangeAttribute: { [Op.strictRight]: [1, 2] } }
   * // results in
   * // "rangeAttribute" >> [1, 2)
   * ```
   *
   * https://www.postgresql.org/docs/14/functions-range.html
   */
  [Op.strictRight]?: WhereOperators<AttributeType>[typeof Op.strictLeft];

  /**
   * PG only
   *
   * Whether the range extends to the left of the other range.
   *
   * @example
   * ```typescript
   * { rangeAttribute: { [Op.noExtendLeft]: [1, 2] } }
   * // results in
   * // "rangeAttribute" &> [1, 2)
   * ```
   *
   * https://www.postgresql.org/docs/14/functions-range.html
   */
  [Op.noExtendLeft]?: WhereOperators<AttributeType>[typeof Op.strictLeft];

  /**
   * PG only
   *
   * Whether the range extends to the right of the other range.
   *
   * @example
   * ```typescript
   * { rangeAttribute: { [Op.noExtendRight]: [1, 2] } }
   * // results in
   * // "rangeAttribute" &< [1, 2)
   * ```
   *
   * https://www.postgresql.org/docs/14/functions-range.html
   */
  [Op.noExtendRight]?: WhereOperators<AttributeType>[typeof Op.strictLeft];

  /**
   * PG only
   *
   * Whether the two ranges are adjacent.
   *
   * @example
   * ```typescript
   * { rangeAttribute: { [Op.adjacent]: [1, 2] } }
   * // results in
   * // "rangeAttribute" -|- [1, 2)
   * ```
   *
   * https://www.postgresql.org/docs/14/functions-range.html
   */
  [Op.adjacent]?: WhereOperators<AttributeType>[typeof Op.strictLeft];

  /**
   * PG only
   *
   * Check if any of these array strings exist as top-level keys.
   *
   * @example
   * ```typescript
   * { jsonbAttribute: { [Op.anyKeyExists]: ['a','b'] } }
   * // results in
   * // "jsonbAttribute" ?| ARRAY['a','b']
   * ```
   *
   * https://www.postgresql.org/docs/current/functions-json.html
   */
  [Op.anyKeyExists]?: string[] | DynamicValues<string[]>;

  /**
   * PG only
   *
   * Check if all of these array strings exist as top-level keys.
   *
   * @example
   * ```typescript
   * { jsonbAttribute: { [Op.allKeysExist]: ['a','b'] } }
   * // results in
   * // "jsonbAttribute" ?& ARRAY['a','b']
   * ```
   *
   * https://www.postgresql.org/docs/current/functions-json.html
   */
  [Op.allKeysExist]?: WhereOperators<AttributeType>[typeof Op.anyKeyExists];
}

/**
 * Where Geometry Options
 */
export interface WhereGeometryOptions {
  type: string;
  coordinates: ReadonlyArray<number[] | number>;
}

/**
 * Through options for Include Options
 */
export interface IncludeThroughOptions extends Filterable<any>, Projectable<any> {
  /**
   * The alias for the join model, in case you want to give it a different name than the default one.
   */
  as?: string;

  /**
   * If true, only non-deleted records will be returned from the join table.
   * If false, both deleted and non-deleted records will be returned.
   * Only applies if through model is paranoid.
   *
   * @default true
   */
  paranoid?: boolean;
}

/**
 * Options for eager-loading associated models.
 *
 * The association can be specified in different ways:
 * - Using the name of the association: `{ include: 'associationName' }` *(recommended)*
 * - Using a reference to the association: `{ include: MyModel.associations['associationName'] }`
 * - Using the model to eager-load (an association must still be defined!): `{ include: Model1 }`
 *    - if the association with that model has an alias, you need to specify it too: `{ include: { model: Model1, as: 'Alias' } }`
 *
 * You can also eagerly load all associations using `{ include: { all: true } }` *(not recommended outside of debugging)*
 */
export type Includeable =
  | ModelStatic
  | Association
  | IncludeOptions
  | { all: true; nested?: true }
  | string;

/**
 * Complex include options
 */
export interface IncludeOptions extends Filterable<any>, Projectable<any>, Paranoid {
  /**
   * Mark the include as duplicating, will prevent a subquery from being used.
   */
  duplicating?: boolean;

  /**
   * The model you want to eagerly load.
   *
   * This option only works if this model is only associated once to the parent model of this query.
   * We recommend specifying {@link IncludeOptions.association} instead.
   */
  model?: ModelStatic;

  /**
   * The alias of the association. Used along with {@link IncludeOptions.model}.
   *
   * This must be specified if the association has an alias (i.e. "as" was used when defining the association).
   * For `hasOne` / `belongsTo`, this should be the singular name, and for `hasMany` / `belongsToMany`,
   * it should be the plural.
   *
   * @deprecated using "as" is the same as using {@link IncludeOptions.association}
   *  because "as" is always the name of the association.
   */
  as?: string;

  /**
   * The association you want to eagerly load.
   * Either one of the values available in {@link Model.associations}, or the name of the association.
   *
   * This can be used instead of providing a model/as pair.
   *
   * This is the recommended method.
   */
  association?: Association | string;

  /**
   * Custom `ON` clause, overrides default.
   */
  on?: WhereOptions<any>;

  /**
   * Whether to bind the ON and WHERE clause together by OR instead of AND.
   *
   * @default false
   */
  or?: boolean;

  /**
   * Where clauses to apply to the child model
   *
   * Note that this converts the eager load to an inner join,
   * unless you explicitly set {@link IncludeOptions.required} to false
   */
  where?: WhereOptions<any>;

  /**
   * If true, converts to an inner join, which means that the parent model will only be loaded if it has any
   * matching children.
   *
   * True if `include.where` is set, false otherwise.
   */
  required?: boolean;

  /**
   * If true, converts to a right join if dialect support it.
   *
   * Incompatible with {@link IncludeOptions.required}.
   */
  right?: boolean;

  /**
   * Limit include.
   *
   * Only available when setting {@link IncludeOptions.separate} to true.
   */
  limit?: number | Literal | Nullish;

  /**
   * If true, runs a separate query to fetch the associated instances.
   *
   * @default false
   */
  separate?: boolean;

  /**
   * Through Options
   */
  through?: IncludeThroughOptions;

  /**
   * Load further nested related models
   */
  include?: AllowArray<Includeable>;

  /**
   * Order include. Only available when setting `separate` to true.
   */
  order?: Order;

  /**
   * Use sub queries. This should only be used if you know for sure the query does not result in a cartesian product.
   */
  subQuery?: boolean;
}

type OrderItemAssociation =
  | Association
  | ModelStatic<Model>
  | { model: ModelStatic<Model>; as: string }
  | string;
type OrderItemColumn = string | Col | Fn | Literal;
export type OrderItem =
  | string
  | Fn
  | Col
  | Literal
  | [OrderItemColumn, string]
  | [OrderItemAssociation, OrderItemColumn]
  | [...OrderItemAssociation[], OrderItemColumn, string];
export type Order = Fn | Col | Literal | OrderItem[];

/**
 * Please note if this is used the aliased property will not be available on the model instance
 * as a property but only via `instance.get('alias')`.
 */
export type ProjectionAlias = readonly [
  expressionOrAttributeName: string | DynamicSqlExpression,
  alias: string,
];

export type FindAttributeOptions<TAttributes = any> =
  | Array<Extract<keyof TAttributes, string> | ProjectionAlias | Literal>
  | {
      exclude: Array<Extract<keyof TAttributes, string>>;
      include?: Array<Extract<keyof TAttributes, string> | ProjectionAlias>;
    }
  | {
      exclude?: Array<Extract<keyof TAttributes, string>>;
      include: Array<Extract<keyof TAttributes, string> | ProjectionAlias>;
    };

export interface IndexHint {
  type: IndexHints;
  values: string[];
}

export interface IndexHintable {
  /**
   * MySQL only.
   */
  indexHints?: IndexHint[];
}

export interface MaxExecutionTimeHintable {
  /**
   * This sets the max execution time for MySQL.
   */
  maxExecutionTimeHintMs?: number;
}

/**
 * Options that are passed to any model creating a SELECT query
 *
 * A hash of options to describe the scope of the search
 */
export interface FindOptions<TAttributes = any>
  extends QueryOptions,
    Filterable<TAttributes>,
    Projectable<TAttributes>,
    Paranoid,
    IndexHintable,
    SearchPathable,
    MaxExecutionTimeHintable {
  /**
   * A list of associations to eagerly load using a left join (a single association is also supported).
   *
   * See {@link Includeable} to see how to specify the association, and its eager-loading options.
   */
  include?: AllowArray<Includeable>;

  /**
   * Specifies an ordering. If a string is provided, it will be escaped.
   *
   * Using an array, you can provide several attributes / functions to order by.
   * Each element can be further wrapped in a two-element array:
   * - The first element is the column / function to order by,
   * - the second is the direction.
   *
   * @example
   * `order: [['name', 'DESC']]`.
   *
   * The attribute will be escaped, but the direction will not.
   */
  order?: Order;

  /**
   * GROUP BY in sql
   */
  group?: GroupOption;

  /**
   * Limits how many items will be retrieved by the operation.
   *
   * If `limit` and `include` are used together, Sequelize will turn the `subQuery` option on by default.
   * This is done to ensure that `limit` only impacts the Model on the same level as the `limit` option.
   *
   * You can disable this behavior by explicitly setting `subQuery: false`, however `limit` will then
   * affect the total count of returned values, including eager-loaded associations, instead of just one table.
   *
   * @example
   * ```javascript
   * // in the following query, `limit` only affects the "User" model.
   * // This will return 2 users, each including all of their projects.
   * User.findAll({
   *   limit: 2,
   *   include: [User.associations.projects],
   * });
   * ```
   *
   * @example
   * ```javascript
   * // in the following query, `limit` affects the total number of returned values, eager-loaded associations included.
   * // This may return 2 users, each with one project,
   * //  or 1 user with 2 projects.
   * User.findAll({
   *   limit: 2,
   *   include: [User.associations.projects],
   *   subQuery: false,
   * });
   * ```
   */
  limit?: number | Literal | Nullish;

  // TODO: document this - this is an undocumented property but it exists and there are tests for it.
  groupedLimit?: unknown;

  /**
   * Skip the first n items of the results.
   */
  offset?: number | Literal | Nullish;

  /**
   * Lock the selected rows. Possible options are transaction.LOCK.UPDATE and transaction.LOCK.SHARE.
   * Postgres also supports transaction.LOCK.KEY_SHARE, transaction.LOCK.NO_KEY_UPDATE and specific model
   * locks with joins. See {@link Lock}.
   */
  lock?: Lock | { level: Lock; of: ModelStatic<Model> } | boolean;

  /**
   * Skip locked rows. Only supported in Postgres.
   */
  skipLocked?: boolean;

  /**
   * Return raw result. See {@link Sequelize#query} for more information.
   */
  raw?: boolean;

  /**
   * Controls whether aliases are minified in this query.
   * This overrides the global option
   */
  minifyAliases?: boolean;

  /**
   * Select group rows after groups and aggregates are computed.
   */
  having?: WhereOptions<any>;

  /**
   * Use sub queries (internal).
   *
   * If unspecified, this will `true` by default if `limit` is specified, and `false` otherwise.
   * See {@link FindOptions#limit} for more information.
   */
  subQuery?: boolean;

  /**
   * Throws an error if the query would return 0 results.
   */
  rejectOnEmpty?: boolean | Error;

  /**
   * Use a table hint for the query, only supported in MSSQL.
   */
  tableHints?: TableHints[];
}

export interface NonNullFindOptions<TAttributes = any> extends FindOptions<TAttributes> {
  /**
   * Throw if nothing was found.
   */
  rejectOnEmpty: true | Error;
}

export interface FindByPkOptions<M extends Model> extends FindOptions<Attributes<M>> {}

export interface NonNullFindByPkOptions<M extends Model>
  extends NonNullFindOptions<Attributes<M>> {}

/**
 * Options for Model.count method
 */
export interface CountOptions<TAttributes = any>
  extends Logging,
    Transactionable,
    Filterable<TAttributes>,
    Projectable<TAttributes>,
    Paranoid,
    Poolable,
    MaxExecutionTimeHintable {
  /**
   * Include options. See `find` for details
   */
  include?: AllowArray<Includeable>;

  /**
   * Apply COUNT(DISTINCT(col))
   */
  distinct?: boolean;

  /**
   * GROUP BY in sql
   * Used in conjunction with `attributes`.
   *
   * @see Projectable
   */
  group?: GroupOption;

  /**
   * Column on which COUNT() should be applied
   */
  col?: string;

  /**
   * Count number of records returned by group by
   * Used in conjunction with `group`.
   */
  countGroupedRows?: boolean;
}

/**
 * Options for Model.count when GROUP BY is used
 */
export type CountWithOptions<TAttributes = any> = SetRequired<CountOptions<TAttributes>, 'group'>;

export interface FindAndCountOptions<TAttributes = any>
  extends CountOptions<TAttributes>,
    FindOptions<TAttributes> {}

export interface GroupedCountResultItem {
  [key: string]: unknown; // projected attributes
  count: number; // the count for each group
}

/**
 * Options for Model.build method
 */
export interface BuildOptions {
  /**
   * If set to true, values will ignore field and virtual setters.
   *
   * @default false
   */
  raw?: boolean;

  /**
   * Is this record new
   */
  isNewRecord?: boolean;

  /**
   * An array of include options. A single option is also supported - Used to build prefetched/included model instances. See `set`
   */
  include?: AllowArray<Includeable>;
}

export interface Silent {
  /**
   * If true, the updatedAt timestamp will not be updated.
   *
   * @default false
   */
  silent?: boolean;
}

/**
 * Options for Model.create method
 */
export interface CreateOptions<TAttributes = any>
  extends BuildOptions,
    Logging,
    Silent,
    Transactionable,
    Hookable,
    SearchPathable {
  /**
   * If set, only columns matching those in fields will be saved
   */
  fields?: Array<keyof TAttributes>;

  /**
   * dialect specific ON CONFLICT DO NOTHING / INSERT IGNORE
   */
  ignoreDuplicates?: boolean;

  /**
   * Return the affected rows (only for postgres)
   */
  returning?: boolean | Array<keyof TAttributes | Literal | Col>;

  /**
   * If false, validations won't be run.
   *
   * @default true
   */
  validate?: boolean;
}

export interface Hookable {
  /**
   * If `false` the applicable hooks will not be called.
   * The default value depends on the context.
   *
   * @default true
   */
  hooks?: boolean;
}

/**
 * Options for Model.findOrCreate method
 */
export interface FindOrCreateOptions<TAttributes = any, TCreationAttributes = TAttributes>
  extends FindOptions<TAttributes>,
    CreateOptions<TAttributes> {
  /**
   * Default values to use if building a new instance
   */
  defaults?: TCreationAttributes;
}

/**
 * Options for Model.findOrBuild method
 */
export interface FindOrBuildOptions<TAttributes = any, TCreationAttributes = TAttributes>
  extends FindOptions<TAttributes>,
    BuildOptions {
  /**
   * Default values to use if building a new instance
   */
  defaults?: TCreationAttributes;
}

/**
 * Options for Model.upsert method
 */
export interface UpsertOptions<TAttributes = any>
  extends Logging,
    Transactionable,
    SearchPathable,
    Hookable {
  /**
   * The fields to insert / update. Defaults to all fields.
   *
   * If none of the specified fields are present on the provided `values` object,
   * an insert will still be attempted, but duplicate key conflicts will be ignored.
   */
  fields?: Array<keyof TAttributes>;

  /**
   * Fetch back the affected rows (only for postgres)
   */
  returning?: boolean | Array<keyof TAttributes | Literal | Col>;

  /**
   * Run validations before the row is inserted
   *
   * @default true
   */
  validate?: boolean;
  /**
   * An optional parameter that specifies a where clause for the `ON CONFLICT` part of the query
   * (in particular: for applying to partial unique indexes).
   * Only supported in Postgres >= 9.5 and SQLite >= 3.24.0
   */
  conflictWhere?: WhereOptions<TAttributes>;
  /**
   * Optional override for the conflict fields in the ON CONFLICT part of the query.
   * Only supported in Postgres >= 9.5 and SQLite >= 3.24.0
   */
  conflictFields?: Array<keyof TAttributes>;
}

/**
 * Options for Model.bulkCreate method
 */
export interface BulkCreateOptions<TAttributes = any>
  extends Logging,
    Transactionable,
    Hookable,
    SearchPathable {
  /**
   * Fields to insert (defaults to all fields)
   */
  fields?: Array<keyof TAttributes>;

  /**
   * Should each row be subject to validation before it is inserted.
   * The whole insert will fail if one row fails validation
   *
   * @default false
   */
  validate?: boolean;

  /**
   * Run before / after create hooks for each individual Instance?
   * BulkCreate hooks will still be run if {@link BulkCreateOptions.hooks} is true.
   *
   * @default false
   */
  individualHooks?: boolean;

  /**
   * Ignore duplicate values for primary keys?
   *
   * @default false
   */
  ignoreDuplicates?: boolean;

  /**
   * Fields to update if row key already exists (on duplicate key update)? (only supported by MySQL,
   * MariaDB, SQLite >= 3.24.0 & Postgres >= 9.5).
   */
  updateOnDuplicate?: Array<keyof TAttributes>;

  /**
   * Include options. See `find` for details
   */
  include?: AllowArray<Includeable>;

  /**
   * Return all columns or only the specified columns for the affected rows (only for postgres)
   */
  returning?: boolean | Array<keyof TAttributes | Literal | Col>;

  /**
   * An optional parameter to specify a where clause for partial unique indexes
   * (note: `ON CONFLICT WHERE` not `ON CONFLICT DO UPDATE WHERE`).
   * Only supported in Postgres >= 9.5 and sqlite >= 9.5
   */
  conflictWhere?: WhereOptions<TAttributes>;
  /**
   * Optional override for the conflict fields in the ON CONFLICT part of the query.
   * Only supported in Postgres >= 9.5 and SQLite >= 3.24.0
   */
  conflictAttributes?: Array<keyof TAttributes>;
}

/**
 * The options accepted by {@link Model.truncate}.
 */
export interface TruncateOptions extends Logging, Transactionable, Hookable {
  /**
   * Truncates all tables that have foreign-key references to the
   * named table, or to any tables added to the group due to CASCADE.
   *
   * @default false
   */
  cascade?: boolean;

  /**
   * Automatically restart sequences owned by columns of the truncated table
   *
   * @default false
   */
  restartIdentity?: boolean;
}

/**
 * Options accepted by {@link Model.destroy}.
 */
export interface DestroyOptions<TAttributes = any>
  extends Logging,
    Transactionable,
    Hookable,
    Filterable<TAttributes> {
  /**
   * If set to true, destroy will SELECT all records matching the where parameter and will execute before /
   * after destroy hooks on each row
   *
   * @default false
   */
  individualHooks?: boolean;

  /**
   * How many rows to delete
   */
  limit?: number | Literal | Nullish;

  /**
   * Delete instead of setting deletedAt to current timestamp (only applicable if `paranoid` is enabled)
   *
   * @default false
   */
  force?: boolean;
}

/**
 * Options for Model.restore
 */
export interface RestoreOptions<TAttributes = any>
  extends Logging,
    Transactionable,
    Filterable<TAttributes>,
    Hookable {
  /**
   * If set to true, restore will find all records within the where parameter and will execute before / after
   * bulkRestore hooks on each row
   */
  individualHooks?: boolean;

  /**
   * How many rows to undelete
   */
  limit?: number | Literal | Nullish;
}

/**
 * Options used for Model.update
 */
export interface UpdateOptions<TAttributes = any>
  extends Logging,
    Transactionable,
    Paranoid,
    Hookable {
  /**
   * Options to describe the scope of the search.
   */
  where: WhereOptions<TAttributes>;

  /**
   * Fields to update (defaults to all fields)
   */
  fields?: Array<keyof TAttributes>;

  /**
   * Should each row be subject to validation before it is inserted. The whole insert will fail if one row
   * fails validation.
   *
   * @default true
   */
  validate?: boolean;

  /**
   * Whether to update the side effects of any virtual setters.
   *
   * @default true
   */
  sideEffects?: boolean;

  /**
   * Run before / after update hooks?. If true, this will execute a SELECT followed by individual UPDATEs.
   * A select is needed, because the row data needs to be passed to the hooks
   *
   * @default false
   */
  individualHooks?: boolean;

  /**
   * Return the affected rows (only for postgres)
   *
   * @default false
   */
  returning?: boolean | Array<keyof TAttributes | Literal | Col>;

  /**
   * How many rows to update
   *
   * Only for mysql and mariadb,
   * Implemented as TOP(n) for MSSQL; for sqlite it is supported only when rowid is present
   */
  limit?: number | Literal | Nullish;

  /**
   * If true, the updatedAt timestamp will not be updated.
   */
  silent?: boolean;
}

/**
 * A pojo of values to update.
 *
 * Used by {@link Model.update}
 */
export type UpdateValues<M extends Model> = {
  [key in keyof Attributes<M>]?: Attributes<M>[key] | Fn | Col | Literal;
};

/**
 * Options used for Model.aggregate
 */
export interface AggregateOptions<T extends DataType | unknown, TAttributes = any>
  extends QueryOptions,
    Filterable<TAttributes>,
    Paranoid {
  /**
   * The type of the result. If attribute being aggregated is a defined in the Model,
   * the default will be the type of that attribute, otherwise defaults to a plain JavaScript `number`.
   */
  dataType?: string | T;

  /**
   * Applies DISTINCT to the field being aggregated over
   */
  distinct?: boolean;
}

// instance

/**
 * Options used for Instance.increment method
 */
export interface IncrementDecrementOptions<TAttributes = any>
  extends Logging,
    Transactionable,
    Silent,
    SearchPathable,
    Filterable<TAttributes> {
  /**
   * Return the affected rows (only for postgres)
   */
  returning?: boolean | Array<keyof TAttributes | Literal | Col>;
}

/**
 * Options used for Instance.increment method
 */
export interface IncrementDecrementOptionsWithBy<TAttributes = any>
  extends IncrementDecrementOptions<TAttributes> {
  /**
   * The number to increment by
   *
   * @default 1
   */
  by?: number;
}

/**
 * Options used for Instance.restore method
 */
export interface InstanceRestoreOptions extends Logging, Transactionable {}

/**
 * Options used for Instance.destroy method
 */
export interface InstanceDestroyOptions extends Logging, Transactionable, Hookable {
  /**
   * If set to true, paranoid models will actually be deleted
   */
  force?: boolean;
}

/**
 * Options used for Instance.update method
 */
export interface InstanceUpdateOptions<TAttributes = any>
  extends SaveOptions<TAttributes>,
    SetOptions,
    Filterable<TAttributes> {}

/**
 * Options used for Instance.set method
 */
export interface SetOptions {
  /**
   * If set to true, field and virtual setters will be ignored
   */
  raw?: boolean;

  /**
   * Clear all previously set data values
   */
  reset?: boolean;
}

/**
 * Options used for Instance.save method
 */
export interface SaveOptions<TAttributes = any>
  extends Logging,
    Transactionable,
    Silent,
    Hookable,
    SearchPathable {
  /**
   * An optional array of strings, representing database columns. If fields is provided, only those columns
   * will be validated and saved.
   */
  fields?: Array<keyof TAttributes>;

  /**
   * If false, validations won't be run.
   *
   * @default true
   */
  validate?: boolean;

  /**
   * A flag that defines if null values should be passed as values or not.
   *
   * @default false
   */
  omitNull?: boolean;

  association?: boolean;

  /**
   * Return the affected rows (only for postgres)
   */
  returning?: boolean | Array<keyof TAttributes | Literal | Col>;
}

/**
 * Model validations, allow you to specify format/content/inheritance validations for each attribute of the
 * model.
 *
 * Validations are automatically run on create, update and save. You can also call validate() to manually
 * validate an instance.
 *
 * The validations are implemented by validator.js.
 */
export interface ColumnValidateOptions {
  /**
   * - `{ is: ['^[a-z]+$','i'] }` will only allow letters
   * - `{ is: /^[a-z]+$/i }` also only allows letters
   */
  is?:
    | string
    | ReadonlyArray<string | RegExp>
    | RegExp
    | { msg: string; args: string | ReadonlyArray<string | RegExp> | RegExp };

  /**
   * - `{ not: ['[a-z]','i'] }` will not allow letters
   */
  not?:
    | string
    | ReadonlyArray<string | RegExp>
    | RegExp
    | { msg: string; args: string | ReadonlyArray<string | RegExp> | RegExp };

  /**
   * checks for email format (foo@bar.com)
   */
  isEmail?: boolean | { msg: string };

  /**
   * checks for url format (http://foo.com)
   */
  isUrl?: boolean | { msg: string };

  /**
   * checks for IPv4 (129.89.23.1) or IPv6 format
   */
  isIP?: boolean | { msg: string };

  /**
   * checks for IPv4 (129.89.23.1)
   */
  isIPv4?: boolean | { msg: string };

  /**
   * checks for IPv6 format
   */
  isIPv6?: boolean | { msg: string };

  /**
   * will only allow letters
   */
  isAlpha?: boolean | { msg: string };

  /**
   * will only allow alphanumeric characters, so "_abc" will fail
   */
  isAlphanumeric?: boolean | { msg: string };

  /**
   * will only allow numbers
   */
  isNumeric?: boolean | { msg: string };

  /**
   * checks for valid integers
   */
  isInt?: boolean | { msg: string };

  /**
   * checks for valid floating point numbers
   */
  isFloat?: boolean | { msg: string };

  /**
   * checks for any numbers
   */
  isDecimal?: boolean | { msg: string };

  /**
   * checks for lowercase
   */
  isLowercase?: boolean | { msg: string };

  /**
   * checks for uppercase
   */
  isUppercase?: boolean | { msg: string };

  /**
   * won't allow null
   */
  // TODO: remove. Already checked by allowNull
  notNull?: boolean | { msg: string };

  /**
   * only allows null
   */
  // TODO: remove. Already checked by allowNull
  isNull?: boolean | { msg: string };

  /**
   * don't allow empty strings
   */
  notEmpty?: boolean | { msg: string };

  /**
   * only allow a specific value
   */
  equals?: string | { msg: string };

  /**
   * force specific substrings
   */
  contains?: string | { msg: string };

  /**
   * check the value is not one of these
   */
  notIn?: ReadonlyArray<readonly any[]> | { msg: string; args: ReadonlyArray<readonly any[]> };

  /**
   * check the value is one of these
   */
  isIn?: ReadonlyArray<readonly any[]> | { msg: string; args: ReadonlyArray<readonly any[]> };

  /**
   * don't allow specific substrings
   */
  notContains?: readonly string[] | string | { msg: string; args: readonly string[] | string };

  /**
   * only allow values with length between 2 and 10
   */
  len?: readonly [number, number] | { msg: string; args: readonly [number, number] };

  /**
   * only allow uuids
   */
  isUUID?: number | { msg: string; args: number };

  /**
   * only allow date strings
   */
  isDate?: boolean | { msg: string; args: boolean };

  /**
   * only allow date strings after a specific date
   */
  isAfter?: string | { msg: string; args: string };

  /**
   * only allow date strings before a specific date
   */
  isBefore?: string | { msg: string; args: string };

  /**
   * only allow values
   */
  max?: number | { msg: string; args: readonly [number] };

  /**
   * only allow values >= 23
   */
  min?: number | { msg: string; args: readonly [number] };

  /**
   * only allow arrays
   */
  isArray?: boolean | { msg: string; args: boolean };

  /**
   * check for valid credit card numbers
   */
  isCreditCard?: boolean | { msg: string; args: boolean };

  // TODO: Enforce 'rest' indexes to have type `(value: unknown) => boolean`
  // Blocked by: https://github.com/microsoft/TypeScript/issues/7765
  /**
   * Custom validations are also possible
   */
  [name: string]: unknown;
}

/**
 * Interface for name property in InitOptions
 */
export interface ModelNameOptions {
  /**
   * Singular model name
   */
  singular?: string;

  /**
   * Plural model name
   */
  plural?: string;
}

/**
 * Interface for Define Scope Options
 */
export interface ModelScopeOptions<TAttributes = any> {
  /**
   * Name of the scope and it's query
   */
  [scopeName: string]:
    | FindOptions<TAttributes>
    | ((...args: readonly any[]) => FindOptions<TAttributes>);
}

/**
 * References options for the column's attributes
 */
export interface AttributeReferencesOptions {
  /**
   * The Model to reference.
   *
   * Ignored if {@link table} is specified.
   */
  model?: ModelStatic;

  /**
   * The name of the table to reference (the sql name).
   */
  table?: TableName;

  /**
   * The column on the target model that this foreign key references
   */
  key?: string;

  /**
   * When to check for the foreign key constraint
   *
   * PostgreSQL only
   */
  deferrable?: Deferrable;
}

export interface NormalizedAttributeReferencesOptions
  extends Omit<AttributeReferencesOptions, 'model'> {
  /**
   * The name of the table to reference (the sql name).
   */
  readonly table: TableName;
}

// TODO: when merging model.d.ts with model.js, make this an enum.
export type ReferentialAction = 'CASCADE' | 'RESTRICT' | 'SET DEFAULT' | 'SET NULL' | 'NO ACTION';

/**
 * Column options for the model schema attributes.
 * Used in {@link Model.init} and {@link Sequelize#define}, and the Attribute decorator.
 */
// TODO: Link to Attribute decorator once it's possible to have multiple entry points in the docs: https://github.com/TypeStrong/typedoc/issues/2138
export interface AttributeOptions<M extends Model = Model> {
  /**
   * A string or a data type.
   *
   * @see https://sequelize.org/docs/v7/models/data-types/
   */
  type: DataType;

  /**
   * If false, the column will have a NOT NULL constraint, and a not null validation will be run before an
   * instance is saved.
   *
   * @default true
   */
  allowNull?: boolean | undefined;

  /**
   * @deprecated use {@link columnName} instead.
   */
  field?: string | undefined;

  /**
   * The name of the column.
   *
   * If no value is provided, Sequelize will use the name of the attribute (in snake_case if {@link InitOptions.underscored} is true)
   */
  columnName?: string | undefined;

  /**
   * A literal default value, a JavaScript function, or an SQL function (using {@link sql.fn})
   */
  defaultValue?: unknown | undefined;

  /**
   * If true, the column will get a unique constraint. If a string is provided, the column will be part of a
   * composite unique index. If multiple columns have the same string, they will be part of the same unique
   * index
   */
  unique?: AllowArray<boolean | string | { name: string; msg?: string }> | undefined;

  /**
   * If true, an index will be created for this column.
   * If a string is provided, the column will be part of a composite index together with the other attributes that specify the same index name.
   */
  index?: AllowArray<boolean | string | AttributeIndexOptions> | undefined;

  /**
   * If true, this attribute will be marked as primary key
   */
  primaryKey?: boolean | undefined;

  /**
   * Is this field an auto increment field
   */
  autoIncrement?: boolean | undefined;

  /**
   * If this field is a Postgres auto increment field, use Postgres `GENERATED BY DEFAULT AS IDENTITY` instead of `SERIAL`. Postgres 10+ only.
   */
  autoIncrementIdentity?: boolean | undefined;

  /**
   * Comment to add on the column in the database.
   */
  comment?: string | undefined;

  /**
   * Makes this attribute a foreign key.
   * You typically don't need to use this yourself, instead use associations.
   *
   * Setting this value to a string equivalent to setting it to `{ tableName: 'myString' }`.
   */
  references?: string | ModelStatic | AttributeReferencesOptions | undefined;

  /**
   * What should happen when the referenced key is updated.
   * One of CASCADE, RESTRICT, SET DEFAULT, SET NULL or NO ACTION
   */
  onUpdate?: ReferentialAction | undefined;

  /**
   * What should happen when the referenced key is deleted.
   * One of CASCADE, RESTRICT, SET DEFAULT, SET NULL or NO ACTION
   */
  onDelete?: ReferentialAction | undefined;

  /**
   * An object of validations to execute for this column every time the model is saved. Can be either the
   * name of a validation provided by validator.js, a validation function provided by extending validator.js
   * (see the
   * `DAOValidator` property for more details), or a custom validation function. Custom validation functions
   * are called with the value of the field, and can possibly take a second callback argument, to signal that
   * they are asynchronous. If the validator is sync, it should throw in the case of a failed validation,
   * it is async, the callback should be called with the error text.
   */
  validate?: ColumnValidateOptions | undefined;

  /**
   * Provide a custom getter for this column.
   * Use {@link Model.getDataValue} to access the underlying values.
   */
  get?: ((this: M) => unknown) | undefined;

  /**
   * Provide a custom setter for this column.
   * Use {@link Model.setDataValue} to access the underlying values.
   */
  set?: ((this: M, val: any) => void) | undefined;

  /**
   * This attribute is added by sequelize. Do not use!
   *
   * @private
   */
  // TODO: use a private symbol
  _autoGenerated?: boolean | undefined;
}

export interface AttributeIndexOptions extends Omit<IndexOptions, 'fields'> {
  /**
   * Configures the options for this index attribute.
   */
  attribute?: Omit<IndexField, 'name'>;
}

export interface NormalizedAttributeOptions<M extends Model = Model>
  extends Readonly<
    Omit<
      StrictRequiredBy<AttributeOptions<M>, 'columnName'>,
      | 'type'
      // index and unique are always removed from attribute options, Model.getIndexes() must be used instead.
      | 'index'
      | 'unique'
    >
  > {
  /**
   * @deprecated use {@link NormalizedAttributeOptions.attributeName} instead.
   */
  readonly fieldName: string;

  /**
   * The name of the attribute (JS side).
   */
  readonly attributeName: string;

  /**
   * Like {@link AttributeOptions.type}, but normalized.
   */
  readonly type: NormalizedDataType;
  readonly references?: NormalizedAttributeReferencesOptions;
}

/**
 * Interface for Attributes provided for all columns in a model
 */
export type ModelAttributes<M extends Model = Model, TAttributes = any> = {
  /**
   * The description of a database column
   */
  [name in keyof TAttributes]: DataType | AttributeOptions<M>;
};

/**
 * Options for model definition.
 *
 * Used by {@link Sequelize.define}, {@link Model.init}, and the {@link decorators-legacy.Table} decorator.
 *
 * @see https://sequelize.org/docs/v7/core-concepts/model-basics/
 */
export interface ModelOptions<M extends Model = Model> {
  /**
   * Define the default search scope to use for this model. Scopes have the same form as the options passed to
   * find / findAll.
   *
   * See {@link https://sequelize.org/docs/v7/other-topics/scopes/} to learn more about scopes.
   */
  defaultScope?: FindOptions<Attributes<M>> | undefined;

  /**
   * More scopes, defined in the same way as {@link ModelOptions.defaultScope} above.
   * See {@link Model.scope} for more information about how scopes are defined, and what you can do with them.
   *
   * See {@link https://sequelize.org/docs/v7/other-topics/scopes/} to learn more about scopes.
   */
  scopes?: ModelScopeOptions<Attributes<M>> | undefined;

  /**
   * Don't persist null values. This means that all columns with null values will not be saved.
   *
   * @default false
   */
  omitNull?: boolean | undefined;

  /**
   * Sequelize will automatically add a primary key called `id` if no
   * primary key has been added manually.
   *
   * Set to false to disable adding that primary key.
   *
   * @default false
   */
  noPrimaryKey?: boolean | undefined;

  /**
   * Adds createdAt and updatedAt timestamps to the model.
   *
   * @default true
   */
  timestamps?: boolean | undefined;

  /**
   * If true, calling {@link Model.destroy} will not delete the model, but will instead set a `deletedAt` timestamp.
   *
   * This options requires {@link ModelOptions.timestamps} to be true.
   * The `deletedAt` column can be customized through {@link ModelOptions.deletedAt}.
   *
   * @default false
   */
  paranoid?: boolean | undefined;

  /**
   * If true, Sequelize will snake_case the name of columns that do not have an explicit value set (using {@link AttributeOptions.field}).
   * The name of the table will also be snake_cased, unless {@link ModelOptions.tableName} is set, or {@link ModelOptions.freezeTableName} is true.
   *
   * @default false
   */
  underscored?: boolean | undefined;

  /**
   * Indicates if the model's table has a trigger associated with it.
   *
   * @default false
   */
  hasTrigger?: boolean | undefined;

  /**
   * If true, sequelize will use the name of the Model as-is as the name of the SQL table.
   * If false, the name of the table will be pluralised (and snake_cased if {@link ModelOptions.underscored} is true).
   *
   * This option has no effect if {@link ModelOptions.tableName} is set.
   *
   * @default false
   */
  freezeTableName?: boolean | undefined;

  // TODO: merge with modelName
  /**
   * An object with two attributes, `singular` and `plural`, which are used when this model is associated to others.
   *
   * Not inherited.
   */
  name?: ModelNameOptions | undefined;

  /**
   * The name of the model.
   *
   * If not set, the name of the class will be used instead.
   * You should specify this option if you are going to minify your code in a way that may mangle the class name.
   *
   * Not inherited.
   */
  modelName?: string | undefined;

  /**
   * Indexes for the provided database table
   */
  indexes?: readonly IndexOptions[] | undefined;

  /**
   * Override the name of the createdAt attribute if a string is provided, or disable it if false.
   * {@link ModelOptions.timestamps} must be true.
   *
   * Not affected by underscored setting.
   */
  createdAt?: string | boolean | undefined;

  /**
   * Override the name of the deletedAt attribute if a string is provided, or disable it if false.
   * {@link ModelOptions.timestamps} must be true.
   * {@link ModelOptions.paranoid} must be true.
   *
   * Not affected by underscored setting.
   */
  deletedAt?: string | boolean | undefined;

  /**
   * Override the name of the updatedAt attribute if a string is provided, or disable it if false.
   * {@link ModelOptions.timestamps} must be true.
   *
   * Not affected by underscored setting.
   */
  updatedAt?: string | boolean | undefined;

  /**
   * The name of the table in SQL.
   *
   * @default The {@link ModelOptions.modelName}, pluralized,
   *  unless freezeTableName is true, in which case it uses model name
   *  verbatim.
   *
   * Not inherited.
   */
  tableName?: string | undefined;

  // TODO: merge these two together into one using SchemaOptions, or replace with tableName: TableNameWithSchema
  /**
   * The database schema in which this table will be located.
   */
  schema?: string | undefined;
  schemaDelimiter?: string | undefined;

  /**
   * The name of the database storage engine to use (e.g. MyISAM, InnoDB).
   *
   * MySQL, MariaDB only.
   */
  engine?: string | undefined;

  /**
   * The charset to use for the model
   */
  charset?: string | undefined;

  /**
   * A comment for the table.
   *
   * MySQL, PG only.
   */
  comment?: string | undefined;

  /**
   * The collation for model's table
   */
  collate?: string | undefined;

  /**
   * Set the initial AUTO_INCREMENT value for the table in MySQL.
   */
  initialAutoIncrement?: string | undefined;

  /**
   * Add hooks to the model.
   * Hooks will be called before and after certain operations.
   *
   * This can also be done through {@link Model.addHook}, or the individual hook methods such as {@link Model.afterBulkCreate}.
   * Each property can either be a function, or an array of functions.
   *
   * @see https://sequelize.org/docs/v7/other-topics/hooks/
   */
  hooks?:
    | {
        [Key in keyof ModelHooks<M, Attributes<M>>]?: AllowArray<
          | ModelHooks<M, Attributes<M>>[Key]
          | { name: string | symbol; callback: ModelHooks<M, Attributes<M>>[Key] }
        >;
      }
    | undefined;

  /**
   * An object of model wide validations. Validations have access to all model values via `this`. If the
   * validator function takes an argument, it is assumed to be async, and is called with a callback that
   * accepts an optional error.
   */
  validate?:
    | {
        /**
         * Custom validation functions run on all instances of the model.
         */
        [name: string]: (
          this: CreationAttributes<M> & ExtractMethods<M>,
          callback?: (err: unknown) => void,
        ) => void;
      }
    | undefined;

  /**
   * Enable optimistic locking.
   * When enabled, sequelize will add a version count attribute to the model and throw an
   * OptimisticLockingError error when stale instances are saved.
   * - If string: Uses the named attribute.
   * - If boolean: Uses `version`.
   *
   * @default false
   */
  version?: boolean | string | undefined;
}

/**
 * Options passed to {@link Model.init}
 */
export interface InitOptions<M extends Model = Model> extends ModelOptions<M> {
  /**
   * The sequelize connection. Required ATM.
   */
  sequelize: Sequelize;
}

export type BuiltModelName = Required<ModelNameOptions>;
export type BuiltModelOptions<M extends Model = Model> = Omit<
  StrictRequiredBy<
    InitOptions<M>,
    'modelName' | 'indexes' | 'underscored' | 'validate' | 'tableName'
  >,
  'name' | 'sequelize'
> & { name: BuiltModelName };

/**
 * AddScope Options for Model.addScope
 */
export interface AddScopeOptions {
  /**
   * If a scope of the same name already exists, should it be overwritten?
   */
  override: boolean;
}

export interface ModelGetOptions {
  /**
   * Only evaluated when "key === undefined". If set to true, all objects including child-objects will be copies and will not reference the original dataValues-object.
   *
   * @default false
   */
  clone?: boolean;

  /**
   * If set to true, included instances will be returned as plain objects
   *
   * @default false
   */
  plain?: boolean;

  /**
   * If set to true, field and virtual setters will be ignored.
   *
   * @default false
   */
  raw?: boolean;
}

/**
 * A Model represents a table in the database. Instances of this class represent a database row.
 */
export abstract class Model<
  TModelAttributes extends {} = any,
  TCreationAttributes extends {} = TModelAttributes,
> extends ModelTypeScript {
  /**
   * A dummy variable that doesn't exist on the real object. This exists so
   * Typescript can infer the type of the attributes in static functions. Don't
   * try to access this!
   *
   * Before using these, I'd tried typing out the functions without them, but
   * Typescript fails to infer `TAttributes` in signatures like the below.
   *
   * ```ts
   * public static findOne<M extends Model<TAttributes>, TAttributes>(
   *   this: { new(): M },
   *   options: NonNullFindOptions<TAttributes>
   * ): Promise<M>;
   * ```
   *
   * @deprecated This property will become a Symbol in v7 to prevent collisions.
   * Use Attributes<Model> instead of this property to be forward-compatible.
   */
  _attributes: TModelAttributes; // TODO [>6]: make this a non-exported symbol (same as the one in hooks.d.ts)

  /**
   * Object that contains underlying model data
   */
  dataValues: TModelAttributes;

  /**
   * A similar dummy variable that doesn't exist on the real object. Do not
   * try to access this in real code.
   *
   * @deprecated This property will become a Symbol in v7 to prevent collisions.
   * Use CreationAttributes<Model> instead of this property to be forward-compatible.
   */
  _creationAttributes: TCreationAttributes; // TODO [>6]: make this a non-exported symbol (same as the one in hooks.d.ts)

  /**
   * Returns the attributes of the model
   */
  static getAttributes<M extends Model>(
    this: ModelStatic<M>,
  ): {
    readonly [Key in keyof Attributes<M>]: NormalizedAttributeOptions;
  };

  /**
   * Checks whether an association with this name has already been registered.
   *
   * @param {string} alias
   * @returns {boolean}
   */
  // TODO: deprecate & rename to 'hasAssociation' to mirror getAssociation.
  static hasAlias(alias: string): boolean;

  /**
   * Returns the association that matches the name parameter.
   * Throws if no such association has been defined.
   *
   * @param name
   */
  static getAssociation(name: string): Association;

  /**
   * Returns all associations that have 'target' as their target.
   */
  static getAssociations<S extends Model, T extends Model>(
    this: ModelStatic<S>,
    target: ModelStatic<T>,
  ): Array<Association<S, T>>;

  /**
   * Returns the association for which the target matches the 'target' parameter, and the alias ("as") matches the 'alias' parameter
   *
   * Throws if no such association were found.
   */
  static getAssociationWithModel<S extends Model, T extends Model>(
    this: ModelStatic<S>,
    target: ModelStatic<T>,
    alias: string,
  ): Association<S, T>;

  /**
   * Remove attribute from model definition.
   * Only use if you know what you're doing.
   *
   * @param attribute
   */
  static removeAttribute(attribute: string): void;

  /**
   * Merges new attributes with the existing ones.
   * Only use if you know what you're doing.
   *
   * Warning: Attributes are not replaced, they are merged.
   * The existing configuration for an attribute takes priority over the new configuration.
   *
   * @param newAttributes
   */
  static mergeAttributesDefault(newAttributes: {
    [key: string]: AttributeOptions;
  }): NormalizedAttributeOptions;

  /**
   * Creates this table in the database, if it does not already exist.
   *
   * Works like {@link Sequelize#sync}, but only this model is synchronised.
   */
  static sync<M extends Model>(options?: SyncOptions): Promise<M>;

  /**
   * Drop the table represented by this Model
   *
   * @param options
   */
  static drop(options?: DropOptions): Promise<void>;

  /**
   * Returns a copy of this model with the corresponding table located in the specified schema.
   *
   * For postgres, this will actually place the schema in front of the table name (`"schema"."tableName"`),
   * while the schema will be prepended to the table name for mysql and sqlite (`'schema.tablename'`).
   *
   * This method is intended for use cases where the same model is needed in multiple schemas.
   * In such a use case it is important to call {@link Model.sync} (or use migrations!) for each model created by this method
   * to ensure the models are created in the correct schema.
   *
   * If a single default schema per model is needed, set the {@link ModelOptions.schema} instead.
   *
   * @param schema The name of the schema. Passing a string is equivalent to setting {@link SchemaOptions.schema}.
   */
  static withSchema<M extends Model>(
    this: ModelStatic<M>,
    schema: string | SchemaOptions | Nullish,
  ): ModelStatic<M>;

  /**
   * @deprecated this method has been renamed to {@link Model.withSchema} to emphasise the fact that this method
   *  does not mutate the model and instead returns a new one.
   */
  static schema<M extends Model>(
    this: ModelStatic<M>,
    schema: string | Nullish,
    options?: { schemaDelimiter?: string } | string,
  ): ModelStatic<M>;

  /**
   * Creates a copy of this model, with one or more scopes applied.
   *
   * See {@link https://sequelize.org/docs/v7/other-topics/scopes/} to learn more about scopes.
   *
   * @param scopes The scopes to apply.
   *   Scopes can either be passed as consecutive arguments, or as an array of arguments.
   *   To apply simple scopes and scope functions with no arguments, pass them as strings.
   *   For scope function, pass an object, with a `method` property.
   *   The value can either be a string, if the method does not take any arguments, or an array, where the first element is the name of the method, and consecutive elements are arguments to that method. Pass null to remove all scopes, including the default.
   *
   * @returns A copy of this model, with the scopes applied.
   */
  static withScope<M extends Model>(
    this: ModelStatic<M>,
    scopes?: AllowReadonlyArray<string | ScopeOptions> | WhereOptions<Attributes<M>> | Nullish,
  ): ModelStatic<M>;

  /**
   * @deprecated this method has been renamed to {@link Model.withScope} to emphasise the fact that
   *  this method does not mutate the model, but returns a new model.
   */
  static scope<M extends Model>(
    this: ModelStatic<M>,
    scopes?: AllowReadonlyArray<string | ScopeOptions> | WhereOptions<Attributes<M>> | Nullish,
  ): ModelStatic<M>;

  /**
   * @deprecated this method has been renamed to {@link Model.withoutScope} to emphasise the fact that
   *   this method does not mutate the model, and is not the same as {@link Model.withInitialScope}.
   */
  static unscoped<M extends Model>(this: ModelStatic<M>): ModelStatic<M>;

  /**
   * Returns a model without scope. The default scope is also omitted.
   *
   * See {@link https://sequelize.org/docs/v7/other-topics/scopes/} to learn more about scopes.
   *
   * If you want to access the Model Class in its state before any scope was applied, use {@link Model.withInitialScope}.
   */
  static withoutScope<M extends Model>(this: ModelStatic<M>): ModelStatic<M>;

  /**
   * Returns the base model, with its initial scope.
   */
  static withInitialScope<M extends Model>(this: ModelStatic<M>): ModelStatic<M>;

  /**
   * Returns the initial model, the one returned by {@link Model.init} or {@link Sequelize#define},
   * before any scope or schema was applied.
   */
  static getInitialModel<M extends Model>(this: ModelStatic<M>): ModelStatic<M>;

  /**
   * Add a new scope to the model
   *
   * This is especially useful for adding scopes with includes, when the model you want to
   * include is not available at the time this model is defined.
   *
   * By default, this will throw an error if a scope with that name already exists.
   * Use {@link AddScopeOptions.override} in the options object to silence this error.
   *
   * See {@link https://sequelize.org/docs/v7/other-topics/scopes/} to learn more about scopes.
   */
  static addScope<M extends Model>(
    this: ModelStatic<M>,
    name: string,
    scope: FindOptions<Attributes<M>> | ((...args: readonly any[]) => FindOptions<Attributes<M>>),
    options?: AddScopeOptions,
  ): void;

  /**
   * Search for multiple instances.
   * See {@link https://sequelize.org/docs/v7/core-concepts/model-querying-basics/} for more information about querying.
   *
   * __Example of a simple search:__
   * ```js
   * Model.findAll({
   *   where: {
   *     attr1: 42,
   *     attr2: 'cake'
   *   }
   * })
   * ```
   *
   * See also:
   * - {@link Model.findOne}
   * - {@link Sequelize#query}
   *
   * @returns A promise that will resolve with the array containing the results of the SELECT query.
   */
  static findAll<M extends Model, R = Attributes<M>>(
    this: ModelStatic<M>,
    options: Omit<FindOptions<Attributes<M>>, 'raw'> & { raw: true },
  ): Promise<R[]>;
  static findAll<M extends Model>(
    this: ModelStatic<M>,
    options?: FindOptions<Attributes<M>>,
  ): Promise<M[]>;

  /**
   * Search for a single instance.
   *
   * Returns the first instance corresponding matching the query.
   * If not found, returns null or throws an error if {@link FindOptions.rejectOnEmpty} is set.
   */
  static findOne<M extends Model, R = Attributes<M>>(
    this: ModelStatic<M>,
    options: FindOptions<Attributes<M>> & { raw: true; rejectOnEmpty?: false },
  ): Promise<R | null>;
  static findOne<M extends Model, R = Attributes<M>>(
    this: ModelStatic<M>,
    options: NonNullFindOptions<Attributes<M>> & { raw: true },
  ): Promise<R>;
  static findOne<M extends Model>(
    this: ModelStatic<M>,
    options: NonNullFindOptions<Attributes<M>>,
  ): Promise<M>;
  static findOne<M extends Model>(
    this: ModelStatic<M>,
    options?: FindOptions<Attributes<M>>,
  ): Promise<M | null>;

  /**
   * Run an aggregation method on the specified field.
   *
   * Returns the aggregate result cast to {@link AggregateOptions.dataType},
   * unless `options.plain` is false, in which case the complete data result is returned.
   *
   * @param attribute The attribute to aggregate over. Can be a field name or `'*'`
   * @param aggregateFunction The function to use for aggregation, e.g. sum, max etc.
   */
  static aggregate<T, M extends Model>(
    this: ModelStatic<M>,
    attribute: keyof Attributes<M> | '*',
    aggregateFunction: string,
    options?: AggregateOptions<T, Attributes<M>>,
  ): Promise<T>;

  /**
   * Count number of records if group by is used
   *
   * @returns Returns count for each group and the projected attributes.
   */
  static count<M extends Model>(
    this: ModelStatic<M>,
    options: CountWithOptions<Attributes<M>>,
  ): Promise<GroupedCountResultItem[]>;

  /**
   * Count the number of records matching the provided where clause.
   *
   * If you provide an `include` option, the number of matching associations will be counted instead.
   *
   * @returns Returns count for each group and the projected attributes.
   */
  static count<M extends Model>(
    this: ModelStatic<M>,
    options?: Omit<CountOptions<Attributes<M>>, 'group'>,
  ): Promise<number>;

  /**
   * Finds all the rows matching your query, within a specified offset / limit, and get the total number of
   * rows matching your query. This is very useful for pagination.
   *
   * ```js
   * Model.findAndCountAll({
   *   where: ...,
   *   limit: 12,
   *   offset: 12
   * }).then(result => {
   *   ...
   * })
   * ```
   * In the above example, `result.rows` will contain rows 13 through 24, while `result.count` will return
   * the total number of rows that matched your query.
   *
   * When you add includes, only those which are required (either because they have a where clause, or
   * because required` is explicitly set to true on the include) will be added to the count part.
   *
   * Suppose you want to find all users who have a profile attached:
   * ```js
   * User.findAndCountAll({
   *   include: [
   *      { model: Profile, required: true}
   *   ],
   *   limit: 3
   * });
   * ```
   * Because the include for `Profile` has `required` set it will result in an inner join, and only the users
   * who have a profile will be counted. If we remove `required` from the include, both users with and
   * without profiles will be counted
   *
   * This function also support grouping, when `group` is provided, the count will be an array of objects
   * containing the count for each group and the projected attributes.
   * ```js
   * User.findAndCountAll({
   *   group: 'type'
   * });
   * ```
   */
  static findAndCountAll<M extends Model>(
    this: ModelStatic<M>,
    options?: Omit<FindAndCountOptions<Attributes<M>>, 'group' | 'countGroupedRows'>,
  ): Promise<{ rows: M[]; count: number }>;
  static findAndCountAll<M extends Model>(
    this: ModelStatic<M>,
    options: SetRequired<FindAndCountOptions<Attributes<M>>, 'group'>,
  ): Promise<{ rows: M[]; count: GroupedCountResultItem[] }>;

  /**
   * Finds the maximum value of field
   */
  static max<T extends DataType | unknown, M extends Model>(
    this: ModelStatic<M>,
    field: keyof Attributes<M>,
    options?: AggregateOptions<T, Attributes<M>>,
  ): Promise<T | null>;

  /**
   * Finds the minimum value of field
   */
  static min<T extends DataType | unknown, M extends Model>(
    this: ModelStatic<M>,
    field: keyof Attributes<M>,
    options?: AggregateOptions<T, Attributes<M>>,
  ): Promise<T | null>;

  /**
   * Retrieves the sum of field
   */
  static sum<T extends DataType | unknown, M extends Model>(
    this: ModelStatic<M>,
    field: keyof Attributes<M>,
    options?: AggregateOptions<T, Attributes<M>>,
  ): Promise<number | null>;

  /**
   * Builds a new model instance.
   * Unlike {@link Model.create}, the instance is not persisted, you need to call {@link Model#save} yourself.
   *
   * @param record An object of key value pairs.
   * @returns The created instance.
   */
  static build<M extends Model>(
    this: ModelStatic<M>,
    record?: CreationAttributes<M>,
    options?: BuildOptions,
  ): M;

  /**
   * Builds multiple new model instances.
   * Unlike {@link Model.create}, the instances are not persisted, you need to call {@link Model#save} yourself.
   *
   * @param records An array of objects with key value pairs.
   */
  static bulkBuild<M extends Model>(
    this: ModelStatic<M>,
    records: ReadonlyArray<CreationAttributes<M>>,
    options?: BuildOptions,
  ): M[];

  /**
   * Builds a new model instance and persists it.
   * Equivalent to calling {@link Model.build} then {@link Model.save}.
   *
   * @param record Hash of data values to create new record with
   */
  static create<
    M extends Model,
    O extends CreateOptions<Attributes<M>> = CreateOptions<Attributes<M>>,
  >(
    this: ModelStatic<M>,
    record?: CreationAttributes<M>,
    options?: O,
  ): Promise<O extends { returning: false } | { ignoreDuplicates: true } ? void : M>;

  /**
   * Find an entity that matches the query, or build (but don't save) the entity if none is found.
   * The successful result of the promise will be the tuple [instance, initialized].
   *
   * See also {@link Model.findOrCreate} for a version that immediately saves the new entity.
   */
  static findOrBuild<M extends Model>(
    this: ModelStatic<M>,
    options: FindOrBuildOptions<Attributes<M>, CreationAttributes<M>>,
  ): Promise<[entity: M, built: boolean]>;

  /**
   * Find an entity that matches the query, or {@link Model.create} the entity if none is found.
   * The successful result of the promise will be the tuple [instance, initialized].
   *
   * If no transaction is passed in the `options` object, a new transaction will be created internally, to
   * prevent the race condition where a matching row is created by another connection after the find but
   * before the insert call.
   * However, it is not always possible to handle this case in SQLite, specifically if one transaction inserts
   * and another tries to select before the first one has committed.
   * In this case, an instance of {@link TimeoutError} will be thrown instead.
   *
   * If a transaction is passed, a savepoint will be created instead,
   * and any unique constraint violation will be handled internally.
   */
  static findOrCreate<M extends Model>(
    this: ModelStatic<M>,
    options: FindOrCreateOptions<Attributes<M>, CreationAttributes<M>>,
  ): Promise<[entity: M, created: boolean]>;

  /**
   * A more performant {@link Model.findOrCreate} that will not start its own transaction or savepoint (at least not in postgres)
   *
   * It will execute a find call, attempt to create if empty, then attempt to find again if a unique constraint fails.
   *
   * The successful result of the promise will be the tuple [instance, initialized].
   */
  static findCreateFind<M extends Model>(
    this: ModelStatic<M>,
    options: FindOrCreateOptions<Attributes<M>, CreationAttributes<M>>,
  ): Promise<[entity: M, created: boolean]>;

  /**
   * Inserts or updates a single entity. An update will be executed if a row which matches the supplied values on
   * either the primary key or a unique key is found. Note that the unique index must be defined in your
   * sequelize model and not just in the table. Otherwise, you may experience a unique constraint violation,
   * because sequelize fails to identify the row that should be updated.
   *
   * **Implementation details:**
   *
   * * MySQL - Implemented as a single query `INSERT values ON DUPLICATE KEY UPDATE values`
   * * PostgreSQL - Implemented as a temporary function with exception handling: INSERT EXCEPTION WHEN
   *   unique_constraint UPDATE
   * * SQLite - Implemented as two queries `INSERT; UPDATE`. This means that the update is executed regardless
   *   of whether the row already existed or not
   *
   * **Note:** SQLite returns null for created, no matter if the row was created or updated. This is
   * because SQLite always runs INSERT OR IGNORE + UPDATE, in a single query, so there is no way to know
   * whether the row was inserted or not.
   *
   * @returns an array with two elements, the first being the new record and
   *   the second being `true` if it was just created or `false` if it already existed (except on Postgres and SQLite, which
   *   can't detect this and will always return `null` instead of a boolean).
   */
  static upsert<M extends Model>(
    this: ModelStatic<M>,
    values: CreationAttributes<M>,
    options?: UpsertOptions<Attributes<M>>,
  ): Promise<[entity: M, created: boolean | null]>;

  /**
   * Creates and inserts multiple instances in bulk.
   *
   * The promise resolves with an array of instances.
   *
   * Please note that, depending on your dialect, the resulting instances may not accurately
   * represent the state of their rows in the database.
   * This is because MySQL and SQLite do not make it easy to obtain back automatically generated IDs
   * and other default values in a way that can be mapped to multiple records.
   * To obtain the correct data for the newly created instance, you will need to query for them again.
   *
   * If validation fails, the promise is rejected with {@link AggregateError}
   *
   * @param records List of objects (key/value pairs) to create instances from
   */
  static bulkCreate<M extends Model>(
    this: ModelStatic<M>,
    records: ReadonlyArray<CreationAttributes<M>>,
    options?: BulkCreateOptions<Attributes<M>>,
  ): Promise<M[]>;

  /**
   * Truncates the table associated with the model.
   *
   * __Danger__: This will completely empty your table!
   */
  static truncate<M extends Model>(this: ModelStatic<M>, options?: TruncateOptions): Promise<void>;

  /**
   * Deletes multiple instances, or set their deletedAt timestamp to the current time if `paranoid` is enabled.
   *
   * @returns The number of destroyed rows
   */
  static destroy<M extends Model>(
    this: ModelStatic<M>,
    options?: DestroyOptions<Attributes<M>>,
  ): Promise<number>;

  /**
   * Restores multiple paranoid instances.
   * Only usable if {@link ModelOptions.paranoid} is true.
   *
   * See {@link https://sequelize.org/docs/v7/core-concepts/paranoid/} to learn more about soft deletion / paranoid models.
   */
  static restore<M extends Model>(
    this: ModelStatic<M>,
    options?: RestoreOptions<Attributes<M>>,
  ): Promise<void>;

  /**
   * Updates multiple instances that match the where options.
   *
   * The promise resolves with an array of one or two elements:
   * - The first element is always the number of affected rows,
   * - the second element is the list of affected entities (only supported in postgres and mssql with {@link UpdateOptions.returning} true.)
   */
  static update<M extends Model>(
    this: ModelStatic<M>,
    values: UpdateValues<M>,
    options: Omit<UpdateOptions<Attributes<M>>, 'returning'> & {
      returning: Exclude<UpdateOptions<Attributes<M>>['returning'], undefined | false>;
    },
  ): Promise<[affectedCount: number, affectedRows: M[]]>;
  static update<M extends Model>(
    this: ModelStatic<M>,
    values: UpdateValues<M>,
    options: UpdateOptions<Attributes<M>>,
  ): Promise<[affectedCount: number]>;

  /**
   * Runs a 'describe' query on the table.
   *
   * @returns a promise that resolves with a mapping of attributes and their types.
   */
  static describe(schema?: string, options?: Omit<QueryOptions, 'type'>): Promise<object>;

  /**
   * Increments the value of one or more attributes.
   *
   * The increment is done using a `SET column = column + X WHERE foo = 'bar'` query.
   *
   * @example increment number by 1
   * ```javascript
   * Model.increment('number', { where: { foo: 'bar' });
   * ```
   *
   * @example increment number and count by 2
   * ```javascript
   * Model.increment(['number', 'count'], { by: 2, where: { foo: 'bar' } });
   * ```
   *
   * @example increment answer by 42, and decrement tries by 1
   * ```javascript
   * // `by` cannot be used, as each attribute specifies its own value
   * Model.increment({ answer: 42, tries: -1}, { where: { foo: 'bar' } });
   * ```
   *
   * @param fields If a string is provided, that column is incremented by the
   *   value of `by` given in options. If an array is provided, the same is true for each column.
   *   If an object is provided, each key is incremented by the corresponding value, `by` is ignored.
   *
   * @returns an array of affected rows or with affected count if `options.returning` is true, whenever supported by dialect
   */
  static increment<M extends Model>(
    this: ModelStatic<M>,
    fields: AllowReadonlyArray<keyof Attributes<M>>,
    options: IncrementDecrementOptionsWithBy<Attributes<M>>,
  ): Promise<[affectedRows: M[], affectedCount?: number]>;
  static increment<M extends Model>(
    this: ModelStatic<M>,
    fields: { [key in keyof Attributes<M>]?: number },
    options: IncrementDecrementOptions<Attributes<M>>,
  ): Promise<[affectedRows: M[], affectedCount?: number]>;

  /**
   * Decrements the value of one or more attributes.
   *
   * Works like {@link Model.increment}
   *
   * @param fields If a string is provided, that column is incremented by the
   *   value of `by` given in options. If an array is provided, the same is true for each column.
   *   If an object is provided, each key is incremented by the corresponding value, `by` is ignored.
   *
   * @returns an array of affected rows or with affected count if `options.returning` is true, whenever supported by dialect
   *
   * @since 4.36.0
   */
  static decrement<M extends Model>(
    this: ModelStatic<M>,
    fields: AllowReadonlyArray<keyof Attributes<M>>,
    options: IncrementDecrementOptionsWithBy<Attributes<M>>,
  ): Promise<[affectedRows: M[], affectedCount?: number]>;
  static decrement<M extends Model>(
    this: ModelStatic<M>,
    fields: { [key in keyof Attributes<M>]?: number },
    options: IncrementDecrementOptions<Attributes<M>>,
  ): Promise<[affectedRows: M[], affectedCount?: number]>;

  /**
   * Creates a 1:1 association between this model (the source) and the provided target.
   * The foreign key is added on the target model.
   *
   * See {@link https://sequelize.org/docs/v7/core-concepts/assocs/} to learn more about associations.
   *
   * @example
   * ```javascript
   * User.hasOne(Profile)
   * ```
   *
   * @param target The model that will be associated with hasOne relationship
   * @param options hasOne association options
   * @returns The newly defined association (also available in {@link Model.associations}).
   */
  static hasOne<
    S extends Model,
    T extends Model,
    SKey extends AttributeNames<S>,
    TKey extends AttributeNames<T>,
  >(
    this: ModelStatic<S>,
    target: ModelStatic<T>,
    options?: HasOneOptions<SKey, TKey>,
  ): HasOneAssociation<S, T, SKey, TKey>;

  /**
   * Creates an association between this (the source) and the provided target.
   * The foreign key is added on the source Model.
   *
   * See {@link https://sequelize.org/docs/v7/core-concepts/assocs/} to learn more about associations.
   *
   * @example
   * ```javascript
   * Profile.belongsTo(User)
   * ```
   *
   * @param target The model that will be associated with a belongsTo relationship
   * @param options Options for the association
   * @returns The newly defined association (also available in {@link Model.associations}).
   */
  static belongsTo<
    S extends Model,
    T extends Model,
    SKey extends AttributeNames<S>,
    TKey extends AttributeNames<T>,
  >(
    this: ModelStatic<S>,
    target: ModelStatic<T>,
    options?: BelongsToOptions<SKey, TKey>,
  ): BelongsToAssociation<S, T, SKey, TKey>;

  /**
   * Defines a 1:n association between two models.
   * The foreign key is added on the target model.
   *
   * See {@link https://sequelize.org/docs/v7/core-concepts/assocs/} to learn more about associations.
   *
   * @example
   * ```javascript
   * Profile.hasMany(User)
   * ```
   *
   * @param target The model that will be associated with a hasMany relationship
   * @param options Options for the association
   * @returns The newly defined association (also available in {@link Model.associations}).
   */
  static hasMany<
    S extends Model,
    T extends Model,
    SKey extends AttributeNames<S>,
    TKey extends AttributeNames<T>,
  >(
    this: ModelStatic<S>,
    target: ModelStatic<T>,
    options?: HasManyOptions<SKey, TKey>,
  ): HasManyAssociation<S, T, SKey, TKey>;

  /**
   * Create an N:M association with a join table. Defining `through` is required.
   * The foreign key is added on the through model.
   *
   * See {@link https://sequelize.org/docs/v7/core-concepts/assocs/} to learn more about associations.
   *
   * @example
   * ```javascript
   * // Automagically generated join model
   * User.belongsToMany(Project, { through: 'UserProjects' })
   *
   * // Join model with additional attributes
   * const UserProjects = sequelize.define('UserProjects', {
   *   started: DataTypes.BOOLEAN
   * })
   * User.belongsToMany(Project, { through: UserProjects })
   * ```
   *
   * @param target Target model
   * @param options belongsToMany association options
   * @returns The newly defined association (also available in {@link Model.associations}).
   */
  static belongsToMany<
    S extends Model,
    T extends Model,
    ThroughModel extends Model,
    SKey extends AttributeNames<S>,
    TKey extends AttributeNames<T>,
  >(
    this: ModelStatic<S>,
    target: ModelStatic<T>,
    options: BelongsToManyOptions<SKey, TKey, ThroughModel>,
  ): BelongsToManyAssociation<S, T, ThroughModel, SKey, TKey>;

  /**
   * @private
   */
  static _injectDependentVirtualAttributes(attributes: string[]): string[];

  /**
   * Returns true if this instance has not yet been persisted to the database
   */
  isNewRecord: boolean;

  /**
   * Builds a new model instance.
   *
   * @param values an object of key value pairs
   * @param options instance construction options
   */
  constructor(values?: MakeNullishOptional<TCreationAttributes>, options?: BuildOptions);

  /**
   * Returns an object representing the query for this instance, use with `options.where`
   *
   * @param checkVersion include version attribute in where hash
   */
  where(checkVersion?: boolean): WhereOptions;

  /**
   * Returns the underlying data value
   *
   * Unlike {@link Model#get}, this method returns the value as it was retrieved, bypassing
   * getters, cloning, virtual attributes.
   *
   * @param key The name of the attribute to return.
   */
  getDataValue<K extends keyof TModelAttributes>(key: K): TModelAttributes[K];

  /**
   * Updates the underlying data value.
   *
   * Unlike {@link Model#set}, this method skips any special behavior and directly replaces the raw value.
   *
   * @param key The name of the attribute to update.
   * @param value The new value for that attribute.
   */
  setDataValue<K extends keyof TModelAttributes>(key: K, value: TModelAttributes[K]): void;

  /**
   * If no key is given, returns all values of the instance, also invoking virtual getters. If an object has child objects or if options.clone===true, the object will be a copy. Otherwise, it will reference instance.dataValues.
   *
   * If key is given and a field or virtual getter is present for the key it will call that getter - else it
   * will return the value for key.
   *
   */
  get(options?: ModelGetOptions): TModelAttributes;
  get<K extends keyof this>(key: K, options?: ModelGetOptions): this[K];
  get(key: string, options?: ModelGetOptions): unknown;

  /**
   * Set is used to update values on the instance (the sequelize representation of the instance that is,
   * remember that nothing will be persisted before you actually call `save`). In its most basic form `set`
   * will update a value stored in the underlying `dataValues` object. However, if a custom setter function
   * is defined for the key, that function will be called instead. To bypass the setter, you can pass `raw:
   * true` in the options object.
   *
   * If set is called with an object, it will loop over the object, and call set recursively for each key,
   * value pair. If you set raw to true, the underlying dataValues will either be set directly to the object
   * passed, or used to extend dataValues, if dataValues already contain values.
   *
   * When set is called, the previous value of the field is stored and sets a changed flag(see `changed`).
   *
   * Set can also be used to build instances for associations, if you have values for those.
   * When using set with associations you need to make sure the property key matches the alias of the
   * association while also making sure that the proper include options have been set (from .build() or
   * .findOne())
   *
   * If called with a dot.seperated key on a JSON/JSONB attribute it will set the value nested and flag the
   * entire object as changed.
   */
  // TODO: 'key' accepts nested paths for JSON values (json.property)
  set<K extends keyof TModelAttributes>(
    key: K,
    value: TModelAttributes[K],
    options?: SetOptions,
  ): this;
  set(keys: Partial<TModelAttributes>, options?: SetOptions): this;

  /**
   * Alias for {@link Model.set}.
   */
  setAttributes<K extends keyof TModelAttributes>(
    key: K,
    value: TModelAttributes[K],
    options?: SetOptions,
  ): this;
  setAttributes(keys: Partial<TModelAttributes>, options?: SetOptions): this;

  /**
   * If changed is called with a string it will return a boolean indicating whether the value of that key in
   * `dataValues` is different from the value in `_previousDataValues`.
   *
   * If changed is called without an argument, it will return an array of keys that have changed.
   *
   * If changed is called with two arguments, it will set the property to `dirty`.
   *
   * If changed is called without an argument and no keys have changed, it will return `false`.
   */
  // TODO: split this method into:
  //  - hasChanges(): boolean;
  //  - getChanges(): string[];
  //  - isDirty(key: string): boolean;
  //  - setDirty(key: string, dirty: boolean = true): void;
  changed<K extends keyof TModelAttributes>(key: K): boolean;
  changed<K extends keyof TModelAttributes>(key: K, dirty: boolean): void;
  changed(): false | string[];

  /**
   * Returns the previous value for key from `_previousDataValues`.
   */
  previous(): Partial<TModelAttributes>;
  previous<K extends keyof TModelAttributes>(key: K): TModelAttributes[K] | undefined;

  /**
   * Validates this instance, and if the validation passes, persists it to the database.
   *
   * Returns a Promise that resolves to the saved instance (or rejects with a {@link ValidationError},
   * which will have a property for each of the fields for which the validation failed, with the error message for that field).
   *
   * This method is optimized to perform an UPDATE only into the fields that changed.
   * If nothing has changed, no SQL query will be performed.
   *
   * This method is not aware of eager loaded associations.
   * In other words, if some other model instance (child) was eager loaded with this instance (parent),
   * and you change something in the child, calling `save()` will simply ignore the change that happened on the child.
   */
  save(options?: SaveOptions<TModelAttributes>): Promise<this>;

  /**
   * Refreshes the current instance in-place, i.e. update the object with current data from the DB and return
   * the same object. This is different from doing a `find(Instance.id)`, because that would create and
   * return a new instance. With this method, all references to the Instance are updated with the new data
   * and no new objects are created.
   */
  reload(options?: Omit<FindOptions<TModelAttributes>, 'where'>): Promise<this>;

  /**
   * Runs all validators defined for this model, including non-null validators, DataTypes validators, custom attribute validators and model-level validators.
   *
   * If validation fails, this method will throw a {@link ValidationError}.
   */
  validate(options?: ValidationOptions): Promise<void>;

  /**
   * This is the same as calling {@link Model#set} followed by calling {@link Model#save},
   * but it only saves attributes values passed to it, making it safer.
   */
  update<K extends keyof TModelAttributes>(
    attributeName: K,
    value: TModelAttributes[K] | Col | Fn | Literal,
    options?: InstanceUpdateOptions<TModelAttributes>,
  ): Promise<this>;
  update(
    attributes: {
      [key in keyof TModelAttributes]?: TModelAttributes[key] | Fn | Col | Literal;
    },
    options?: InstanceUpdateOptions<TModelAttributes>,
  ): Promise<this>;

  /**
   * Destroys the row corresponding to this instance. Depending on your setting for paranoid, the row will
   * either be completely deleted, or have its deletedAt timestamp set to the current time.
   */
  destroy(options?: InstanceDestroyOptions): Promise<void>;

  /**
   * Restores the row corresponding to this instance.
   * Only available for paranoid models.
   *
   * See {@link https://sequelize.org/docs/v7/core-concepts/paranoid/} to learn more about soft deletion / paranoid models.
   */
  restore(options?: InstanceRestoreOptions): Promise<void>;

  /**
   * Increment the value of one or more columns. This is done in the database, which means it does not use
   * the values currently stored on the Instance. The increment is done using a
   * ```sql
   * SET column = column + X
   * ```
   * query. To get the correct value after an increment into the Instance you should do a reload.
   *
   * ```js
   * instance.increment('number') // increment number by 1
   * instance.increment(['number', 'count'], { by: 2 }) // increment number and count by 2
   * instance.increment({ answer: 42, tries: 1}, { by: 2 }) // increment answer by 42, and tries by 1.
   *                                                        // `by` is ignored, since each column has its own
   *                                                        // value
   * ```
   *
   * @param fields If a string is provided, that column is incremented by the value of `by` given in options.
   *               If an array is provided, the same is true for each column.
   *               If and object is provided, each column is incremented by the value given.
   */
  increment<K extends keyof TModelAttributes>(
    fields: K | readonly K[] | Partial<TModelAttributes>,
    options?: IncrementDecrementOptionsWithBy<TModelAttributes>,
  ): Promise<this>;

  /**
   * Decrement the value of one or more columns. This is done in the database, which means it does not use
   * the values currently stored on the Instance. The decrement is done using a
   * ```sql
   * SET column = column - X
   * ```
   * query. To get the correct value after an decrement into the Instance you should do a reload.
   *
   * ```js
   * instance.decrement('number') // decrement number by 1
   * instance.decrement(['number', 'count'], { by: 2 }) // decrement number and count by 2
   * instance.decrement({ answer: 42, tries: 1}, { by: 2 }) // decrement answer by 42, and tries by 1.
   *                                                        // `by` is ignored, since each column has its own
   *                                                        // value
   * ```
   *
   * @param fields If a string is provided, that column is decremented by the value of `by` given in options.
   *               If an array is provided, the same is true for each column.
   *               If and object is provided, each column is decremented by the value given
   */
  decrement<K extends keyof TModelAttributes>(
    fields: K | readonly K[] | Partial<TModelAttributes>,
    options?: IncrementDecrementOptionsWithBy<TModelAttributes>,
  ): Promise<this>;

  /**
   * Check whether all values of this and `other` Instance are the same
   */
  equals(other: this): boolean;

  /**
   * Check if this is equal to one of `others` by calling equals
   */
  equalsOneOf(others: readonly this[]): boolean;

  /**
   * Convert the instance to a JSON representation. Proxies to calling `get` with no keys. This means get all
   * values gotten from the DB, and apply all custom getters.
   */
  toJSON<T extends TModelAttributes>(): T;
  toJSON(): object;

  /**
   * Returns true if this instance is "soft deleted".
   * Throws an error if {@link ModelOptions.paranoid} is not enabled.
   *
   * See {@link https://sequelize.org/docs/v7/core-concepts/paranoid/} to learn more about soft deletion / paranoid models.
   */
  isSoftDeleted(): boolean;
}

export type ModelDefined<S extends {}, T extends {}> = ModelStatic<Model<S, T>>;

// remove the existing constructor that tries to return `Model<{},{}>` which would be incompatible with models that have typing defined & replace with proper constructor.
export type ModelStatic<M extends Model = Model> = OmitConstructors<typeof Model> & { new (): M };

/**
 * Type will be true is T is branded with Brand, false otherwise
 */
// How this works:
// - `A extends B` will be true if A has *at least* all the properties of B
// - If we do `A extends Omit<A, Checked>` - the result will only be true if A did not have Checked to begin with
// - So if we want to check if T is branded, we remove the brand, and check if they list of keys is still the same.
// we exclude Null & Undefined so "field: Brand<value> | null" is still detected as branded
// this is important because "Brand<value | null>" are transformed into "Brand<value> | null" to not break null & undefined
type IsBranded<T, Brand extends symbol> = keyof NonNullable<T> extends keyof Omit<
  NonNullable<T>,
  Brand
>
  ? false
  : true;

type BrandedKeysOf<T, Brand extends symbol> = {
  [P in keyof T]-?: IsBranded<T[P], Brand> extends true ? P : never;
}[keyof T];

/**
 * Dummy Symbol used as branding by {@link NonAttribute}.
 *
 * Do not export, Do not use.
 *
 * @private
 */
declare const NonAttributeBrand: unique symbol;

/**
 * This is a Branded Type.
 * You can use it to tag fields from your class that are NOT attributes.
 * They will be ignored by {@link InferAttributes} and {@link InferCreationAttributes}
 */
export type NonAttribute<T> =
  // we don't brand null & undefined as they can't have properties.
  // This means `NonAttribute<null>` will not work, but who makes an attribute that only accepts null?
  // Note that `NonAttribute<string | null>` does work!
  T extends null | undefined ? T : T & { [NonAttributeBrand]?: true };

/**
 * Dummy Symbol used as branding by {@link ForeignKey}.
 *
 * Do not export, Do not use.
 *
 * @private
 */
declare const ForeignKeyBrand: unique symbol;

/**
 * This is a Branded Type.
 * You can use it to tag fields from your class that are foreign keys.
 * They will become optional in {@link Model.init} (as foreign keys are added by association methods, like {@link Model.hasMany}.
 */
export type ForeignKey<T> =
  // we don't brand null & undefined as they can't have properties.
  // This means `ForeignKey<null>` will not work, but who makes an attribute that only accepts null?
  // Note that `ForeignKey<string | null>` does work!
  T extends null | undefined ? T : T & { [ForeignKeyBrand]?: true };

/**
 * Option bag for {@link InferAttributes}.
 *
 * - omit: properties to not treat as Attributes.
 */
type InferAttributesOptions<Excluded> = { omit?: Excluded };

/**
 * Utility type to extract Attributes of a given Model class.
 *
 * It returns all instance properties defined in the Model, except:
 * - those inherited from Model (intermediate inheritance works),
 * - the ones whose type is a function,
 * - the ones manually excluded using the second parameter.
 * - the ones branded using {@link NonAttribute}
 *
 * It cannot detect whether something is a getter or not, you should use the `Excluded`
 * parameter to exclude getter & setters from the attribute list.
 *
 * @example
 * ```javascript
 * // listed attributes will be 'id' & 'firstName'.
 * class User extends Model<InferAttributes<User>> {
 *   id: number;
 *   firstName: string;
 * }
 * ```
 *
 * @example
 * ```javascript
 * // listed attributes will be 'id' & 'firstName'.
 * // we're excluding the `name` getter & `projects` attribute using the `omit` option.
 * class User extends Model<InferAttributes<User, { omit: 'name' | 'projects' }>> {
 *   id: number;
 *   firstName: string;
 *
 *   // this is a getter, not an attribute. It should not be listed in attributes.
 *   get name(): string { return this.firstName; }
 *   // this is an association, it should not be listed in attributes
 *   projects?: Project[];
 * }
 * ```
 *
 * @example
 * ```javascript
 * // listed attributes will be 'id' & 'firstName'.
 * // we're excluding the `name` getter & `test` attribute using the `NonAttribute` branded type.
 * class User extends Model<InferAttributes<User>> {
 *   id: number;
 *   firstName: string;
 *
 *   // this is a getter, not an attribute. It should not be listed in attributes.
 *   get name(): NonAttribute<string> { return this.firstName; }
 *   // this is an association, it should not be listed in attributes
 *   projects?: NonAttribute<Project[]>;
 * }
 * ```
 */
export type InferAttributes<
  M extends Model,
  Options extends InferAttributesOptions<keyof M | never | ''> = { omit: never },
> = {
  [Key in keyof M as InternalInferAttributeKeysFromFields<M, Key, Options>]: M[Key];
};

/**
 * Dummy Symbol used as branding by {@link CreationOptional}.
 *
 * Do not export, Do not use.
 *
 * @private
 */
declare const CreationAttributeBrand: unique symbol;

/**
 * This is a Branded Type.
 * You can use it to tag attributes that can be omitted during Model Creation.
 * Use it on attributes that have a default value or are marked as autoIncrement.
 *
 * For use with {@link InferCreationAttributes}.
 *
 * @example
 * ```typescript
 * class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
 *   @Attribute(DataTypes.INTEGER)
 *   @PrimaryKey
 *   @AutoIncrement
 *   declare internalId: CreationOptional<number>;
 *
 *   @Attribute(DataTypes.STRING)
 *   @Default('John Doe')
 *   declare name: CreationOptional<string>;
 * }
 * ```
 */
export type CreationOptional<T> =
  // we don't brand null & undefined as they can't have properties.
  // This means `CreationOptional<null>` will not work, but who makes an attribute that only accepts null?
  // Note that `CreationOptional<string | null>` does work!
  T extends null | undefined ? T : T & { [CreationAttributeBrand]?: true };

/**
 * Utility type to extract Creation Attributes of a given Model class.
 *
 * Works like {@link InferAttributes}, but fields that are tagged using
 *  {@link CreationOptional} will be optional.
 *
 * @example
 * ```javascript
 * class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
 *   // this attribute is optional in Model#create
 *   declare id: CreationOptional<number>;
 *
 *   // this attribute is mandatory in Model#create
 *   declare name: string;
 * }
 * ```
 */
export type InferCreationAttributes<
  M extends Model,
  Options extends InferAttributesOptions<keyof M | never | ''> = { omit: never },
> = {
  [Key in keyof M as InternalInferAttributeKeysFromFields<M, Key, Options>]: IsBranded<
    M[Key],
    typeof CreationAttributeBrand
  > extends true
    ? M[Key] | undefined
    : M[Key];
};

/**
 * @private
 *
 * Internal type used by {@link InferCreationAttributes} and {@link InferAttributes} to exclude
 * attributes that are:
 * - functions
 * - branded using {@link NonAttribute}
 * - inherited from {@link Model}
 * - Excluded manually using the omit option of {@link InferAttributesOptions}
 */
type InternalInferAttributeKeysFromFields<
  M extends Model,
  Key extends keyof M,
  Options extends InferAttributesOptions<keyof M | never | ''>,
> =
  // fields inherited from Model are all excluded
  Key extends keyof Model
    ? never
    : // functions are always excluded
      M[Key] extends AnyFunction
      ? never
      : // fields branded with NonAttribute are excluded
        IsBranded<M[Key], typeof NonAttributeBrand> extends true
        ? never
        : // check 'omit' option is provided & exclude those listed in it
          Options['omit'] extends string
          ? Key extends Options['omit']
            ? never
            : Key
          : Key;

// in v7, we should be able to drop InferCreationAttributes and InferAttributes,
//  resolving this confusion.
/**
 * Returns the creation attributes of a given Model.
 *
 * This returns the Creation Attributes of a Model, it does not build them.
 * If you need to build them, use {@link InferCreationAttributes}.
 *
 * @example
 * ```typescript
 * function buildModel<M extends Model>(modelClass: ModelStatic<M>, attributes: CreationAttributes<M>) {}
 * ```
 */
// TODO: accept Fn & Literal!
export type CreationAttributes<M extends Model> = MakeNullishOptional<M['_creationAttributes']>;

/**
 * Returns the creation attributes of a given Model.
 *
 * This returns the Attributes of a Model that have already been defined, it does not build them.
 * If you need to build them, use {@link InferAttributes}.
 *
 * @example
 * ```typescript
 * function getValue<M extends Model>(modelClass: ModelStatic<M>, attribute: keyof Attributes<M>) {}
 * ```
 */
export type Attributes<M extends Model> = M['_attributes'];

export type AttributeNames<M extends Model> = Extract<keyof M['_attributes'], string>;

export type ExtractMethods<M extends Model> = {
  [K in keyof M as M[K] extends Function ? K : never]: M[K];
};
