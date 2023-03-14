import IndexHints = require('./index-hints');
import { Association, BelongsTo, BelongsToMany, BelongsToManyOptions, BelongsToOptions, HasMany, HasManyOptions, HasOne, HasOneOptions } from './associations/index';
import { DataType } from './data-types';
import { Deferrable } from './deferrable';
import { HookReturn, Hooks, ModelHooks } from './hooks';
import { ValidationOptions } from './instance-validator';
import { IndexesOptions, QueryOptions, TableName } from './dialects/abstract/query-interface';
import { Sequelize, SyncOptions } from './sequelize';
import { Col, Fn, Literal, Where, MakeNullishOptional, AnyFunction, Cast, Json } from './utils';
import { LOCK, Transaction, Op, Optional } from './index';
import { SetRequired } from './utils/set-required';

// Backport of https://github.com/sequelize/sequelize/blob/a68b439fb3ea748d3f3d37356d9fe610f86184f6/src/utils/index.ts#L85
export type AllowReadonlyArray<T> = T | readonly T[];

export interface Logging {
  /**
   * A function that gets executed while running the query to log the sql.
   */
  logging?: boolean | ((sql: string, timing?: number) => void);

  /**
   * Pass query execution time in milliseconds as second argument to logging function (options.logging).
   */
  benchmark?: boolean;
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
   * Transaction to run query under
   */
  transaction?: Transaction | null;
}

export interface SearchPathable {
  /**
   * An optional parameter to specify the schema search_path (Postgres only)
   */
  searchPath?: string;
}

export interface Filterable<TAttributes = any> {
  /**
   * Attribute has to be matched for rows to be selected for the given action.
   */
  where?: WhereOptions<TAttributes>;
}

export interface Projectable {
  /**
   * A list of the attributes that you want to select. To rename an attribute, you can pass an array, with
   * two elements - the first is the name of the attribute in the DB (or some kind of expression such as
   * `Sequelize.literal`, `Sequelize.fn` and so on), and the second is the name you want the attribute to
   * have in the returned instance
   */
  attributes?: FindAttributeOptions;
}

export interface Paranoid {
  /**
   * If true, only non-deleted records will be returned. If false, both deleted and non-deleted records will
   * be returned. Only applies if `options.paranoid` is true for the model.
   */
  paranoid?: boolean;
}

export type GroupOption = string | Fn | Col | (string | Fn | Col)[];

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
export interface SchemaOptions extends Logging {
  /**
   * The character(s) that separates the schema name from the table name
   */
  schemaDelimiter?: string;
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

/**
 * This type allows using `Op.or`, `Op.and`, and `Op.not` recursively around another type.
 * It also supports using a plain Array as an alias for `Op.and`. (unlike {@link AllowNotOrAndRecursive}).
 *
 * Example of plain-array treated as `Op.and`:
 * User.findAll({ where: [{ id: 1 }, { id: 2 }] });
 *
 * Meant to be used by {@link WhereOptions}.
 */
type AllowNotOrAndWithImplicitAndArrayRecursive<T> = AllowArray<
  // this is the equivalent of Op.and
  | T
  | { [Op.or]: AllowArray<AllowNotOrAndWithImplicitAndArrayRecursive<T>> }
  | { [Op.and]: AllowArray<AllowNotOrAndWithImplicitAndArrayRecursive<T>> }
  | { [Op.not]: AllowNotOrAndWithImplicitAndArrayRecursive<T> }
>;

/**
 * This type allows using `Op.or`, `Op.and`, and `Op.not` recursively around another type.
 * Unlike {@link AllowNotOrAndWithImplicitAndArrayRecursive}, it does not allow the 'implicit AND Array'.
 *
 * Example of plain-array NOT treated as Op.and:
 * User.findAll({ where: { id: [1, 2] } });
 *
 * Meant to be used by {@link WhereAttributeHashValue}.
 */
type AllowNotOrAndRecursive<T> =
  | T
  | { [Op.or]: AllowArray<AllowNotOrAndRecursive<T>> }
  | { [Op.and]: AllowArray<AllowNotOrAndRecursive<T>> }
  | { [Op.not]: AllowNotOrAndRecursive<T> };

type AllowArray<T> = T | T[];
type AllowAnyAll<T> =
  | T
  // Op.all: [x, z] results in ALL (ARRAY[x, z])
  // Some things cannot go in ARRAY. Op.values must be used to support them.
  | { [Op.all]: Exclude<T, InvalidInSqlArray>[] | Literal | { [Op.values]: Array<T | DynamicValues<T>> } }
  | { [Op.any]: Exclude<T, InvalidInSqlArray>[] | Literal | { [Op.values]: Array<T | DynamicValues<T>> } };

/**
 * The type accepted by every `where` option
 */
export type WhereOptions<TAttributes = any> = AllowNotOrAndWithImplicitAndArrayRecursive<
  | WhereAttributeHash<TAttributes>
  | Literal
  | Fn
  | Where
  | Json
>;

/**
 * @deprecated unused
 */
export interface AnyOperator {
  [Op.any]: readonly (string | number | Date | Literal)[] | Literal;
}

/** @deprecated unused */
export interface AllOperator {
  [Op.all]: readonly (string | number | Date | Literal)[] | Literal;
}

// number is always allowed because -Infinity & +Infinity are valid
export type Rangable<T> = readonly [
  lower: T | RangePart<T | number> | number | null,
  higher: T | RangePart<T | number> | number | null
] | EmptyRange;

/**
 * This type represents the output of the {@link RANGE} data type.
 */
// number is always allowed because -Infinity & +Infinity are valid
export type Range<T> = readonly [lower: RangePart<T | number>, higher: RangePart<T | number>] | EmptyRange;

type EmptyRange = [];

type RangePart<T> = { value: T, inclusive: boolean };

/**
 * Internal type - prone to changes. Do not export.
 * @private
 */
export type ColumnReference = Col | { [Op.col]: string };

/**
 * Internal type - prone to changes. Do not export.
 * @private
 */
type WhereSerializableValue = boolean | string | number | Buffer | Date;

/**
 * Internal type - prone to changes. Do not export.
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
  | (AcceptableValues extends boolean ? Where : never)

/**
 * Represents acceptable Static values.
 *
 * Static values, as opposed to {@link DynamicValues}. i.e. booleans, strings, etc...
 */
type StaticValues<Type> =
  Type extends Range<infer RangeType> ? [lower: RangeType | RangePart<RangeType>, higher: RangeType | RangePart<RangeType>]
  : Type extends any[] ? { readonly [Key in keyof Type]: StaticValues<Type[Key]>}
  : Type extends null ? Type | WhereSerializableValue | null
  : Type | WhereSerializableValue;

/**
 * Operators that can be used in {@link WhereOptions}
 *
 * @typeParam AttributeType - The JS type of the attribute the operator is operating on.
 *
 * See https://sequelize.org/master/en/v3/docs/querying/#operators
 */
// TODO: default to something more strict than `any` which lists serializable values
export interface WhereOperators<AttributeType = any> {
   /**
    * @example: `[Op.eq]: 6,` becomes `= 6`
    * @example: `[Op.eq]: [6, 7]` becomes `= ARRAY[6, 7]`
    * @example: `[Op.eq]: null` becomes `IS NULL`
    * @example: `[Op.eq]: true` becomes `= true`
    * @example: `[Op.eq]: literal('raw sql')` becomes `= raw sql`
    * @example: `[Op.eq]: col('column')` becomes `= "column"`
    * @example: `[Op.eq]: fn('NOW')` becomes `= NOW()`
    */
  [Op.eq]?: AllowAnyAll<OperatorValues<AttributeType>>;

  /**
   * @example: `[Op.ne]: 20,` becomes `!= 20`
   * @example: `[Op.ne]: [20, 21]` becomes `!= ARRAY[20, 21]`
   * @example: `[Op.ne]: null` becomes `IS NOT NULL`
   * @example: `[Op.ne]: true` becomes `!= true`
   * @example: `[Op.ne]: literal('raw sql')` becomes `!= raw sql`
   * @example: `[Op.ne]: col('column')` becomes `!= "column"`
   * @example: `[Op.ne]: fn('NOW')` becomes `!= NOW()`
   */
  [Op.ne]?: WhereOperators<AttributeType>[typeof Op.eq]; // accepts the same types as Op.eq

  /**
   * @example: `[Op.is]: null` becomes `IS NULL`
   * @example: `[Op.is]: true` becomes `IS TRUE`
   * @example: `[Op.is]: literal('value')` becomes `IS value`
   */
  [Op.is]?: Extract<AttributeType, null | boolean> | Literal;

  /**
   * @example: `[Op.not]: true` becomes `IS NOT TRUE`
   * @example: `{ col: { [Op.not]: { [Op.gt]: 5 } } }` becomes `NOT (col > 5)`
   */
  [Op.not]?: WhereOperators<AttributeType>[typeof Op.eq]; // accepts the same types as Op.eq ('Op.not' is not strictly the opposite of 'Op.is' due to legacy reasons)

  /** @example: `[Op.gte]: 6` becomes `>= 6` */
  [Op.gte]?: AllowAnyAll<OperatorValues<NonNullable<AttributeType>>>;

  /** @example: `[Op.lte]: 10` becomes `<= 10` */
  [Op.lte]?: WhereOperators<AttributeType>[typeof Op.gte]; // accepts the same types as Op.gte

  /** @example: `[Op.lt]: 10` becomes `< 10` */
  [Op.lt]?: WhereOperators<AttributeType>[typeof Op.gte]; // accepts the same types as Op.gte

  /** @example: `[Op.gt]: 6` becomes `> 6` */
  [Op.gt]?: WhereOperators<AttributeType>[typeof Op.gte]; // accepts the same types as Op.gte

  /**
   * @example: `[Op.between]: [6, 10],` becomes `BETWEEN 6 AND 10`
   */
  [Op.between]?:
    | [
      lowerInclusive: OperatorValues<NonNullable<AttributeType>>,
      higherInclusive: OperatorValues<NonNullable<AttributeType>>,
    ]
    | Literal;

  /** @example: `[Op.notBetween]: [11, 15],` becomes `NOT BETWEEN 11 AND 15` */
  [Op.notBetween]?: WhereOperators<AttributeType>[typeof Op.between];

  /** @example: `[Op.in]: [1, 2],` becomes `IN (1, 2)` */
  [Op.in]?: ReadonlyArray<OperatorValues<NonNullable<AttributeType>>> | Literal;

  /** @example: `[Op.notIn]: [1, 2],` becomes `NOT IN (1, 2)` */
  [Op.notIn]?: WhereOperators<AttributeType>[typeof Op.in];

  /**
   * @example: `[Op.like]: '%hat',` becomes `LIKE '%hat'`
   * @example: `[Op.like]: { [Op.any]: ['cat', 'hat'] }` becomes `LIKE ANY ARRAY['cat', 'hat']`
   */
  [Op.like]?: AllowAnyAll<OperatorValues<Extract<AttributeType, string>>>;

  /**
   * @example: `[Op.notLike]: '%hat'` becomes `NOT LIKE '%hat'`
   * @example: `[Op.notLike]: { [Op.any]: ['cat', 'hat']}` becomes `NOT LIKE ANY ARRAY['cat', 'hat']`
   */
  [Op.notLike]?: WhereOperators<AttributeType>[typeof Op.like];

  /**
   * case insensitive PG only
   *
   * @example: `[Op.iLike]: '%hat'` becomes `ILIKE '%hat'`
   * @example: `[Op.iLike]: { [Op.any]: ['cat', 'hat']}` becomes `ILIKE ANY ARRAY['cat', 'hat']`
   */
  [Op.iLike]?: WhereOperators<AttributeType>[typeof Op.like];

  /**
   * PG only
   *
   * @example: `[Op.notILike]: '%hat'` becomes `NOT ILIKE '%hat'`
   * @example: `[Op.notLike]: ['cat', 'hat']` becomes `LIKE ANY ARRAY['cat', 'hat']`
   */
  [Op.notILike]?: WhereOperators<AttributeType>[typeof Op.like];

  /**
   * PG array & range 'overlaps' operator
   *
   * @example: `[Op.overlap]: [1, 2]` becomes `&& [1, 2]`
   */
  // https://www.postgresql.org/docs/14/functions-range.html range && range
  // https://www.postgresql.org/docs/14/functions-array.html array && array
  [Op.overlap]?: AllowAnyAll<
    | (
      // RANGE && RANGE
      AttributeType extends Range<infer RangeType> ? Rangable<RangeType>
      // ARRAY && ARRAY
      : AttributeType extends any[] ? StaticValues<NonNullable<AttributeType>>
      : never
    )
    | DynamicValues<AttributeType>
  >;

  /**
   * PG array & range 'contains' operator
   *
   * @example: `[Op.contains]: [1, 2]` becomes `@> [1, 2]`
   */
  // https://www.postgresql.org/docs/14/functions-json.html jsonb @> jsonb
  // https://www.postgresql.org/docs/14/functions-range.html range @> range ; range @> element
  // https://www.postgresql.org/docs/14/functions-array.html array @> array
  [Op.contains]?:
    // RANGE @> ELEMENT
    | AttributeType extends Range<infer RangeType> ? OperatorValues<OperatorValues<NonNullable<RangeType>>> : never
    // ARRAY @> ARRAY ; RANGE @> RANGE
    | WhereOperators<AttributeType>[typeof Op.overlap];

  /**
   * PG array & range 'contained by' operator
   *
   * @example: `[Op.contained]: [1, 2]` becomes `<@ [1, 2]`
   */
  [Op.contained]?:
    AttributeType extends any[]
      // ARRAY <@ ARRAY ; RANGE <@ RANGE
      ? WhereOperators<AttributeType>[typeof Op.overlap]
      // ELEMENT <@ RANGE
      : AllowAnyAll<OperatorValues<Rangable<AttributeType>>>;

  /**
   * Strings starts with value.
   */
  [Op.startsWith]?: OperatorValues<Extract<AttributeType, string>>;

  /**
   * String ends with value.
   */
  [Op.endsWith]?: WhereOperators<AttributeType>[typeof Op.startsWith];
  /**
   * String contains value.
   */
  [Op.substring]?: WhereOperators<AttributeType>[typeof Op.startsWith];

  /**
   * MySQL/PG only
   *
   * Matches regular expression, case sensitive
   *
   * @example: `[Op.regexp]: '^[h|a|t]'` becomes `REGEXP/~ '^[h|a|t]'`
   */
  [Op.regexp]?: AllowAnyAll<OperatorValues<Extract<AttributeType, string>>>;

  /**
   * MySQL/PG only
   *
   * Does not match regular expression, case sensitive
   *
   * @example: `[Op.notRegexp]: '^[h|a|t]'` becomes `NOT REGEXP/!~ '^[h|a|t]'`
   */
  [Op.notRegexp]?: WhereOperators<AttributeType>[typeof Op.regexp];

  /**
   * PG only
   *
   * Matches regular expression, case insensitive
   *
   * @example: `[Op.iRegexp]: '^[h|a|t]'` becomes `~* '^[h|a|t]'`
   */
  [Op.iRegexp]?: WhereOperators<AttributeType>[typeof Op.regexp];

  /**
   * PG only
   *
   * Does not match regular expression, case insensitive
   *
   * @example: `[Op.notIRegexp]: '^[h|a|t]'` becomes `!~* '^[h|a|t]'`
   */
  [Op.notIRegexp]?: WhereOperators<AttributeType>[typeof Op.regexp];

  /** @example: `[Op.match]: Sequelize.fn('to_tsquery', 'fat & rat')` becomes `@@ to_tsquery('fat & rat')` */
  [Op.match]?: AllowAnyAll<DynamicValues<AttributeType>>;

  /**
   * PG only
   *
   * Whether the range is strictly left of the other range.
   *
   * @example:
   * ```typescript
   * { rangeAttribute: { [Op.strictLeft]: [1, 2] } }
   * // results in
   * // "rangeAttribute" << [1, 2)
   * ```
   *
   * https://www.postgresql.org/docs/14/functions-range.html
   */
  [Op.strictLeft]?:
    | AttributeType extends Range<infer RangeType> ? Rangable<RangeType> : never
    | DynamicValues<AttributeType>;

  /**
   * PG only
   *
   * Whether the range is strictly right of the other range.
   *
   * @example:
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
   * @example:
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
   * @example:
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
   * @example:
   * ```typescript
   * { rangeAttribute: { [Op.adjacent]: [1, 2] } }
   * // results in
   * // "rangeAttribute" -|- [1, 2)
   * ```
   *
   * https://www.postgresql.org/docs/14/functions-range.html
   */
  [Op.adjacent]?: WhereOperators<AttributeType>[typeof Op.strictLeft];
}

/**
 * Example: `[Op.or]: [{a: 5}, {a: 6}]` becomes `(a = 5 OR a = 6)`
 *
 * @deprecated do not use me!
 */
// TODO [>6]: Remove me
export interface OrOperator<TAttributes = any> {
  [Op.or]: WhereOptions<TAttributes> | readonly WhereOptions<TAttributes>[] | WhereValue<TAttributes> | readonly WhereValue<TAttributes>[];
}

/**
 * Example: `[Op.and]: {a: 5}` becomes `AND (a = 5)`
 *
 * @deprecated do not use me!
 */
// TODO [>6]: Remove me
export interface AndOperator<TAttributes = any> {
  [Op.and]: WhereOptions<TAttributes> | readonly WhereOptions<TAttributes>[] | WhereValue<TAttributes> | readonly WhereValue<TAttributes>[];
}

/**
 * Where Geometry Options
 */
export interface WhereGeometryOptions {
  type: string;
  coordinates: readonly (number[] | number)[];
}

/**
 * Used for the right hand side of WhereAttributeHash.
 * WhereAttributeHash is in there for JSON columns.
 *
 * @deprecated do not use me
 */
// TODO [>6]: remove this
export type WhereValue<TAttributes = any> =
  | string
  | number
  | bigint
  | boolean
  | Date
  | Buffer
  | null
  | WhereAttributeHash<any> // for JSON columns
  | Col // reference another column
  | Fn
  | WhereGeometryOptions

/**
 * A hash of attributes to describe your search.
 *
 * Possible key values:
 *
 * - An attribute name: `{ id: 1 }`
 * - A nested attribute: `{ '$projects.id$': 1 }`
 * - A JSON key: `{ 'object.key': 1 }`
 * - A cast: `{ 'id::integer': 1 }`
 *
 * - A combination of the above: `{ '$join.attribute$.json.path::integer': 1 }`
 */
export type WhereAttributeHash<TAttributes = any> = {
  // support 'attribute' & '$attribute$'
  [AttributeName in keyof TAttributes as AttributeName extends string ? AttributeName | `$${AttributeName}$` : never]?: WhereAttributeHashValue<TAttributes[AttributeName]>;
} & {
  [AttributeName in keyof TAttributes as AttributeName extends string ?
    // support 'json.path', '$json$.path'
    | `${AttributeName}.${string}` | `$${AttributeName}$.${string}`
    // support 'attribute::cast', '$attribute$::cast', 'json.path::cast' & '$json$.path::cast'
    | `${AttributeName | `$${AttributeName}$` | `${AttributeName}.${string}` | `$${AttributeName}$.${string}`}::${string}`
  : never]?: WhereAttributeHashValue<any>;
} & {
  // support '$nested.attribute$', '$nested.attribute$::cast', '$nested.attribute$.json.path', & '$nested.attribute$.json.path::cast'
  // TODO [2022-05-26]: Remove this ts-ignore once we drop support for TS < 4.4
  // TypeScript < 4.4 does not support using a Template Literal Type as a key.
  //  note: this *must* be a ts-ignore, as it works in ts >= 4.4
  // @ts-ignore
  [attribute: `$${string}.${string}$` | `$${string}.${string}$::${string}` | `$${string}.${string}$.${string}` | `$${string}.${string}$.${string}::${string}`]: WhereAttributeHashValue<any>;
}

/**
 * Types that can be compared to an attribute in a WHERE context.
 */
export type WhereAttributeHashValue<AttributeType> =
  | AllowNotOrAndRecursive<
    // if the right-hand side is an array, it will be equal to Op.in
    // otherwise it will be equal to Op.eq
    // Exception: array attribtues always use Op.eq, never Op.in.
    | AttributeType extends any[]
      ? WhereOperators<AttributeType>[typeof Op.eq] | WhereOperators<AttributeType>
      : (
        | WhereOperators<AttributeType>[typeof Op.in]
        | WhereOperators<AttributeType>[typeof Op.eq]
        | WhereOperators<AttributeType>
      )
    >
  // TODO: this needs a simplified version just for JSON columns
  | WhereAttributeHash<any> // for JSON columns

/**
 * Through options for Include Options
 */
export interface IncludeThroughOptions extends Filterable<any>, Projectable {
  /**
   * The alias of the relation, in case the model you want to eagerly load is aliassed. For `hasOne` /
   * `belongsTo`, this should be the singular name, and for `hasMany`, it should be the plural
   */
  as?: string;

  /**
   * If true, only non-deleted records will be returned from the join table.
   * If false, both deleted and non-deleted records will be returned.
   * Only applies if through model is paranoid.
   */
  paranoid?: boolean;
}

/**
 * Options for eager-loading associated models, also allowing for all associations to be loaded at once
 */
export type Includeable = ModelType | Association | IncludeOptions | { all: true, nested?: true } | string;

/**
 * Complex include options
 */
export interface IncludeOptions extends Filterable<any>, Projectable, Paranoid {
  /**
   * Mark the include as duplicating, will prevent a subquery from being used.
   */
  duplicating?: boolean;
  /**
   * The model you want to eagerly load
   */
  model?: ModelType;

  /**
   * The alias of the relation, in case the model you want to eagerly load is aliassed. For `hasOne` /
   * `belongsTo`, this should be the singular name, and for `hasMany`, it should be the plural
   */
  as?: string;

  /**
   * The association you want to eagerly load. (This can be used instead of providing a model/as pair)
   */
  association?: Association | string;

  /**
   * Custom `on` clause, overrides default.
   */
  on?: WhereOptions<any>;

  /**
   * Note that this converts the eager load to an inner join,
   * unless you explicitly set `required: false`
   */
  where?: WhereOptions<any>;

  /**
   * If true, converts to an inner join, which means that the parent model will only be loaded if it has any
   * matching children. True if `include.where` is set, false otherwise.
   */
  required?: boolean;

  /**
   * If true, converts to a right join if dialect support it. Ignored if `include.required` is true.
   */
  right?: boolean;

  /**
   * Limit include. Only available when setting `separate` to true.
   */
  limit?: number;

  /**
   * Run include in separate queries.
   */
  separate?: boolean;

  /**
   * Through Options
   */
  through?: IncludeThroughOptions;

  /**
   * Load further nested related models
   */
  include?: Includeable[];

  /**
   * Order include. Only available when setting `separate` to true.
   */
  order?: Order;

  /**
   * Use sub queries. This should only be used if you know for sure the query does not result in a cartesian product.
   */
  subQuery?: boolean;
}

type OrderItemAssociation = Association | ModelStatic<Model> | { model: ModelStatic<Model>; as: string } | string
type OrderItemColumn = string | Col | Fn | Literal
export type OrderItem =
  | string
  | Fn
  | Col
  | Literal
  | [OrderItemColumn, string]
  | [OrderItemAssociation, OrderItemColumn]
  | [OrderItemAssociation, OrderItemColumn, string]
  | [OrderItemAssociation, OrderItemAssociation, OrderItemColumn]
  | [OrderItemAssociation, OrderItemAssociation, OrderItemColumn, string]
  | [OrderItemAssociation, OrderItemAssociation, OrderItemAssociation, OrderItemColumn]
  | [OrderItemAssociation, OrderItemAssociation, OrderItemAssociation, OrderItemColumn, string]
  | [OrderItemAssociation, OrderItemAssociation, OrderItemAssociation, OrderItemAssociation, OrderItemColumn]
  | [OrderItemAssociation, OrderItemAssociation, OrderItemAssociation, OrderItemAssociation, OrderItemColumn, string]
export type Order = Fn | Col | Literal | OrderItem[];

/**
 * Please note if this is used the aliased property will not be available on the model instance
 * as a property but only via `instance.get('alias')`.
 */
export type ProjectionAlias = readonly [string | Literal | Fn | Col, string];

export type FindAttributeOptions =
  | (string | ProjectionAlias)[]
  | {
    exclude: string[];
    include?: (string | ProjectionAlias)[];
  }
  | {
    exclude?: string[];
    include: (string | ProjectionAlias)[];
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

/**
 * Options that are passed to any model creating a SELECT query
 *
 * A hash of options to describe the scope of the search
 */
export interface FindOptions<TAttributes = any>
  extends QueryOptions, Filterable<TAttributes>, Projectable, Paranoid, IndexHintable
{
  /**
   * A list of associations to eagerly load using a left join (a single association is also supported). Supported is either
   * `{ include: Model1 }`, `{ include: [ Model1, Model2, ...]}`, `{ include: [{ model: Model1, as: 'Alias' }]}` or
   * `{ include: [{ all: true }]}`.
   * If your association are set up with an `as` (eg. `X.hasMany(Y, { as: 'Z' }`, you need to specify Z in
   * the as attribute when eager loading Y).
   */
  include?: Includeable | Includeable[];

  /**
   * Specifies an ordering. If a string is provided, it will be escaped. Using an array, you can provide
   * several columns / functions to order by. Each element can be further wrapped in a two-element array. The
   * first element is the column / function to order by, the second is the direction. For example:
   * `order: [['name', 'DESC']]`. In this way the column will be escaped, but the direction will not.
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
   * // in the following query, `limit` only affects the "User" model.
   * // This will return 2 users, each including all of their projects.
   * User.findAll({
   *   limit: 2,
   *   include: [User.associations.projects],
   * });
   *
   * @example
   * // in the following query, `limit` affects the total number of returned values, eager-loaded associations included.
   * // This may return 2 users, each with one project,
   * //  or 1 user with 2 projects.
   * User.findAll({
   *   limit: 2,
   *   include: [User.associations.projects],
   *   subQuery: false,
   * });
   */
  limit?: number;

  // TODO: document this - this is an undocumented property but it exists and there are tests for it.
  groupedLimit?: unknown;

  /**
   * Skip the results;
   */
  offset?: number;

  /**
   * Lock the selected rows. Possible options are transaction.LOCK.UPDATE and transaction.LOCK.SHARE.
   * Postgres also supports transaction.LOCK.KEY_SHARE, transaction.LOCK.NO_KEY_UPDATE and specific model
   * locks with joins. See [transaction.LOCK for an example](transaction#lock)
   */
  lock?:
  | LOCK
  | { level: LOCK; of: ModelStatic<Model> }
  | boolean;
  /**
   * Skip locked rows. Only supported in Postgres.
   */
  skipLocked?: boolean;

  /**
   * Return raw result. See sequelize.query for more information.
   */
  raw?: boolean;

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
}

export interface NonNullFindOptions<TAttributes = any> extends FindOptions<TAttributes> {
  /**
   * Throw if nothing was found.
   */
  rejectOnEmpty: boolean | Error;
}

/**
 * Options for Model.count method
 */
export interface CountOptions<TAttributes = any>
  extends Logging, Transactionable, Filterable<TAttributes>, Projectable, Paranoid, Poolable
{
  /**
   * Include options. See `find` for details
   */
  include?: Includeable | Includeable[];

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
   * The column to aggregate on.
   */
  col?: string;
}

/**
 * Options for Model.count when GROUP BY is used
 */
export type CountWithOptions<TAttributes = any> = SetRequired<CountOptions<TAttributes>, 'group'>

export interface FindAndCountOptions<TAttributes = any> extends CountOptions<TAttributes>, FindOptions<TAttributes> { }

export interface GroupedCountResultItem {
  [key: string]: unknown // projected attributes
  count: number // the count for each group
}

/**
 * Options for Model.build method
 */
export interface BuildOptions {
  /**
   * If set to true, values will ignore field and virtual setters.
   */
  raw?: boolean;

  /**
   * Is this record new
   */
  isNewRecord?: boolean;

  /**
   * An array of include options. A single option is also supported - Used to build prefetched/included model instances. See `set`
   *
   * TODO: See set
   */
  include?: Includeable | Includeable[];
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
export interface CreateOptions<TAttributes = any> extends BuildOptions, Logging, Silent, Transactionable, Hookable {
  /**
   * If set, only columns matching those in fields will be saved
   */
  fields?: (keyof TAttributes)[];

  /**
   * dialect specific ON CONFLICT DO NOTHING / INSERT IGNORE
   */
  ignoreDuplicates?: boolean;

  /**
   * Return the affected rows (only for postgres)
   */
  returning?: boolean | (keyof TAttributes)[];

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
   */
  hooks?: boolean

}

/**
 * Options for Model.findOrCreate method
 */
export interface FindOrCreateOptions<TAttributes = any, TCreationAttributes = TAttributes>
  extends FindOptions<TAttributes>, CreateOptions<TAttributes>
{
  /**
   * Default values to use if building a new instance
   */
  defaults?: TCreationAttributes;
}

/**
 * Options for Model.findOrBuild method
 */
export interface FindOrBuildOptions<TAttributes = any, TCreationAttributes = TAttributes>
  extends FindOptions<TAttributes>, BuildOptions
{
  /**
   * Default values to use if building a new instance
   */
  defaults?: TCreationAttributes;
}

/**
 * Options for Model.upsert method
 */
export interface UpsertOptions<TAttributes = any> extends Logging, Transactionable, SearchPathable, Hookable {
  /**
   * The fields to insert / update. Defaults to all fields
   */
  fields?: (keyof TAttributes)[];

  /**
   * Return the affected rows (only for postgres)
   */
  returning?: boolean | (keyof TAttributes)[];

  /**
   * Run validations before the row is inserted
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
   conflictFields?: (keyof TAttributes)[];
}

/**
 * Options for Model.bulkCreate method
 */
export interface BulkCreateOptions<TAttributes = any> extends Logging, Transactionable, Hookable, SearchPathable {
  /**
   * Fields to insert (defaults to all fields)
   */
  fields?: (keyof TAttributes)[];

  /**
   * Should each row be subject to validation before it is inserted. The whole insert will fail if one row
   * fails validation
   */
  validate?: boolean;

  /**
   * Run before / after create hooks for each individual Instance? BulkCreate hooks will still be run if
   * options.hooks is true.
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
  updateOnDuplicate?: (keyof TAttributes)[];

  /**
   * Include options. See `find` for details
   */
  include?: Includeable | Includeable[];

  /**
   * Return all columns or only the specified columns for the affected rows (only for postgres)
   */
  returning?: boolean | (keyof TAttributes)[];
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
 * The options passed to Model.destroy in addition to truncate
 */
export interface TruncateOptions<TAttributes = any> extends Logging, Transactionable, Filterable<TAttributes>, Hookable {
  /**
   * Only used in conjuction with TRUNCATE. Truncates  all tables that have foreign-key references to the
   * named table, or to any tables added to the group due to CASCADE.
   *
   * @default false;
   */
  cascade?: boolean;

  /**
   * If set to true, destroy will SELECT all records matching the where parameter and will execute before /
   * after destroy hooks on each row
   */
  individualHooks?: boolean;

  /**
   * How many rows to delete
   */
  limit?: number;

  /**
   * Delete instead of setting deletedAt to current timestamp (only applicable if `paranoid` is enabled)
   */
  force?: boolean;

  /**
   * Only used in conjunction with `truncate`.
   * Automatically restart sequences owned by columns of the truncated table
   */
  restartIdentity?: boolean;
}

/**
 * Options used for Model.destroy
 */
export interface DestroyOptions<TAttributes = any> extends TruncateOptions<TAttributes> {
  /**
   * If set to true, dialects that support it will use TRUNCATE instead of DELETE FROM. If a table is
   * truncated the where and limit options are ignored
   */
  truncate?: boolean;
}

/**
 * Options for Model.restore
 */
export interface RestoreOptions<TAttributes = any> extends Logging, Transactionable, Filterable<TAttributes>, Hookable {

  /**
   * If set to true, restore will find all records within the where parameter and will execute before / after
   * bulkRestore hooks on each row
   */
  individualHooks?: boolean;

  /**
   * How many rows to undelete
   */
  limit?: number;
}

/**
 * Options used for Model.update
 */
export interface UpdateOptions<TAttributes = any> extends Logging, Transactionable, Paranoid, Hookable {
  /**
   * Options to describe the scope of the search.
   */
  where: WhereOptions<TAttributes>;

  /**
   * Fields to update (defaults to all fields)
   */
  fields?: (keyof TAttributes)[];

  /**
   * Should each row be subject to validation before it is inserted. The whole insert will fail if one row
   * fails validation.
   *
   * @default true
   */
  validate?: boolean;

  /**
   * Whether or not to update the side effects of any virtual setters.
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
   */
  returning?: boolean | (keyof TAttributes)[];

  /**
   * How many rows to update (only for mysql and mariadb)
   */
  limit?: number;

  /**
   * If true, the updatedAt timestamp will not be updated.
   */
  silent?: boolean;
}

/**
 * Options used for Model.aggregate
 */
export interface AggregateOptions<T extends DataType | unknown, TAttributes = any>
  extends QueryOptions, Filterable<TAttributes>, Paranoid
{
  /**
   * The type of the result. If `field` is a field in this Model, the default will be the type of that field,
   * otherwise defaults to float.
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
  extends Logging, Transactionable, Silent, SearchPathable, Filterable<TAttributes> { }

/**
 * Options used for Instance.increment method
 */
export interface IncrementDecrementOptionsWithBy<TAttributes = any> extends IncrementDecrementOptions<TAttributes> {
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
export interface InstanceRestoreOptions extends Logging, Transactionable { }

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
export interface InstanceUpdateOptions<TAttributes = any> extends
  SaveOptions<TAttributes>, SetOptions, Filterable<TAttributes> { }

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
export interface SaveOptions<TAttributes = any> extends Logging, Transactionable, Silent, Hookable {
  /**
   * An optional array of strings, representing database columns. If fields is provided, only those columns
   * will be validated and saved.
   */
  fields?: (keyof TAttributes)[];

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
export interface ModelValidateOptions {
  /**
   * - `{ is: ['^[a-z]+$','i'] }` will only allow letters
   * - `{ is: /^[a-z]+$/i }` also only allows letters
   */
  is?: string | readonly (string | RegExp)[] | RegExp | { msg: string; args: string | readonly (string | RegExp)[] | RegExp };

  /**
   * - `{ not: ['[a-z]','i'] }` will not allow letters
   */
  not?: string | readonly (string | RegExp)[] | RegExp | { msg: string; args: string | readonly (string | RegExp)[] | RegExp };

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
  notNull?: boolean | { msg: string };

  /**
   * only allows null
   */
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
 * Interface for indexes property in InitOptions
 */
export type ModelIndexesOptions = IndexesOptions

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
 * Interface for getterMethods in InitOptions
 */
export interface ModelGetterOptions<M extends Model = Model> {
  [name: string]: (this: M) => unknown;
}

/**
 * Interface for setterMethods in InitOptions
 */
export interface ModelSetterOptions<M extends Model = Model> {
  [name: string]: (this: M, val: any) => void;
}

/**
 * Interface for Define Scope Options
 */
export interface ModelScopeOptions<TAttributes = any> {
  /**
   * Name of the scope and it's query
   */
  [scopeName: string]: FindOptions<TAttributes> | ((...args: readonly any[]) => FindOptions<TAttributes>);
}

/**
 * General column options
 */
export interface ColumnOptions {
  /**
   * If false, the column will have a NOT NULL constraint, and a not null validation will be run before an
   * instance is saved.
   *
   * @default true
   */
  allowNull?: boolean;

  /**
   *  If set, sequelize will map the attribute name to a different name in the database
   */
  field?: string;

  /**
   * A literal default value, a JavaScript function, or an SQL function (see `sequelize.fn`)
   */
  defaultValue?: unknown;
}

/**
 * References options for the column's attributes
 */
export interface ModelAttributeColumnReferencesOptions {
  /**
   * If this column references another table, provide it here as a Model, or a string
   */
  model?: TableName | ModelType;

  /**
   * The column of the foreign table that this column references
   */
  key?: string;

  /**
   * When to check for the foreign key constraing
   *
   * PostgreSQL only
   */
  deferrable?: Deferrable;
}

/**
 * Column options for the model schema attributes
 */
export interface ModelAttributeColumnOptions<M extends Model = Model> extends ColumnOptions {
  /**
   * A string or a data type
   */
  type: DataType;

  /**
   * If true, the column will get a unique constraint. If a string is provided, the column will be part of a
   * composite unique index. If multiple columns have the same string, they will be part of the same unique
   * index
   */
  unique?: boolean | string | { name: string; msg: string };

  /**
   * Primary key flag
   */
  primaryKey?: boolean;

  /**
   * Is this field an auto increment field
   */
  autoIncrement?: boolean;

  /**
   * If this field is a Postgres auto increment field, use Postgres `GENERATED BY DEFAULT AS IDENTITY` instead of `SERIAL`. Postgres 10+ only.
   */
  autoIncrementIdentity?: boolean;

  /**
   * Comment for the database
   */
  comment?: string;

  /**
   * An object with reference configurations or the column name as string
   */
  references?: string | ModelAttributeColumnReferencesOptions;

  /**
   * What should happen when the referenced key is updated. One of CASCADE, RESTRICT, SET DEFAULT, SET NULL or
   * NO ACTION
   */
  onUpdate?: string;

  /**
   * What should happen when the referenced key is deleted. One of CASCADE, RESTRICT, SET DEFAULT, SET NULL or
   * NO ACTION
   */
  onDelete?: string;


  /**
   * An object of validations to execute for this column every time the model is saved. Can be either the
   * name of a validation provided by validator.js, a validation function provided by extending validator.js
   * (see the
   * `DAOValidator` property for more details), or a custom validation function. Custom validation functions
   * are called with the value of the field, and can possibly take a second callback argument, to signal that
   * they are asynchronous. If the validator is sync, it should throw in the case of a failed validation, it
   * it is async, the callback should be called with the error text.
   */
  validate?: ModelValidateOptions;

  /**
   * Usage in object notation
   *
   * ```js
   * class MyModel extends Model {}
   * MyModel.init({
   *   states: {
   *     type:   Sequelize.ENUM,
   *     values: ['active', 'pending', 'deleted']
   *   }
   * }, { sequelize })
   * ```
   */
  values?: readonly string[];

  /**
   * Provide a custom getter for this column. Use `this.getDataValue(String)` to manipulate the underlying
   * values.
   */
  get?(this: M): unknown;

  /**
   * Provide a custom setter for this column. Use `this.setDataValue(String, Value)` to manipulate the
   * underlying values.
   */
  set?(this: M, val: unknown): void;
}

/**
 * Interface for Attributes provided for all columns in a model
 */
export type ModelAttributes<M extends Model = Model, TAttributes = any> = {
  /**
   * The description of a database column
   */
  [name in keyof TAttributes]: DataType | ModelAttributeColumnOptions<M>;
}

/**
 * Possible types for primary keys
 */
export type Identifier = number | bigint | string | Buffer;

/**
 * Options for model definition
 */
export interface ModelOptions<M extends Model = Model> {
  /**
   * Define the default search scope to use for this model. Scopes have the same form as the options passed to
   * find / findAll.
   */
  defaultScope?: FindOptions<Attributes<M>>;

  /**
   * More scopes, defined in the same way as defaultScope above. See `Model.scope` for more information about
   * how scopes are defined, and what you can do with them
   */
  scopes?: ModelScopeOptions<Attributes<M>>;

  /**
   * Don't persits null values. This means that all columns with null values will not be saved.
   */
  omitNull?: boolean;

  /**
   * Adds createdAt and updatedAt timestamps to the model. Default true.
   */
  timestamps?: boolean;

  /**
   * Calling destroy will not delete the model, but instead set a deletedAt timestamp if this is true. Needs
   * timestamps=true to work. Default false.
   */
  paranoid?: boolean;

  /**
   * Converts all camelCased columns to underscored if true. Default false.
   */
  underscored?: boolean;

  /**
   * Indicates if the model's table has a trigger associated with it. Default false.
   */
  hasTrigger?: boolean;

  /**
   * If freezeTableName is true, sequelize will not try to alter the DAO name to get the table name.
   * Otherwise, the dao name will be pluralized. Default false.
   */
  freezeTableName?: boolean;

  /**
   * An object with two attributes, `singular` and `plural`, which are used when this model is associated to
   * others.
   */
  name?: ModelNameOptions;

  /**
   * Set name of the model. By default its same as Class name.
   */
  modelName?: string;

  /**
   * Indexes for the provided database table
   */
  indexes?: readonly ModelIndexesOptions[];

  /**
   * Override the name of the createdAt column if a string is provided, or disable it if false. Timestamps
   * must be true. Not affected by underscored setting.
   */
  createdAt?: string | boolean;

  /**
   * Override the name of the deletedAt column if a string is provided, or disable it if false. Timestamps
   * must be true. Not affected by underscored setting.
   */
  deletedAt?: string | boolean;

  /**
   * Override the name of the updatedAt column if a string is provided, or disable it if false. Timestamps
   * must be true. Not affected by underscored setting.
   */
  updatedAt?: string | boolean;

  /**
   * @default pluralized model name, unless freezeTableName is true, in which case it uses model name
   * verbatim
   */
  tableName?: string;

  schema?: string;

  /**
   * You can also change the database engine, e.g. to MyISAM. InnoDB is the default.
   */
  engine?: string;

  charset?: string;

  /**
   * Finaly you can specify a comment for the table in MySQL and PG
   */
  comment?: string;

  collate?: string;

  /**
   * Set the initial AUTO_INCREMENT value for the table in MySQL.
   */
  initialAutoIncrement?: string;

  /**
   * An object of hook function that are called before and after certain lifecycle events.
   * See Hooks for more information about hook
   * functions and their signatures. Each property can either be a function, or an array of functions.
   */
  hooks?: Partial<ModelHooks<M, Attributes<M>>>;

  /**
   * An object of model wide validations. Validations have access to all model values via `this`. If the
   * validator function takes an argument, it is asumed to be async, and is called with a callback that
   * accepts an optional error.
   */
  validate?: ModelValidateOptions;

  /**
   * Allows defining additional setters that will be available on model instances.
   */
  setterMethods?: ModelSetterOptions<M>;

  /**
   * Allows defining additional getters that will be available on model instances.
   */
  getterMethods?: ModelGetterOptions<M>;

  /**
   * Enable optimistic locking.
   * When enabled, sequelize will add a version count attribute to the model and throw an
   * OptimisticLockingError error when stale instances are saved.
   * - If string: Uses the named attribute.
   * - If boolean: Uses `version`.
   *
   * @default false
   */
  version?: boolean | string;

  /**
   * Specify the scopes merging strategy (default 'overwrite'). Valid values are 'and' and 'overwrite'.
   * When the 'and' strategy is set, scopes will be grouped using the Op.and operator.
   * For instance merging scopes containing `{ where: { myField: 1 }}` and `{ where: { myField: 2 }}` will result in
   * `{ where: { [Op.and]: [{ myField: 1 }, { myField: 2 }] } }`.
   * When the 'overwrite' strategy is set, scopes containing the same attribute in a where clause will be overwritten by the lastly defined one.
   * For instance merging scopes containing `{ where: { myField: 1 }}` and `{ where: { myField: 2 }}` will result in
   * `{ where: { myField: 2 } }`.
   *
   * @default false
   */
  whereMergeStrategy?: 'and' | 'overwrite';
}

/**
 * Options passed to [[Model.init]]
 */
export interface InitOptions<M extends Model = Model> extends ModelOptions<M> {
  /**
   * The sequelize connection. Required ATM.
   */
  sequelize: Sequelize;
}

/**
 * AddScope Options for Model.addScope
 */
export interface AddScopeOptions {
  /**
   * If a scope of the same name already exists, should it be overwritten?
   */
  override: boolean;
}

export abstract class Model<TModelAttributes extends {} = any, TCreationAttributes extends {} = TModelAttributes>
  extends Hooks<Model<TModelAttributes, TCreationAttributes>, TModelAttributes, TCreationAttributes>
{
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

  /** The name of the database table */
  public static readonly tableName: string;

  /**
   * The name of the primary key attribute
   */
  public static readonly primaryKeyAttribute: string;

  /**
   * The name of the primary key attributes
   */
  public static readonly primaryKeyAttributes: readonly string[];

  /**
   * An object hash from alias to association object
   */
  public static readonly associations: {
    [key: string]: Association;
  };

  /**
   * The options that the model was initialized with
   */
  public static readonly options: InitOptions;

  // TODO [>7]: Remove `rawAttributes` in v8
  /**
   * The attributes of the model.
   *
   * @deprecated use {@link Model.getAttributes} for better typings.
   */
  public static readonly rawAttributes: { [attribute: string]: ModelAttributeColumnOptions };

  /**
   * Returns the attributes of the model
   */
  public static getAttributes<M extends Model>(this: ModelStatic<M>): {
    readonly [Key in keyof Attributes<M>]: ModelAttributeColumnOptions
  };

  /**
   * Reference to the sequelize instance the model was initialized with
   */
  public static readonly sequelize?: Sequelize;

  /**
   * Initialize a model, representing a table in the DB, with attributes and options.
   *
   * The table columns are define by the hash that is given as the second argument. Each attribute of the hash represents a column. A short table definition might look like this:
   *
   * ```js
   * Project.init({
   *   columnA: {
   *     type: Sequelize.BOOLEAN,
   *     validate: {
   *       is: ['[a-z]','i'],        // will only allow letters
   *       max: 23,                  // only allow values <= 23
   *       isIn: {
   *         args: [['en', 'zh']],
   *         msg: "Must be English or Chinese"
   *       }
   *     },
   *     field: 'column_a'
   *     // Other attributes here
   *   },
   *   columnB: Sequelize.STRING,
   *   columnC: 'MY VERY OWN COLUMN TYPE'
   * }, {sequelize})
   *
   * sequelize.models.modelName // The model will now be available in models under the class name
   * ```
   *
   * As shown above, column definitions can be either strings, a reference to one of the datatypes that are predefined on the Sequelize constructor, or an object that allows you to specify both the type of the column, and other attributes such as default values, foreign key constraints and custom setters and getters.
   *
   * For a list of possible data types, see https://sequelize.org/master/en/latest/docs/models-definition/#data-types
   *
   * For more about getters and setters, see https://sequelize.org/master/en/latest/docs/models-definition/#getters-setters
   *
   * For more about instance and class methods, see https://sequelize.org/master/en/latest/docs/models-definition/#expansion-of-models
   *
   * For more about validation, see https://sequelize.org/master/en/latest/docs/models-definition/#validations
   *
   * @param attributes
   *  An object, where each attribute is a column of the table. Each column can be either a DataType, a
   *  string or a type-description object, with the properties described below:
   * @param options These options are merged with the default define options provided to the Sequelize constructor
   * @returns Return the initialized model
   */
  public static init<MS extends ModelStatic<Model>, M extends InstanceType<MS>>(
    this: MS,
    attributes: ModelAttributes<
      M,
      // 'foreign keys' are optional in Model.init as they are added by association declaration methods
      Optional<Attributes<M>, BrandedKeysOf<Attributes<M>, typeof ForeignKeyBrand>>
    >,
    options: InitOptions<M>
  ): MS;

  /**
   * Remove attribute from model definition
   *
   * @param attribute
   */
  public static removeAttribute(attribute: string): void;

  /**
   * Sync this Model to the DB, that is create the table. Upon success, the callback will be called with the
   * model instance (this)
   */
  public static sync<M extends Model>(options?: SyncOptions): Promise<M>;

  /**
   * Drop the table represented by this Model
   *
   * @param options
   */
  public static drop(options?: DropOptions): Promise<void>;

  /**
   * Apply a schema to this model. For postgres, this will actually place the schema in front of the table
   * name
   * - `"schema"."tableName"`, while the schema will be prepended to the table name for mysql and
   * sqlite - `'schema.tablename'`.
   *
   * @param schema The name of the schema
   * @param options
   */
  public static schema<M extends Model>(
    this: ModelStatic<M>,
    schema: string,
    options?: SchemaOptions
  ): ModelCtor<M>;

  /**
   * Get the tablename of the model, taking schema into account. The method will return The name as a string
   * if the model has no schema, or an object with `tableName`, `schema` and `delimiter` properties.
   *
   * @param options The hash of options from any query. You can use one model to access tables with matching
   *     schemas by overriding `getTableName` and using custom key/values to alter the name of the table.
   *     (eg.
   *     subscribers_1, subscribers_2)
   */
  public static getTableName(): string | {
    tableName: string;
    schema: string;
    delimiter: string;
  };

  /**
   * Apply a scope created in `define` to the model. First let's look at how to create scopes:
   * ```js
   * class MyModel extends Model {}
   * MyModel.init(attributes, {
   *   defaultScope: {
   *     where: {
   *       username: 'dan'
   *     },
   *     limit: 12
   *   },
   *   scopes: {
   *     isALie: {
   *       where: {
   *         stuff: 'cake'
   *       }
   *     },
   *     complexFunction(email, accessLevel) {
   *       return {
   *         where: {
   *           email: {
   *             [Op.like]: email
   *           },
   *           accesss_level {
   *             [Op.gte]: accessLevel
   *           }
   *         }
   *       }
   *     }
   *   },
   *   sequelize,
   * })
   * ```
   * Now, since you defined a default scope, every time you do Model.find, the default scope is appended to
   * your query. Here's a couple of examples:
   * ```js
   * Model.findAll() // WHERE username = 'dan'
   * Model.findAll({ where: { age: { gt: 12 } } }) // WHERE age > 12 AND username = 'dan'
   * ```
   *
   * To invoke scope functions you can do:
   * ```js
   * Model.scope({ method: ['complexFunction' 'dan@sequelize.com', 42]}).findAll()
   * // WHERE email like 'dan@sequelize.com%' AND access_level >= 42
   * ```
   *
   * @returns Model A reference to the model, with the scope(s) applied. Calling scope again on the returned
   *  model will clear the previous scope.
   */
  public static scope<M extends Model>(
    this: ModelStatic<M>,
    options?: string | ScopeOptions | readonly (string | ScopeOptions)[] | WhereAttributeHash<M>
  ): ModelCtor<M>;

  /**
   * Add a new scope to the model
   *
   * This is especially useful for adding scopes with includes, when the model you want to
   * include is not available at the time this model is defined. By default this will throw an
   * error if a scope with that name already exists. Pass `override: true` in the options
   * object to silence this error.
   */
  public static addScope<M extends Model>(
    this: ModelStatic<M>,
    name: string,
    scope: FindOptions<Attributes<M>>,
    options?: AddScopeOptions
  ): void;
  public static addScope<M extends Model>(
    this: ModelStatic<M>,
    name: string,
    scope: (...args: readonly any[]) => FindOptions<Attributes<M>>,
    options?: AddScopeOptions
  ): void;

  /**
   * Search for multiple instances.
   *
   * __Simple search using AND and =__
   * ```js
   * Model.findAll({
   *   where: {
   *     attr1: 42,
   *     attr2: 'cake'
   *   }
   * })
   * ```
   * ```sql
   * WHERE attr1 = 42 AND attr2 = 'cake'
   * ```
   *
   * __Using greater than, less than etc.__
   * ```js
   *
   * Model.findAll({
   *   where: {
   *     attr1: {
   *       gt: 50
   *     },
   *     attr2: {
   *       lte: 45
   *     },
   *     attr3: {
   *       in: [1,2,3]
   *     },
   *     attr4: {
   *       ne: 5
   *     }
   *   }
   * })
   * ```
   * ```sql
   * WHERE attr1 > 50 AND attr2 <= 45 AND attr3 IN (1,2,3) AND attr4 != 5
   * ```
   * Possible options are: `[Op.ne], [Op.in], [Op.not], [Op.notIn], [Op.gte], [Op.gt], [Op.lte], [Op.lt], [Op.like], [Op.ilike]/[Op.iLike], [Op.notLike],
   * [Op.notILike], '..'/[Op.between], '!..'/[Op.notBetween], '&&'/[Op.overlap], '@>'/[Op.contains], '<@'/[Op.contained]`
   *
   * __Queries using OR__
   * ```js
   * Model.findAll({
   *   where: Sequelize.and(
   *     { name: 'a project' },
   *     Sequelize.or(
   *       { id: [1,2,3] },
   *       { id: { gt: 10 } }
   *     )
   *   )
   * })
   * ```
   * ```sql
   * WHERE name = 'a project' AND (id` IN (1,2,3) OR id > 10)
   * ```
   *
   * The success listener is called with an array of instances if the query succeeds.
   *
   * @see {Sequelize#query}
   */
  public static findAll<M extends Model>(
    this: ModelStatic<M>,
    options?: FindOptions<Attributes<M>>): Promise<M[]>;

  /**
   * Search for a single instance by its primary key. This applies LIMIT 1, so the listener will
   * always be called with a single instance.
   */
  public static findByPk<M extends Model>(
    this: ModelStatic<M>,
    identifier: Identifier,
    options: Omit<NonNullFindOptions<Attributes<M>>, 'where'>
  ): Promise<M>;
  public static findByPk<M extends Model>(
    this: ModelStatic<M>,
    identifier?: Identifier,
    options?: Omit<FindOptions<Attributes<M>>, 'where'>
  ): Promise<M | null>;

  /**
   * Search for a single instance. Returns the first instance found, or null if none can be found.
   */
  public static findOne<M extends Model>(
    this: ModelStatic<M>,
    options: NonNullFindOptions<Attributes<M>>
  ): Promise<M>;
  public static findOne<M extends Model>(
    this: ModelStatic<M>,
    options?: FindOptions<Attributes<M>>
  ): Promise<M | null>;

  /**
   * Run an aggregation method on the specified field
   *
   * @param field The field to aggregate over. Can be a field name or *
   * @param aggregateFunction The function to use for aggregation, e.g. sum, max etc.
   * @param options Query options. See sequelize.query for full options
   * @returns Returns the aggregate result cast to `options.dataType`, unless `options.plain` is false, in
   *     which case the complete data result is returned.
   */
  public static aggregate<T, M extends Model>(
    this: ModelStatic<M>,
    field: keyof Attributes<M> | '*',
    aggregateFunction: string,
    options?: AggregateOptions<T, Attributes<M>>
  ): Promise<T>;

  /**
   * Count number of records if group by is used
   *
   * @returns Returns count for each group and the projected attributes.
   */
  public static count<M extends Model>(
    this: ModelStatic<M>,
    options: CountWithOptions<Attributes<M>>
  ): Promise<GroupedCountResultItem[]>;

  /**
   * Count the number of records matching the provided where clause.
   *
   * If you provide an `include` option, the number of matching associations will be counted instead.
   *
   * @returns Returns count for each group and the projected attributes.
   */
  public static count<M extends Model>(
    this: ModelStatic<M>,
    options?: Omit<CountOptions<Attributes<M>>, 'group'>
  ): Promise<number>;

  /**
   * Find all the rows matching your query, within a specified offset / limit, and get the total number of
   * rows matching your query. This is very useful for paging
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
   * the
   * total number of rows that matched your query.
   *
   * When you add includes, only those which are required (either because they have a where clause, or
   * because
   * `required` is explicitly set to true on the include) will be added to the count part.
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
   * without
   * profiles will be counted
   *
   * This function also support grouping, when `group` is provided, the count will be an array of objects
   * containing the count for each group and the projected attributes.
   * ```js
   * User.findAndCountAll({
   *   group: 'type'
   * });
   * ```
   */
  public static findAndCountAll<M extends Model>(
    this: ModelStatic<M>,
    options?: Omit<FindAndCountOptions<Attributes<M>>, 'group'>
  ): Promise<{ rows: M[]; count: number }>;
  public static findAndCountAll<M extends Model>(
    this: ModelStatic<M>,
    options: SetRequired<FindAndCountOptions<Attributes<M>>, 'group'>
  ): Promise<{ rows: M[]; count: GroupedCountResultItem[] }>;

  /**
   * Find the maximum value of field
   */
  public static max<T extends DataType | unknown, M extends Model>(
    this: ModelStatic<M>,
    field: keyof Attributes<M>,
    options?: AggregateOptions<T, Attributes<M>>
  ): Promise<T>;

  /**
   * Find the minimum value of field
   */
  public static min<T extends DataType | unknown, M extends Model>(
    this: ModelStatic<M>,
    field: keyof Attributes<M>,
    options?: AggregateOptions<T, Attributes<M>>
  ): Promise<T>;

  /**
   * Find the sum of field
   */
  public static sum<T extends DataType | unknown, M extends Model>(
    this: ModelStatic<M>,
    field: keyof Attributes<M>,
    options?: AggregateOptions<T, Attributes<M>>
  ): Promise<number>;

  /**
   * Builds a new model instance. Values is an object of key value pairs, must be defined but can be empty.
   */
  public static build<M extends Model>(
    this: ModelStatic<M>,
    record?: CreationAttributes<M>,
    options?: BuildOptions
  ): M;

  /**
   * Undocumented bulkBuild
   */
  public static bulkBuild<M extends Model>(
    this: ModelStatic<M>,
    records: ReadonlyArray<CreationAttributes<M>>,
    options?: BuildOptions
  ): M[];

  /**
   * Builds a new model instance and calls save on it.
   */
  public static create<
    M extends Model,
    O extends CreateOptions<Attributes<M>> = CreateOptions<Attributes<M>>
  >(
    this: ModelStatic<M>,
    values?: CreationAttributes<M>,
    options?: O
  ): Promise<O extends { returning: false } | { ignoreDuplicates: true } ? void : M>;

  /**
   * Find a row that matches the query, or build (but don't save) the row if none is found.
   * The successful result of the promise will be (instance, initialized) - Make sure to use `.then(([...]))`
   */
  public static findOrBuild<M extends Model>(
    this: ModelStatic<M>,
    options: FindOrBuildOptions<
      Attributes<M>,
      CreationAttributes<M>
    >
  ): Promise<[M, boolean]>;

  /**
   * Find a row that matches the query, or build and save the row if none is found
   * The successful result of the promise will be (instance, created) - Make sure to use `.then(([...]))`
   *
   * If no transaction is passed in the `options` object, a new transaction will be created internally, to
   * prevent the race condition where a matching row is created by another connection after the find but
   * before the insert call. However, it is not always possible to handle this case in SQLite, specifically
   * if one transaction inserts and another tries to select before the first one has comitted. In this case,
   * an instance of sequelize.TimeoutError will be thrown instead. If a transaction is created, a savepoint
   * will be created instead, and any unique constraint violation will be handled internally.
   */
  public static findOrCreate<M extends Model>(
    this: ModelStatic<M>,
    options: FindOrCreateOptions<Attributes<M>, CreationAttributes<M>>
  ): Promise<[M, boolean]>;

  /**
   * A more performant findOrCreate that will not work under a transaction (at least not in postgres)
   * Will execute a find call, if empty then attempt to create, if unique constraint then attempt to find again
   */
  public static findCreateFind<M extends Model>(
    this: ModelStatic<M>,
    options: FindOrCreateOptions<Attributes<M>, CreationAttributes<M>>
  ): Promise<[M, boolean]>;

  /**
   * Insert or update a single row. An update will be executed if a row which matches the supplied values on
   * either the primary key or a unique key is found. Note that the unique index must be defined in your
   * sequelize model and not just in the table. Otherwise you may experience a unique constraint violation,
   * because sequelize fails to identify the row that should be updated.
   *
   * **Implementation details:**
   *
   * * MySQL - Implemented as a single query `INSERT values ON DUPLICATE KEY UPDATE values`
   * * PostgreSQL - Implemented as a temporary function with exception handling: INSERT EXCEPTION WHEN
   *   unique_constraint UPDATE
   * * SQLite - Implemented as two queries `INSERT; UPDATE`. This means that the update is executed
   * regardless
   *   of whether the row already existed or not
   *
   * **Note** that SQLite returns null for created, no matter if the row was created or updated. This is
   * because SQLite always runs INSERT OR IGNORE + UPDATE, in a single query, so there is no way to know
   * whether the row was inserted or not.
   */
  public static upsert<M extends Model>(
    this: ModelStatic<M>,
    values: CreationAttributes<M>,
    options?: UpsertOptions<Attributes<M>>
  ): Promise<[M, boolean | null]>;

  /**
   * Create and insert multiple instances in bulk.
   *
   * The success handler is passed an array of instances, but please notice that these may not completely
   * represent the state of the rows in the DB. This is because MySQL and SQLite do not make it easy to
   * obtain
   * back automatically generated IDs and other default values in a way that can be mapped to multiple
   * records. To obtain Instances for the newly created values, you will need to query for them again.
   *
   * @param records List of objects (key/value pairs) to create instances from
   */
  public static bulkCreate<M extends Model>(
    this: ModelStatic<M>,
    records: ReadonlyArray<CreationAttributes<M>>,
    options?: BulkCreateOptions<Attributes<M>>
  ): Promise<M[]>;

  /**
   * Truncate all instances of the model. This is a convenient method for Model.destroy({ truncate: true }).
   */
  public static truncate<M extends Model>(
    this: ModelStatic<M>,
    options?: TruncateOptions<Attributes<M>>
  ): Promise<void>;

  /**
   * Delete multiple instances, or set their deletedAt timestamp to the current time if `paranoid` is enabled.
   *
   * @returns Promise<number> The number of destroyed rows
   */
  public static destroy<M extends Model>(
    this: ModelStatic<M>,
    options?: DestroyOptions<Attributes<M>>
  ): Promise<number>;

  /**
   * Restore multiple instances if `paranoid` is enabled.
   */
  public static restore<M extends Model>(
    this: ModelStatic<M>,
    options?: RestoreOptions<Attributes<M>>
  ): Promise<void>;

  /**
   * Update multiple instances that match the where options. The promise returns an array with one or two
   * elements. The first element is always the number of affected rows, while the second element is the actual
   * affected rows (only supported in postgres and mssql with `options.returning` true.)
   */
  public static update<M extends Model>(
    this: ModelStatic<M>,
    values: {
        [key in keyof Attributes<M>]?: Attributes<M>[key] | Fn | Col | Literal;
    },
    options: Omit<UpdateOptions<Attributes<M>>, 'returning'>
      & { returning: Exclude<UpdateOptions<Attributes<M>>['returning'], undefined | false> }
  ): Promise<[affectedCount: number, affectedRows: M[]]>;

  /**
   * Update multiple instances that match the where options. The promise returns an array with one or two
   * elements. The first element is always the number of affected rows, while the second element is the actual
   * affected rows (only supported in postgres and mssql with `options.returning` true.)
   */
   public static update<M extends Model>(
    this: ModelStatic<M>,
    values: {
        [key in keyof Attributes<M>]?: Attributes<M>[key] | Fn | Col | Literal;
    },
    options: UpdateOptions<Attributes<M>>
  ): Promise<[affectedCount: number]>;

  /**
   * Increments the value of one or more attributes.
   *
   * The increment is done using a `SET column = column + X WHERE foo = 'bar'` query.
   *
   * @example <caption>increment number by 1</caption>
   * ```javascript
   * Model.increment('number', { where: { foo: 'bar' });
   * ```
   *
   * @example <caption>increment number and count by 2</caption>
   * ```javascript
   * Model.increment(['number', 'count'], { by: 2, where: { foo: 'bar' } });
   * ```
   *
   * @example <caption>increment answer by 42, and decrement tries by 1</caption>
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
    options: IncrementDecrementOptionsWithBy<Attributes<M>>
  ): Promise<[affectedRows: M[], affectedCount?: number]>;
  static increment<M extends Model>(
    this: ModelStatic<M>,
    fields: { [key in keyof Attributes<M>]?: number },
    options: IncrementDecrementOptions<Attributes<M>>
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
    options: IncrementDecrementOptionsWithBy<Attributes<M>>
  ): Promise<[affectedRows: M[], affectedCount?: number]>;
  static decrement<M extends Model>(
    this: ModelStatic<M>,
    fields: { [key in keyof Attributes<M>]?: number },
    options: IncrementDecrementOptions<Attributes<M>>
  ): Promise<[affectedRows: M[], affectedCount?: number]>;

  /**
   * Run a describe query on the table. The result will be return to the listener as a hash of attributes and
   * their types.
   */
  public static describe(): Promise<object>;

  /**
   * Unscope the model
   */
  public static unscoped<M extends ModelType>(this: M): M;

  /**
   * A hook that is run before validation
   *
   * @param name
   * @param fn A callback function that is called with instance, options
   */
  public static beforeValidate<M extends Model>(
    this: ModelStatic<M>,
    name: string,
    fn: (instance: M, options: ValidationOptions) => HookReturn
  ): void;
  public static beforeValidate<M extends Model>(
    this: ModelStatic<M>,
    fn: (instance: M, options: ValidationOptions) => HookReturn
  ): void;

  /**
   * A hook that is run after validation
   *
   * @param name
   * @param fn A callback function that is called with instance, options
   */
  public static afterValidate<M extends Model>(
    this: ModelStatic<M>,
    name: string,
    fn: (instance: M, options: ValidationOptions) => HookReturn
  ): void;
  public static afterValidate<M extends Model>(
    this: ModelStatic<M>,
    fn: (instance: M, options: ValidationOptions) => HookReturn
  ): void;

  /**
   * A hook that is run before creating a single instance
   *
   * @param name
   * @param fn A callback function that is called with attributes, options
   */
  public static beforeCreate<M extends Model>(
    this: ModelStatic<M>,
    name: string,
    fn: (instance: M, options: CreateOptions<Attributes<M>>) => HookReturn
  ): void;
  public static beforeCreate<M extends Model>(
    this: ModelStatic<M>,
    fn: (instance: M, options: CreateOptions<Attributes<M>>) => HookReturn
  ): void;

  /**
   * A hook that is run after creating a single instance
   *
   * @param name
   * @param fn A callback function that is called with attributes, options
   */
  public static afterCreate<M extends Model>(
    this: ModelStatic<M>,
    name: string,
    fn: (instance: M, options: CreateOptions<Attributes<M>>) => HookReturn
  ): void;
  public static afterCreate<M extends Model>(
    this: ModelStatic<M>,
    fn: (instance: M, options: CreateOptions<Attributes<M>>) => HookReturn
  ): void;

  /**
   * A hook that is run before destroying a single instance
   *
   * @param name
   * @param fn A callback function that is called with instance, options
   */
  public static beforeDestroy<M extends Model>(
    this: ModelStatic<M>,
    name: string,
    fn: (instance: M, options: InstanceDestroyOptions) => HookReturn
  ): void;
  public static beforeDestroy<M extends Model>(
    this: ModelStatic<M>,
    fn: (instance: M, options: InstanceDestroyOptions) => HookReturn
  ): void;

  /**
   * A hook that is run after destroying a single instance
   *
   * @param name
   * @param fn A callback function that is called with instance, options
   */
  public static afterDestroy<M extends Model>(
    this: ModelStatic<M>,
    name: string,
    fn: (instance: M, options: InstanceDestroyOptions) => HookReturn
  ): void;
  public static afterDestroy<M extends Model>(
    this: ModelStatic<M>,
    fn: (instance: M, options: InstanceDestroyOptions) => HookReturn
  ): void;

  /**
   * A hook that is run before updating a single instance
   *
   * @param name
   * @param fn A callback function that is called with instance, options
   */
  public static beforeUpdate<M extends Model>(
    this: ModelStatic<M>,
    name: string,
    fn: (instance: M, options: UpdateOptions<Attributes<M>>) => HookReturn
  ): void;
  public static beforeUpdate<M extends Model>(
    this: ModelStatic<M>,
    fn: (instance: M, options: UpdateOptions<Attributes<M>>) => HookReturn
  ): void;

  /**
   * A hook that is run after updating a single instance
   *
   * @param name
   * @param fn A callback function that is called with instance, options
   */
  public static afterUpdate<M extends Model>(
    this: ModelStatic<M>,
    name: string,
    fn: (instance: M, options: UpdateOptions<Attributes<M>>) => HookReturn
  ): void;
  public static afterUpdate<M extends Model>(
    this: ModelStatic<M>,
    fn: (instance: M, options: UpdateOptions<Attributes<M>>) => HookReturn
  ): void;

  /**
   * A hook that is run before creating or updating a single instance, It proxies `beforeCreate` and `beforeUpdate`
   *
   * @param name
   * @param fn A callback function that is called with instance, options
   */
  public static beforeSave<M extends Model>(
    this: ModelStatic<M>,
    name: string,
    fn: (instance: M, options: UpdateOptions<Attributes<M>> | SaveOptions<Attributes<M>>) => HookReturn
  ): void;
  public static beforeSave<M extends Model>(
    this: ModelStatic<M>,
    fn: (instance: M, options: UpdateOptions<Attributes<M>> | SaveOptions<Attributes<M>>) => HookReturn
  ): void;

  /**
   * A hook that is run after creating or updating a single instance, It proxies `afterCreate` and `afterUpdate`
   *
   * @param name
   * @param fn A callback function that is called with instance, options
   */
  public static afterSave<M extends Model>(
    this: ModelStatic<M>,
    name: string,
    fn: (instance: M, options: UpdateOptions<Attributes<M>> | SaveOptions<Attributes<M>>) => HookReturn
  ): void;
  public static afterSave<M extends Model>(
    this: ModelStatic<M>,
    fn: (instance: M, options: UpdateOptions<Attributes<M>> | SaveOptions<Attributes<M>>) => HookReturn
  ): void;

  /**
   * A hook that is run before creating instances in bulk
   *
   * @param name
   * @param fn A callback function that is called with instances, options
   */
  public static beforeBulkCreate<M extends Model>(
    this: ModelStatic<M>,
    name: string,
    fn: (instances: M[], options: BulkCreateOptions<Attributes<M>>) => HookReturn
  ): void;
  public static beforeBulkCreate<M extends Model>(
    this: ModelStatic<M>,
    fn: (instances: M[], options: BulkCreateOptions<Attributes<M>>) => HookReturn
  ): void;

  /**
   * A hook that is run after creating instances in bulk
   *
   * @param name
   * @param fn A callback function that is called with instances, options
   */
  public static afterBulkCreate<M extends Model>(
    this: ModelStatic<M>,
    name: string,
    fn: (instances: readonly M[], options: BulkCreateOptions<Attributes<M>>) => HookReturn
  ): void;
  public static afterBulkCreate<M extends Model>(
    this: ModelStatic<M>,
    fn: (instances: readonly M[], options: BulkCreateOptions<Attributes<M>>) => HookReturn
  ): void;

  /**
   * A hook that is run before destroying instances in bulk
   *
   * @param name
   * @param fn   A callback function that is called with options
   */
  public static beforeBulkDestroy<M extends Model>(
    this: ModelStatic<M>,
    name: string, fn: (options: BulkCreateOptions<Attributes<M>>) => HookReturn): void;
  public static beforeBulkDestroy<M extends Model>(
    this: ModelStatic<M>,
    fn: (options: BulkCreateOptions<Attributes<M>>) => HookReturn
  ): void;

  /**
   * A hook that is run after destroying instances in bulk
   *
   * @param name
   * @param fn   A callback function that is called with options
   */
  public static afterBulkDestroy<M extends Model>(
    this: ModelStatic<M>,
    name: string, fn: (options: DestroyOptions<Attributes<M>>) => HookReturn
  ): void;
  public static afterBulkDestroy<M extends Model>(
    this: ModelStatic<M>,
    fn: (options: DestroyOptions<Attributes<M>>) => HookReturn
  ): void;

  /**
   * A hook that is run after updating instances in bulk
   *
   * @param name
   * @param fn   A callback function that is called with options
   */
  public static beforeBulkUpdate<M extends Model>(
    this: ModelStatic<M>,
    name: string, fn: (options: UpdateOptions<Attributes<M>>) => HookReturn
  ): void;
  public static beforeBulkUpdate<M extends Model>(
    this: ModelStatic<M>,
    fn: (options: UpdateOptions<Attributes<M>>) => HookReturn
  ): void;

  /**
   * A hook that is run after updating instances in bulk
   *
   * @param name
   * @param fn   A callback function that is called with options
   */
  public static afterBulkUpdate<M extends Model>(
    this: ModelStatic<M>,
    name: string, fn: (options: UpdateOptions<Attributes<M>>) => HookReturn
  ): void;
  public static afterBulkUpdate<M extends Model>(
    this: ModelStatic<M>,
    fn: (options: UpdateOptions<Attributes<M>>) => HookReturn
  ): void;

  /**
   * A hook that is run before a find (select) query
   *
   * @param name
   * @param fn   A callback function that is called with options
   */
  public static beforeFind<M extends Model>(
    this: ModelStatic<M>,
    name: string, fn: (options: FindOptions<Attributes<M>>) => HookReturn
  ): void;
  public static beforeFind<M extends Model>(
    this: ModelStatic<M>,
    fn: (options: FindOptions<Attributes<M>>) => HookReturn
  ): void;

  /**
   * A hook that is run before a count query
   *
   * @param name
   * @param fn   A callback function that is called with options
   */
  public static beforeCount<M extends Model>(
    this: ModelStatic<M>,
    name: string, fn: (options: CountOptions<Attributes<M>>) => HookReturn
  ): void;
  public static beforeCount<M extends Model>(
    this: ModelStatic<M>,
    fn: (options: CountOptions<Attributes<M>>) => HookReturn
  ): void;

  /**
   * A hook that is run before a find (select) query, after any { include: {all: ...} } options are expanded
   *
   * @param name
   * @param fn   A callback function that is called with options
   */
  public static beforeFindAfterExpandIncludeAll<M extends Model>(
    this: ModelStatic<M>,
    name: string, fn: (options: FindOptions<Attributes<M>>) => HookReturn
  ): void;
  public static beforeFindAfterExpandIncludeAll<M extends Model>(
    this: ModelStatic<M>,
    fn: (options: FindOptions<Attributes<M>>) => HookReturn
  ): void;

  /**
   * A hook that is run before a find (select) query, after all option parsing is complete
   *
   * @param name
   * @param fn   A callback function that is called with options
   */
  public static beforeFindAfterOptions<M extends Model>(
    this: ModelStatic<M>,
    name: string, fn: (options: FindOptions<Attributes<M>>) => HookReturn
  ): void;
  public static beforeFindAfterOptions<M extends Model>(
    this: ModelStatic<M>,
    fn: (options: FindOptions<Attributes<M>>) => void
  ): HookReturn;

  /**
   * A hook that is run after a find (select) query
   *
   * @param name
   * @param fn   A callback function that is called with instance(s), options
   */
  public static afterFind<M extends Model>(
    this: ModelStatic<M>,
    name: string,
    fn: (instancesOrInstance: readonly M[] | M | null, options: FindOptions<Attributes<M>>) => HookReturn
  ): void;
  public static afterFind<M extends Model>(
    this: ModelStatic<M>,
    fn: (instancesOrInstance: readonly M[] | M | null, options: FindOptions<Attributes<M>>) => HookReturn
  ): void;

  /**
   * A hook that is run before sequelize.sync call
   *
   * @param fn   A callback function that is called with options passed to sequelize.sync
   */
  public static beforeBulkSync(name: string, fn: (options: SyncOptions) => HookReturn): void;
  public static beforeBulkSync(fn: (options: SyncOptions) => HookReturn): void;

  /**
   * A hook that is run after sequelize.sync call
   *
   * @param fn   A callback function that is called with options passed to sequelize.sync
   */
  public static afterBulkSync(name: string, fn: (options: SyncOptions) => HookReturn): void;
  public static afterBulkSync(fn: (options: SyncOptions) => HookReturn): void;

  /**
   * A hook that is run before Model.sync call
   *
   * @param fn   A callback function that is called with options passed to Model.sync
   */
  public static beforeSync(name: string, fn: (options: SyncOptions) => HookReturn): void;
  public static beforeSync(fn: (options: SyncOptions) => HookReturn): void;

  /**
   * A hook that is run after Model.sync call
   *
   * @param fn   A callback function that is called with options passed to Model.sync
   */
  public static afterSync(name: string, fn: (options: SyncOptions) => HookReturn): void;
  public static afterSync(fn: (options: SyncOptions) => HookReturn): void;

  /**
   * Creates an association between this (the source) and the provided target. The foreign key is added
   * on the target.
   *
   * Example: `User.hasOne(Profile)`. This will add userId to the profile table.
   *
   * @param target The model that will be associated with hasOne relationship
   * @param options Options for the association
   */
  public static hasOne<M extends Model, T extends Model>(
    this: ModelStatic<M>, target: ModelStatic<T>, options?: HasOneOptions
  ): HasOne<M, T>;

  /**
   * Creates an association between this (the source) and the provided target. The foreign key is added on the
   * source.
   *
   * Example: `Profile.belongsTo(User)`. This will add userId to the profile table.
   *
   * @param target The model that will be associated with hasOne relationship
   * @param options Options for the association
   */
  public static belongsTo<M extends Model, T extends Model>(
    this: ModelStatic<M>, target: ModelStatic<T>, options?: BelongsToOptions
  ): BelongsTo<M, T>;

  /**
   * Create an association that is either 1:m or n:m.
   *
   * ```js
   * // Create a 1:m association between user and project
   * User.hasMany(Project)
   * ```
   * ```js
   * // Create a n:m association between user and project
   * User.hasMany(Project)
   * Project.hasMany(User)
   * ```
   * By default, the name of the join table will be source+target, so in this case projectsusers. This can be
   * overridden by providing either a string or a Model as `through` in the options. If you use a through
   * model with custom attributes, these attributes can be set when adding / setting new associations in two
   * ways. Consider users and projects from before with a join table that stores whether the project has been
   * started yet:
   * ```js
   * class UserProjects extends Model {}
   * UserProjects.init({
   *   started: Sequelize.BOOLEAN
   * }, { sequelize })
   * User.hasMany(Project, { through: UserProjects })
   * Project.hasMany(User, { through: UserProjects })
   * ```
   * ```js
   * jan.addProject(homework, { started: false }) // The homework project is not started yet
   * jan.setProjects([makedinner, doshopping], { started: true}) // Both shopping and dinner have been
   * started
   * ```
   *
   * If you want to set several target instances, but with different attributes you have to set the
   * attributes on the instance, using a property with the name of the through model:
   *
   * ```js
   * p1.userprojects {
   *   started: true
   * }
   * user.setProjects([p1, p2], {started: false}) // The default value is false, but p1 overrides that.
   * ```
   *
   * Similarily, when fetching through a join table with custom attributes, these attributes will be
   * available as an object with the name of the through model.
   * ```js
   * user.getProjects().then(projects => {
   *   const p1 = projects[0]
   *   p1.userprojects.started // Is this project started yet?
   * })
   * ```
   *
   * @param target The model that will be associated with hasOne relationship
   * @param options Options for the association
   */
  public static hasMany<M extends Model, T extends Model>(
    this: ModelStatic<M>, target: ModelStatic<T>, options?: HasManyOptions
  ): HasMany<M, T>;

  /**
   * Create an N:M association with a join table
   *
   * ```js
   * User.belongsToMany(Project)
   * Project.belongsToMany(User)
   * ```
   * By default, the name of the join table will be source+target, so in this case projectsusers. This can be
   * overridden by providing either a string or a Model as `through` in the options.
   *
   * If you use a through model with custom attributes, these attributes can be set when adding / setting new
   * associations in two ways. Consider users and projects from before with a join table that stores whether
   * the project has been started yet:
   * ```js
   * class UserProjects extends Model {}
   * UserProjects.init({
   *   started: Sequelize.BOOLEAN
   * }, { sequelize });
   * User.belongsToMany(Project, { through: UserProjects })
   * Project.belongsToMany(User, { through: UserProjects })
   * ```
   * ```js
   * jan.addProject(homework, { started: false }) // The homework project is not started yet
   * jan.setProjects([makedinner, doshopping], { started: true}) // Both shopping and dinner has been started
   * ```
   *
   * If you want to set several target instances, but with different attributes you have to set the
   * attributes on the instance, using a property with the name of the through model:
   *
   * ```js
   * p1.userprojects {
   *   started: true
   * }
   * user.setProjects([p1, p2], {started: false}) // The default value is false, but p1 overrides that.
   * ```
   *
   * Similarily, when fetching through a join table with custom attributes, these attributes will be
   * available as an object with the name of the through model.
   * ```js
   * user.getProjects().then(projects => {
   *   const p1 = projects[0]
   *   p1.userprojects.started // Is this project started yet?
   * })
   * ```
   *
   * @param target The model that will be associated with hasOne relationship
   * @param options Options for the association
   *
   */
  public static belongsToMany<M extends Model, T extends Model>(
    this: ModelStatic<M>, target: ModelStatic<T>, options: BelongsToManyOptions
  ): BelongsToMany<M, T>;

  /**
   * Returns true if this instance has not yet been persisted to the database
   */
  public isNewRecord: boolean;

  /**
   * A reference to the sequelize instance
   */
  public sequelize: Sequelize;

  /**
   * Builds a new model instance.
   *
   * @param values an object of key value pairs
   */
  constructor(values?: MakeNullishOptional<TCreationAttributes>, options?: BuildOptions);

  /**
   * Get an object representing the query for this instance, use with `options.where`
   */
  public where(): object;

  /**
   * Get the value of the underlying data value
   */
  public getDataValue<K extends keyof TModelAttributes>(key: K): TModelAttributes[K];

  /**
   * Update the underlying data value
   */
  public setDataValue<K extends keyof TModelAttributes>(key: K, value: TModelAttributes[K]): void;

  /**
   * If no key is given, returns all values of the instance, also invoking virtual getters.
   *
   * If key is given and a field or virtual getter is present for the key it will call that getter - else it
   * will return the value for key.
   *
   * @param options.plain If set to true, included instances will be returned as plain objects
   */
  public get(options?: { plain?: boolean; clone?: boolean }): TModelAttributes;
  public get<K extends keyof this>(key: K, options?: { plain?: boolean; clone?: boolean }): this[K];
  public get(key: string, options?: { plain?: boolean; clone?: boolean }): unknown;

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
   *
   * @param options.raw If set to true, field and virtual setters will be ignored
   * @param options.reset Clear all previously set data values
   */
  public set<K extends keyof TModelAttributes>(key: K, value: TModelAttributes[K], options?: SetOptions): this;
  public set(keys: Partial<TModelAttributes>, options?: SetOptions): this;
  public setAttributes<K extends keyof TModelAttributes>(key: K, value: TModelAttributes[K], options?: SetOptions): this;
  public setAttributes(keys: Partial<TModelAttributes>, options?: SetOptions): this;

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
  public changed<K extends keyof this>(key: K): boolean;
  public changed<K extends keyof this>(key: K, dirty: boolean): void;
  public changed(): false | string[];

  /**
   * Returns the previous value for key from `_previousDataValues`.
   */
  public previous(): Partial<TModelAttributes>;
  public previous<K extends keyof TModelAttributes>(key: K): TModelAttributes[K] | undefined;

  /**
   * Validates this instance, and if the validation passes, persists it to the database.
   *
   * Returns a Promise that resolves to the saved instance (or rejects with a `Sequelize.ValidationError`, which will have a property for each of the fields for which the validation failed, with the error message for that field).
   *
   * This method is optimized to perform an UPDATE only into the fields that changed. If nothing has changed, no SQL query will be performed.
   *
   * This method is not aware of eager loaded associations. In other words, if some other model instance (child) was eager loaded with this instance (parent), and you change something in the child, calling `save()` will simply ignore the change that happened on the child.
   */
  public save(options?: SaveOptions<TModelAttributes>): Promise<this>;

  /**
   * Refresh the current instance in-place, i.e. update the object with current data from the DB and return
   * the same object. This is different from doing a `find(Instance.id)`, because that would create and
   * return a new instance. With this method, all references to the Instance are updated with the new data
   * and no new objects are created.
   */
  public reload(options?: FindOptions<TModelAttributes>): Promise<this>;

  /**
   * Validate the attribute of this instance according to validation rules set in the model definition.
   *
   * Emits null if and only if validation successful; otherwise an Error instance containing
   * { field name : [error msgs] } entries.
   *
   * @param options.skip An array of strings. All properties that are in this array will not be validated
   */
  public validate(options?: ValidationOptions): Promise<void>;

  /**
   * This is the same as calling `set` and then calling `save`.
   */
  public update<K extends keyof TModelAttributes>(key: K, value: TModelAttributes[K] | Col | Fn | Literal, options?: InstanceUpdateOptions<TModelAttributes>): Promise<this>;
  public update(
    keys: {
        [key in keyof TModelAttributes]?: TModelAttributes[key] | Fn | Col | Literal;
    },
    options?: InstanceUpdateOptions<TModelAttributes>
  ): Promise<this>;

  /**
   * Destroy the row corresponding to this instance. Depending on your setting for paranoid, the row will
   * either be completely deleted, or have its deletedAt timestamp set to the current time.
   */
  public destroy(options?: InstanceDestroyOptions): Promise<void>;

  /**
   * Restore the row corresponding to this instance. Only available for paranoid models.
   */
  public restore(options?: InstanceRestoreOptions): Promise<void>;

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
  public increment<K extends keyof TModelAttributes>(
    fields: K | readonly K[] | Partial<TModelAttributes>,
    options?: IncrementDecrementOptionsWithBy<TModelAttributes>
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
  public decrement<K extends keyof TModelAttributes>(
    fields: K | readonly K[] | Partial<TModelAttributes>,
    options?: IncrementDecrementOptionsWithBy<TModelAttributes>
  ): Promise<this>;

  /**
   * Check whether all values of this and `other` Instance are the same
   */
  public equals(other: this): boolean;

  /**
   * Check if this is equal to one of `others` by calling equals
   */
  public equalsOneOf(others: readonly this[]): boolean;

  /**
   * Convert the instance to a JSON representation. Proxies to calling `get` with no keys. This means get all
   * values gotten from the DB, and apply all custom getters.
   */
  public toJSON<T extends TModelAttributes>(): T;
  public toJSON(): object;

  /**
   * Helper method to determine if a instance is "soft deleted". This is
   * particularly useful if the implementer renamed the deletedAt attribute to
   * something different. This method requires paranoid to be enabled.
   *
   * Throws an error if paranoid is not enabled.
   */
  public isSoftDeleted(): boolean;
}

/** @deprecated use ModelStatic */
export type ModelType<TModelAttributes extends {} = any, TCreationAttributes extends {} = TModelAttributes> = new () => Model<TModelAttributes, TCreationAttributes>;

type NonConstructorKeys<T> = ({[P in keyof T]: T[P] extends new () => any ? never : P })[keyof T];
type NonConstructor<T> = Pick<T, NonConstructorKeys<T>>;

/** @deprecated use ModelStatic */
export type ModelCtor<M extends Model> = ModelStatic<M>;

export type ModelDefined<S extends {}, T extends {}> = ModelStatic<Model<S, T>>;

// remove the existing constructor that tries to return `Model<{},{}>` which would be incompatible with models that have typing defined & replace with proper constructor.
export type ModelStatic<M extends Model> = NonConstructor<typeof Model> & { new(): M };

export default Model;

/**
 * Type will be true is T is branded with Brand, false otherwise
 */
// How this works:
// - `A extends B` will be true if A has *at least* all the properties of B
// - If we do `A extends Omit<A, Checked>` - the result will only be true if A did not have Checked to begin with
// - So if we want to check if T is branded, we remove the brand, and check if they list of keys is still the same.
// we exclude Null & Undefined so "field: Brand<value> | null" is still detected as branded
// this is important because "Brand<value | null>" are transformed into "Brand<value> | null" to not break null & undefined
type IsBranded<T, Brand extends symbol> = keyof NonNullable<T> extends keyof Omit<NonNullable<T>, Brand>
  ? false
  : true;

type BrandedKeysOf<T, Brand extends symbol> = {
  [P in keyof T]-?: IsBranded<T[P], Brand> extends true ? P : never
}[keyof T];

/**
 * Dummy Symbol used as branding by {@link NonAttribute}.
 *
 * Do not export, Do not use.
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
  T extends null | undefined ? T
  : (T & { [NonAttributeBrand]?: true });

/**
 * Dummy Symbol used as branding by {@link ForeignKey}.
 *
 * Do not export, Do not use.
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
  T extends null | undefined ? T
  : (T & { [ForeignKeyBrand]?: true });

/**
 * Option bag for {@link InferAttributes}.
 *
 * - omit: properties to not treat as Attributes.
 */
type InferAttributesOptions<Excluded, > = { omit?: Excluded };

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
 * // listed attributes will be 'id' & 'firstName'.
 * class User extends Model<InferAttributes<User>> {
 *   id: number;
 *   firstName: string;
 * }
 *
 * @example
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
 *
 * @example
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
 */
export type InferAttributes<
  M extends Model,
  Options extends InferAttributesOptions<keyof M | never | ''> = { omit: never }
  > = {
  [Key in keyof M as InternalInferAttributeKeysFromFields<M, Key, Options>]: M[Key]
};

/**
 * Dummy Symbol used as branding by {@link CreationOptional}.
 *
 * Do not export, Do not use.
 */
declare const CreationAttributeBrand: unique symbol;

/**
 * This is a Branded Type.
 * You can use it to tag attributes that can be ommited during Model Creation.
 *
 * For use with {@link InferCreationAttributes}.
 */
export type CreationOptional<T> =
  // we don't brand null & undefined as they can't have properties.
  // This means `CreationOptional<null>` will not work, but who makes an attribute that only accepts null?
  // Note that `CreationOptional<string | null>` does work!
  T extends null | undefined ? T
  : (T & { [CreationAttributeBrand]?: true });

/**
 * Utility type to extract Creation Attributes of a given Model class.
 *
 * Works like {@link InferAttributes}, but fields that are tagged using
 *  {@link CreationOptional} will be optional.
 *
 * @example
 * class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
 *   // this attribute is optional in Model#create
 *   declare id: CreationOptional<number>;
 *
 *   // this attribute is mandatory in Model#create
 *   declare name: string;
 * }
 */
export type InferCreationAttributes<
  M extends Model,
  Options extends InferAttributesOptions<keyof M | never | ''> = { omit: never }
  > = {
  [Key in keyof M as InternalInferAttributeKeysFromFields<M, Key, Options>]: IsBranded<M[Key], typeof CreationAttributeBrand> extends true
    ? (M[Key] | undefined)
    : M[Key]
};

/**
 * @private
 *
 * Internal type used by {@link InferCreationAttributes} and {@link InferAttributes} to exclude
 * attributes that are:
 * - functions
 * - branded using {@link NonAttribute}
 * - inherited from {@link Model}
 * - Excluded manually using {@link InferAttributesOptions#omit}
 */
type InternalInferAttributeKeysFromFields<M extends Model, Key extends keyof M, Options extends InferAttributesOptions<keyof M | never | ''>> =
  // fields inherited from Model are all excluded
  Key extends keyof Model ? never
  // functions are always excluded
  : M[Key] extends AnyFunction ? never
  // fields branded with NonAttribute are excluded
  : IsBranded<M[Key], typeof NonAttributeBrand> extends true ? never
  // check 'omit' option is provided & exclude those listed in it
  : Options['omit'] extends string ? (Key extends Options['omit'] ? never : Key)
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
 * function buildModel<M extends Model>(modelClass: ModelStatic<M>, attributes: CreationAttributes<M>) {}
 */
export type CreationAttributes<M extends Model | Hooks> = MakeNullishOptional<M['_creationAttributes']>;

/**
 * Returns the creation attributes of a given Model.
 *
 * This returns the Attributes of a Model that have already been defined, it does not build them.
 * If you need to build them, use {@link InferAttributes}.
 *
 * @example
 * function getValue<M extends Model>(modelClass: ModelStatic<M>, attribute: keyof Attributes<M>) {}
 */
export type Attributes<M extends Model | Hooks> = M['_attributes'];
