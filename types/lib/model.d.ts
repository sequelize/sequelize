import {
  Association,
  BelongsTo,
  BelongsToMany,
  BelongsToManyOptions,
  BelongsToOptions,
  HasMany,
  HasManyOptions,
  HasOne,
  HasOneOptions,
} from './associations/index';
import { DataType } from './data-types';
import { Deferrable } from './deferrable';
import { HookReturn, Hooks, ModelHooks } from './hooks';
import { ValidationOptions } from './instance-validator';
import { ModelManager } from './model-manager';
import Op = require('./operators');
import { Promise } from './promise';
import { QueryOptions } from './query-interface';
import { Config, Options, Sequelize, SyncOptions } from './sequelize';
import { Transaction } from './transaction';
import { Col, Fn, Literal, Where } from './utils';

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

export interface Transactionable {
  /**
   * Transaction to run query under
   */
  transaction?: Transaction;
}

export interface SearchPathable {
  /**
   * An optional parameter to specify the schema search_path (Postgres only)
   */
  searchPath?: string;
}

export interface Filterable {
  /**
   * Attribute has to be matched for rows to be selected for the given action.
   */
  where?: WhereOptions;
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
  method: string | [string, ...unknown[]];
}

/**
 * The type accepted by every `where` option
 */
export type WhereOptions = WhereAttributeHash | AndOperator | OrOperator | Where;

/**
 * Example: `[Op.any]: [2,3]` becomes `ANY ARRAY[2, 3]::INTEGER`
 *
 * _PG only_
 */
export interface AnyOperator {
  [Op.any]: (string | number)[];
}

/** Undocumented? */
export interface AllOperator {
  [Op.all]: (string | number)[];
}

/**
 * Operators that can be used in WhereOptions
 *
 * See http://docs.sequelizejs.com/en/v3/docs/querying/#operators
 */
export interface WhereOperators {
  /**
   * Example: `[Op.any]: [2,3]` becomes `ANY ARRAY[2, 3]::INTEGER`
   *
   * _PG only_
   */
  [Op.any]?: (string | number)[];

  /** Example: `[Op.gte]: 6,` becomes `>= 6` */
  [Op.gte]?: number | string | Date;

  /** Example: `[Op.lt]: 10,` becomes `< 10` */
  [Op.lt]?: number | string | Date;

  /** Example: `[Op.lte]: 10,` becomes `<= 10` */
  [Op.lte]?: number | string | Date;

  /** Example: `[Op.ne]: 20,` becomes `!= 20` */
  [Op.ne]?: string | number | WhereOperators;

  /** Example: `[Op.not]: true,` becomes `IS NOT TRUE` */
  [Op.not]?: boolean | string | number | WhereOperators;

  /** Example: `[Op.between]: [6, 10],` becomes `BETWEEN 6 AND 10` */
  [Op.between]?: [number, number];

  /** Example: `[Op.in]: [1, 2],` becomes `IN [1, 2]` */
  [Op.in]?: (string | number)[] | Literal;

  /** Example: `[Op.notIn]: [1, 2],` becomes `NOT IN [1, 2]` */
  [Op.notIn]?: (string | number)[] | Literal;

  /**
   * Examples:
   *  - `[Op.like]: '%hat',` becomes `LIKE '%hat'`
   *  - `[Op.like]: { [Op.any]: ['cat', 'hat']}` becomes `LIKE ANY ARRAY['cat', 'hat']`
   */
  [Op.like]?: string | AnyOperator | AllOperator;

  /**
   * Examples:
   *  - `[Op.notLike]: '%hat'` becomes `NOT LIKE '%hat'`
   *  - `[Op.notLike]: { [Op.any]: ['cat', 'hat']}` becomes `NOT LIKE ANY ARRAY['cat', 'hat']`
   */
  [Op.notLike]?: string | AnyOperator | AllOperator;

  /**
   * case insensitive PG only
   *
   * Examples:
   *  - `[Op.iLike]: '%hat'` becomes `ILIKE '%hat'`
   *  - `[Op.iLike]: { [Op.any]: ['cat', 'hat']}` becomes `ILIKE ANY ARRAY['cat', 'hat']`
   */
  [Op.iLike]?: string | AnyOperator | AllOperator;

  /**
   * PG array overlap operator
   *
   * Example: `[Op.overlap]: [1, 2]` becomes `&& [1, 2]`
   */
  [Op.overlap]?: [number, number];

  /**
   * PG array contains operator
   *
   * Example: `[Op.contains]: [1, 2]` becomes `@> [1, 2]`
   */
  [Op.contains]?: [number, number] | [Date, Date];

  /**
   * PG array contained by operator
   *
   * Example: `[Op.contained]: [1, 2]` becomes `<@ [1, 2]`
   */
  [Op.contained]?: [number, number] | [Date, Date];

  /** Example: `[Op.gt]: 6,` becomes `> 6` */
  [Op.gt]?: number | string | Date;

  /**
   * PG only
   *
   * Examples:
   *  - `[Op.notILike]: '%hat'` becomes `NOT ILIKE '%hat'`
   *  - `[Op.notLike]: ['cat', 'hat']` becomes `LIKE ANY ARRAY['cat', 'hat']`
   */
  [Op.notILike]?: string | AnyOperator | AllOperator;

  /** Example: `[Op.notBetween]: [11, 15],` becomes `NOT BETWEEN 11 AND 15` */
  [Op.notBetween]?: [number, number];

  /**
   * Strings starts with value.
   */
  [Op.startsWith]?: string;

  /**
   * String ends with value.
   */
  [Op.endsWith]?: string;
  /**
   * String contains value.
   */
  [Op.substring]?: string;

  /**
   * MySQL/PG only
   * 
   * Matches regular expression, case sensitive
   * 
   * Example: `[Op.regexp]: '^[h|a|t]'` becomes `REGEXP/~ '^[h|a|t]'`
   */
  [Op.regexp]?: string;

  /**
   * MySQL/PG only
   * 
   * Does not match regular expression, case sensitive
   * 
   * Example: `[Op.notRegexp]: '^[h|a|t]'` becomes `NOT REGEXP/!~ '^[h|a|t]'`
   */
  [Op.notRegexp]?: string;
  
  /**
   * PG only
   * 
   * Matches regular expression, case insensitive
   * 
   * Example: `[Op.iRegexp]: '^[h|a|t]'` becomes `~* '^[h|a|t]'`
   */
  [Op.iRegexp]?: string;

  /**
   * PG only
   * 
   * Does not match regular expression, case insensitive
   * 
   * Example: `[Op.notIRegexp]: '^[h|a|t]'` becomes `!~* '^[h|a|t]'`
   */
  [Op.notIRegexp]?: string;
}

/** Example: `[Op.or]: [{a: 5}, {a: 6}]` becomes `(a = 5 OR a = 6)` */
export interface OrOperator {
  [Op.or]: WhereOptions | WhereOptions[] | WhereValue | WhereValue[];
}

/** Example: `[Op.and]: {a: 5}` becomes `AND (a = 5)` */
export interface AndOperator {
  [Op.and]: WhereOptions | WhereOptions[] | WhereValue | WhereValue[];
}

/**
 * Where Geometry Options
 */
export interface WhereGeometryOptions {
  type: string;
  coordinates: (number[] | number)[];
}

/**
 * Used for the right hand side of WhereAttributeHash.
 * WhereAttributeHash is in there for JSON columns.
 */
export type WhereValue =
  | string // literal value
  | number // literal value
  | boolean // literal value
  | null
  | WhereOperators
  | WhereAttributeHash // for JSON columns
  | Col // reference another column
  | Fn
  | OrOperator
  | AndOperator
  | WhereGeometryOptions
  | (string | number | WhereAttributeHash)[]; // implicit [Op.or]

/**
 * A hash of attributes to describe your search.
 */
export interface WhereAttributeHash {
  /**
   * Possible key values:
   * - A simple attribute name
   * - A nested key for JSON columns
   *
   *  {
   *    "meta.audio.length": {
   *      [Op.gt]: 20
   *    }
   *  }
   */
  [field: string]: WhereValue | WhereOptions;
}
/**
 * Through options for Include Options
 */
export interface IncludeThroughOptions extends Filterable, Projectable {}

/**
 * Options for eager-loading associated models, also allowing for all associations to be loaded at once
 */
export type Includeable = typeof Model | Association | IncludeOptions | { all: true };

/**
 * Complex include options
 */
export interface IncludeOptions extends Filterable, Projectable {
  /**
   * The model you want to eagerly load
   */
  model?: typeof Model;

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
  on?: WhereOptions;

  /**
   * Note that this converts the eager load to an inner join,
   * unless you explicitly set `required: false`
   */
  where?: WhereOptions;

  /**
   * If true, converts to an inner join, which means that the parent model will only be loaded if it has any
   * matching children. True if `include.where` is set, false otherwise.
   */
  required?: boolean;

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

export type OrderItem =
  | string
  | Fn
  | Col
  | Literal
  | [string | Col | Fn | Literal, string]
  | [typeof Model | { model: typeof Model; as: string }, string, string]
  | [typeof Model, typeof Model, string, string];
export type Order = string | Fn | Col | Literal | OrderItem[];

/**
 * Please note if this is used the aliased property will not be available on the model instance
 * as a property but only via `instance.get('alias')`.
 */
export type ProjectionAlias = [string | Literal | Fn, string];

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

/**
 * Options that are passed to any model creating a SELECT query
 *
 * A hash of options to describe the scope of the search
 */
export interface FindOptions extends Logging, Transactionable, Filterable, Projectable, Paranoid {
  /**
   * A list of associations to eagerly load using a left join. Supported is either
   * `{ include: [ Model1, Model2, ...]}`, `{ include: [{ model: Model1, as: 'Alias' }]}` or
   * `{ include: [{ all: true }]}`.
   * If your association are set up with an `as` (eg. `X.hasMany(Y, { as: 'Z }`, you need to specify Z in
   * the as attribute when eager loading Y).
   */
  include?: Includeable[];

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
   * Limit the results
   */
  limit?: number;

  /**
   * Skip the results;
   */
  offset?: number;

  /**
   * Lock the selected rows. Possible options are transaction.LOCK.UPDATE and transaction.LOCK.SHARE.
   * Postgres also supports transaction.LOCK.KEY_SHARE, transaction.LOCK.NO_KEY_UPDATE and specific model
   * locks with joins. See [transaction.LOCK for an example](transaction#lock)
   */
  lock?: Transaction.LOCK | { level: Transaction.LOCK; of: typeof Model };

  /**
   * Return raw result. See sequelize.query for more information.
   */
  raw?: boolean;

  /**
   * Select group rows after groups and aggregates are computed.
   */
  having?: WhereOptions;

  /**
   * Use sub queries (internal)
   */
  subQuery?: boolean;
}

export interface NonNullFindOptions extends FindOptions {
  /**
   * Throw if nothing was found.
   */
  rejectOnEmpty: boolean;
}

/**
 * Options for Model.count method
 */
export interface CountOptions extends Logging, Transactionable, Filterable, Projectable, Paranoid {
  /**
   * Include options. See `find` for details
   */
  include?: Includeable[];

  /**
   * Apply COUNT(DISTINCT(col))
   */
  distinct?: boolean;

  /**
   * GROUP BY in sql
   * Used in conjunction with `attributes`.
   * @see Projectable
   */
  group?: GroupOption;

  /**
   * The column to aggregate on.
   */
  col?: string;
}

export interface FindAndCountOptions extends CountOptions, FindOptions {}

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
   * an array of include options - Used to build prefetched/included model instances. See `set`
   *
   * TODO: See set
   */
  include?: Includeable[];
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
export interface CreateOptions extends BuildOptions, Logging, Silent, Transactionable {
  /**
   * If set, only columns matching those in fields will be saved
   */
  fields?: string[];

  /**
   * On Duplicate
   */
  onDuplicate?: string;
}

/**
 * Options for Model.findOrCreate method
 */
export interface FindOrCreateOptions extends Logging, Transactionable {
  /**
   * A hash of search attributes.
   */
  where: WhereOptions;

  /**
   * Default values to use if building a new instance
   */
  defaults?: object;
}

/**
 * Options for Model.upsert method
 */
export interface UpsertOptions extends Logging, Transactionable, SearchPathable {
  /**
   * The fields to insert / update. Defaults to all fields
   */
  fields?: string[];

  /**
   * Run before / after bulk create hooks?
   */
  hooks?: boolean;

  /**
   * Return the affected rows (only for postgres)
   */
  returning?: boolean;

  /**
   * Run validations before the row is inserted
   */
  validate?: boolean;
}

/**
 * Options for Model.bulkCreate method
 */
export interface BulkCreateOptions extends Logging, Transactionable {
  /**
   * Fields to insert (defaults to all fields)
   */
  fields?: string[];

  /**
   * Should each row be subject to validation before it is inserted. The whole insert will fail if one row
   * fails validation
   */
  validate?: boolean;

  /**
   * Run before / after bulk create hooks?
   */
  hooks?: boolean;

  /**
   * Run before / after create hooks for each individual Instance? BulkCreate hooks will still be run if
   * options.hooks is true.
   */
  individualHooks?: boolean;

  /**
   * Ignore duplicate values for primary keys? (not supported by postgres)
   *
   * @default false
   */
  ignoreDuplicates?: boolean;

  /**
   * Fields to update if row key already exists (on duplicate key update)? (only supported by mysql &
   * mariadb). By default, all fields are updated.
   */
  updateOnDuplicate?: string[];

  /**
   * Return the affected rows (only for postgres)
   */
  returning?: boolean;
}

/**
 * The options passed to Model.destroy in addition to truncate
 */
export interface TruncateOptions extends Logging, Transactionable, Filterable {
  /**
   * Only used in conjuction with TRUNCATE. Truncates  all tables that have foreign-key references to the
   * named table, or to any tables added to the group due to CASCADE.
   *
   * @default false;
   */
  cascade?: boolean;

  /**
   * Run before / after bulk destroy hooks?
   */
  hooks?: boolean;

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
export interface DestroyOptions extends TruncateOptions {
  /**
   * If set to true, dialects that support it will use TRUNCATE instead of DELETE FROM. If a table is
   * truncated the where and limit options are ignored
   */
  truncate?: boolean;
}

/**
 * Options for Model.restore
 */
export interface RestoreOptions extends Logging, Transactionable, Filterable {
  /**
   * Run before / after bulk restore hooks?
   */
  hooks?: boolean;

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
export interface UpdateOptions extends Logging, Transactionable {
  /**
   * Options to describe the scope of the search.
   */
  where: WhereOptions;

  /**
   * Fields to update (defaults to all fields)
   */
  fields?: string[];

  /**
   * Should each row be subject to validation before it is inserted. The whole insert will fail if one row
   * fails validation.
   *
   * @default true
   */
  validate?: boolean;

  /**
   * Run before / after bulk update hooks?
   *
   * @default true
   */
  hooks?: boolean;

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
  returning?: boolean;

  /**
   * How many rows to update (only for mysql and mariadb)
   */
  limit?: number;
}

/**
 * Options used for Model.aggregate
 */
export interface AggregateOptions<T extends DataType | unknown> extends QueryOptions, Filterable, Paranoid {
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
export interface IncrementDecrementOptions extends Logging, Transactionable, Silent, SearchPathable, Filterable {}

/**
 * Options used for Instance.increment method
 */
export interface IncrementDecrementOptionsWithBy extends IncrementDecrementOptions {
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
export interface InstanceDestroyOptions extends Logging, Transactionable {
  /**
   * If set to true, paranoid models will actually be deleted
   */
  force?: boolean;
}

/**
 * Options used for Instance.update method
 */
export interface InstanceUpdateOptions extends SaveOptions, SetOptions, Filterable {}

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
export interface SaveOptions extends Logging, Transactionable, Silent {
  /**
   * An optional array of strings, representing database columns. If fields is provided, only those columns
   * will be validated and saved.
   */
  fields?: string[];

  /**
   * If false, validations won't be run.
   *
   * @default true
   */
  validate?: boolean;
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
   * is: ["^[a-z]+$",'i'] // will only allow letters
   * is: /^[a-z]+[Op./i]  // same as the previous example using real RegExp
   */
  is?: string | (string | RegExp)[] | RegExp | { msg: string; args: string | (string | RegExp)[] | RegExp };

  /**
   * not: ["[a-z]",'i']  // will not allow letters
   */
  not?: string | (string | RegExp)[] | RegExp | { msg: string; args: string | (string | RegExp)[] | RegExp };

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
  notIn?: string[][] | { msg: string; args: string[][] };

  /**
   * check the value is one of these
   */
  isIn?: string[][] | { msg: string; args: string[][] };

  /**
   * don't allow specific substrings
   */
  notContains?: string[] | string | { msg: string; args: string[] | string };

  /**
   * only allow values with length between 2 and 10
   */
  len?: [number, number] | { msg: string; args: [number, number] };

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
  max?: number | { msg: string; args: [number] };

  /**
   * only allow values >= 23
   */
  min?: number | { msg: string; args: [number] };

  /**
   * only allow arrays
   */
  isArray?: boolean | { msg: string; args: boolean };

  /**
   * check for valid credit card numbers
   */
  isCreditCard?: boolean | { msg: string; args: boolean };

  /**
   * custom validations are also possible
   *
   * Implementation notes :
   *
   * We can't enforce any other method to be a function, so :
   *
   * ```typescript
   * [name: string] : ( value : unknown ) => boolean;
   * ```
   *
   * doesn't work in combination with the properties above
   *
   * @see https://github.com/Microsoft/TypeScript/issues/1889
   */
  [name: string]: unknown;
}

/**
 * Interface for indexes property in InitOptions
 */
export interface ModelIndexesOptions {
  /**
   * The name of the index. Defaults to model name + _ + fields concatenated
   */
  name?: string;

  /**
   * Index type. Only used by mysql. One of `UNIQUE`, `FULLTEXT` and `SPATIAL`
   */
  index?: string;

  /**
   * The method to create the index by (`USING` statement in SQL). BTREE and HASH are supported by mysql and
   * postgres, and postgres additionally supports GIST and GIN.
   */
  method?: string;

  /**
   * Should the index by unique? Can also be triggered by setting type to `UNIQUE`
   *
   * @default false
   */
  unique?: boolean;

  /**
   * PostgreSQL will build the index without taking any write locks. Postgres only
   *
   * @default false
   */
  concurrently?: boolean;

  /**
   * An array of the fields to index. Each field can either be a string containing the name of the field,
   * a sequelize object (e.g `sequelize.fn`), or an object with the following attributes: `attribute`
   * (field name), `length` (create a prefix index of length chars), `order` (the direction the column
   * should be sorted in), `collate` (the collation (sort order) for the column)
   */
  fields?: (string | { attribute: string; length: number; order: string; collate: string })[];
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
 * Interface for getterMethods in InitOptions
 */
export interface ModelGetterOptions {
  [name: string]: (this: Model) => unknown;
}

/**
 * Interface for setterMethods in InitOptions
 */
export interface ModelSetterOptions {
  [name: string]: (this: Model, val: any) => void;
}

/**
 * Interface for Define Scope Options
 */
export interface ModelScopeOptions {
  /**
   * Name of the scope and it's query
   */
  [scopeName: string]: FindOptions | ((...args: any[]) => FindOptions);
}

/**
 * General column options
 */
export interface ColumnOptions {
  /**
   * If false, the column will have a NOT NULL constraint, and a not null validation will be run before an
   * instance is saved.
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
  model?: string | typeof Model;

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
export interface ModelAttributeColumnOptions extends ColumnOptions {
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
   * Comment for the database
   */
  comment?: string;

  /**
   * An object with reference configurations
   */
  references?: ModelAttributeColumnReferencesOptions;

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
  values?: string[];

  /**
   * Provide a custom getter for this column. Use `this.getDataValue(String)` to manipulate the underlying
   * values.
   */
  get?(): unknown;

  /**
   * Provide a custom setter for this column. Use `this.setDataValue(String, Value)` to manipulate the
   * underlying values.
   */
  set?(val: unknown): void;
}

/**
 * Interface for Attributes provided for a column
 */
export interface ModelAttributes {
  /**
   * The description of a database column
   */
  [name: string]: DataType | ModelAttributeColumnOptions;
}

/**
 * Possible types for primary keys
 */
export type Identifier = number | string | Buffer;

/**
 * Options for model definition
 */
export interface ModelOptions<M extends Model = Model> {
  /**
   * Define the default search scope to use for this model. Scopes have the same form as the options passed to
   * find / findAll.
   */
  defaultScope?: FindOptions;

  /**
   * More scopes, defined in the same way as defaultScope above. See `Model.scope` for more information about
   * how scopes are defined, and what you can do with them
   */
  scopes?: ModelScopeOptions;

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
  indexes?: ModelIndexesOptions[];

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
  hooks?: Partial<ModelHooks<M>>;

  /**
   * An object of model wide validations. Validations have access to all model values via `this`. If the
   * validator function takes an argument, it is asumed to be async, and is called with a callback that
   * accepts an optional error.
   */
  validate?: ModelValidateOptions;

  /**
   * Allows defining additional setters that will be available on model instances.
   */
  setterMethods?: ModelSetterOptions;

  /**
   * Allows defining additional getters that will be available on model instances.
   */
  getterMethods?: ModelGetterOptions;

  /**
   * Enable optimistic locking.
   * When enabled, sequelize will add a version count attribute to the model and throw an
   * OptimisticLockingError error when stale instances are saved.
   * - If string: Uses the named attribute.
   * - If boolean: Uses `version`.
   * @default false
   */
  version?: boolean | string;
}

/**
 * Options passed to [[Model.init]]
 */
export interface InitOptions extends ModelOptions {
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

export abstract class Model<T = any, T2 = any> extends Hooks {
  /** The name of the database table */
  public static readonly tableName: string;

  /**
   * The name of the primary key attribute
   */
  public static readonly primaryKeyAttribute: string;

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

  /**
   * The attributes of the model
   */
  public static readonly rawAttributes: { [attribute: string]: ModelAttributeColumnOptions };

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
   * For a list of possible data types, see http://docs.sequelizejs.com/en/latest/docs/models-definition/#data-types
   *
   * For more about getters and setters, see http://docs.sequelizejs.com/en/latest/docs/models-definition/#getters-setters
   *
   * For more about instance and class methods, see http://docs.sequelizejs.com/en/latest/docs/models-definition/#expansion-of-models
   *
   * For more about validation, see http://docs.sequelizejs.com/en/latest/docs/models-definition/#validations
   *
   * @param attributes
   *  An object, where each attribute is a column of the table. Each column can be either a DataType, a
   *  string or a type-description object, with the properties described below:
   * @param options These options are merged with the default define options provided to the Sequelize constructor
   */
  public static init(attributes: ModelAttributes, options: InitOptions): void;

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
  public static sync(options?: SyncOptions): Promise<Model>;

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
    this: { new (): M } & typeof Model,
    schema: string,
    options?: SchemaOptions
  ): { new (): M } & typeof Model;

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
   * @return Model A reference to the model, with the scope(s) applied. Calling scope again on the returned
   *  model will clear the previous scope.
   */
  public static scope<M extends { new (): Model }>(
    this: M,
    options?: string | string[] | ScopeOptions | WhereAttributeHash
  ): M;

  public static addScope(name: string, scope: FindOptions, options?: AddScopeOptions): void;

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
  public static findAll<M extends Model>(this: { new (): M } & typeof Model, options?: FindOptions): Promise<M[]>;

  /**
   * Search for a single instance by its primary key. This applies LIMIT 1, so the listener will
   * always be called with a single instance.
   */
  public static findByPk<M extends Model>(
    this: { new (): M } & typeof Model,
    identifier?: Identifier,
    options?: FindOptions
  ): Promise<M | null>;
  public static findByPk<M extends Model>(
    this: { new (): M } & typeof Model,
    identifier: Identifier,
    options: NonNullFindOptions
  ): Promise<M>;

  /**
   * Search for a single instance. This applies LIMIT 1, so the listener will always be called with a single
   * instance.
   */
  public static findOne<M extends Model>(
    this: { new (): M } & typeof Model,
    options?: FindOptions
  ): Promise<M | null>;
  public static findOne<M extends Model>(this: { new (): M } & typeof Model, options: NonNullFindOptions): Promise<M>;

  /**
   * Run an aggregation method on the specified field
   *
   * @param field The field to aggregate over. Can be a field name or *
   * @param aggregateFunction The function to use for aggregation, e.g. sum, max etc.
   * @param options Query options. See sequelize.query for full options
   * @return Returns the aggregate result cast to `options.dataType`, unless `options.plain` is false, in
   *     which case the complete data result is returned.
   */
  public static aggregate<M extends Model, T extends DataType | unknown>(
    this: { new (): M } & typeof Model,
    field: keyof M,
    aggregateFunction: string,
    options?: AggregateOptions<T>
  ): Promise<T>;

  /**
   * Count the number of records matching the provided where clause.
   *
   * If you provide an `include` option, the number of matching associations will be counted instead.
   */
  public static count(options?: CountOptions): Promise<number>;

  /**
   * Find all the rows matching your query, within a specified offset / limit, and get the total number of
   * rows matching your query. This is very usefull for paging
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
   *   limit 3
   * });
   * ```
   * Because the include for `Profile` has `required` set it will result in an inner join, and only the users
   * who have a profile will be counted. If we remove `required` from the include, both users with and
   * without
   * profiles will be counted
   */
  public static findAndCountAll<M extends Model>(
    this: { new (): M } & typeof Model,
    options?: FindAndCountOptions
  ): Promise<{ rows: M[]; count: number }>;

  /**
   * Find the maximum value of field
   */
  public static max<M extends Model, T extends DataType | unknown>(
    this: { new (): M } & typeof Model,
    field: keyof M,
    options?: AggregateOptions<T>
  ): Promise<T>;

  /**
   * Find the minimum value of field
   */
  public static min<M extends Model, T extends DataType | unknown>(
    this: { new (): M } & typeof Model,
    field: keyof M,
    options?: AggregateOptions<T>
  ): Promise<T>;

  /**
   * Find the sum of field
   */
  public static sum<M extends Model, T extends DataType | unknown>(
    this: { new (): M } & typeof Model,
    field: keyof M,
    options?: AggregateOptions<T>
  ): Promise<number>;

  /**
   * Builds a new model instance. Values is an object of key value pairs, must be defined but can be empty.
   */
  public static build<M extends Model>(
    this: { new (): M } & typeof Model,
    record?: object,
    options?: BuildOptions
  ): M;

  /**
   * Undocumented bulkBuild
   */
  public static bulkBuild<M extends Model>(
    this: { new (): M } & typeof Model,
    records: object[],
    options?: BuildOptions
  ): M[];

  /**
   * Builds a new model instance and calls save on it.
   */
  public static create<M extends Model>(
    this: { new (): M } & typeof Model,
    values?: object,
    options?: CreateOptions
  ): Promise<M>;
  public static create(values: object, options: CreateOptions & { returning: false }): Promise<void>;

  /**
   * Find a row that matches the query, or build (but don't save) the row if none is found.
   * The successfull result of the promise will be (instance, initialized) - Make sure to use `.then(([...]))`
   */
  public static findOrBuild<M extends Model>(
    this: { new (): M } & typeof Model,
    options: FindOrCreateOptions
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
    this: { new (): M } & typeof Model,
    options: FindOrCreateOptions
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
   * **Note** that SQLite returns undefined for created, no matter if the row was created or updated. This is
   * because SQLite always runs INSERT OR IGNORE + UPDATE, in a single query, so there is no way to know
   * whether the row was inserted or not.
   */
  public static upsert<M extends Model>(
    this: { new (): M } & typeof Model,
    values: object,
    options?: UpsertOptions
  ): Promise<boolean>;

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
    this: { new (): M } & typeof Model,
    records: object[],
    options?: BulkCreateOptions
  ): Promise<M[]>;

  /**
   * Truncate all instances of the model. This is a convenient method for Model.destroy({ truncate: true }).
   */
  public static truncate(options?: TruncateOptions): Promise<void>;

  /**
   * Delete multiple instances, or set their deletedAt timestamp to the current time if `paranoid` is enabled.
   *
   * @return Promise<number> The number of destroyed rows
   */
  public static destroy(options?: DestroyOptions): Promise<number>;

  /**
   * Restore multiple instances if `paranoid` is enabled.
   */
  public static restore(options?: RestoreOptions): Promise<void>;

  /**
   * Update multiple instances that match the where options. The promise returns an array with one or two
   * elements. The first element is always the number of affected rows, while the second element is the actual
   * affected rows (only supported in postgres with `options.returning` true.)
   */
  public static update<M extends Model>(
    this: { new (): M } & typeof Model,
    values: object,
    options: UpdateOptions
  ): Promise<[number, M[]]>;

  /**
   * Increments a single field.
   */
  public static increment<M extends Model, K extends keyof M>(
    this: { new (): M },
    field: K,
    options: IncrementDecrementOptionsWithBy
  ): Promise<M>;

  /**
   * Increments multiple fields by the same value.
   */
  public static increment<M extends Model, K extends keyof M>(
    this: { new (): M },
    fields: K[],
    options: IncrementDecrementOptionsWithBy
  ): Promise<M>;

  /**
   * Increments multiple fields by different values.
   */
  public static increment<M extends Model, K extends keyof M>(
    this: { new (): M },
    fields: { [key in K]?: number },
    options: IncrementDecrementOptions
  ): Promise<M>;

  /**
   * Run a describe query on the table. The result will be return to the listener as a hash of attributes and
   * their types.
   */
  public static describe(): Promise<object>;

  /**
   * Unscope the model
   */
  public static unscoped<M extends typeof Model>(this: M): M;

  /**
   * A hook that is run before validation
   *
   * @param name
   * @param fn A callback function that is called with instance, options
   */
  public static beforeValidate<M extends Model>(
    this: { new (): M } & typeof Model,
    name: string,
    fn: (instance: M, options: ValidationOptions) => HookReturn
  ): void;
  public static beforeValidate<M extends Model>(
    this: { new (): M } & typeof Model,
    fn: (instance: M, options: ValidationOptions) => HookReturn
  ): void;

  /**
   * A hook that is run after validation
   *
   * @param name
   * @param fn A callback function that is called with instance, options
   */
  public static afterValidate<M extends Model>(
    this: { new (): M } & typeof Model,
    name: string,
    fn: (instance: M, options: ValidationOptions) => HookReturn
  ): void;
  public static afterValidate<M extends Model>(
    this: { new (): M } & typeof Model,
    fn: (instance: M, options: ValidationOptions) => HookReturn
  ): void;

  /**
   * A hook that is run before creating a single instance
   *
   * @param name
   * @param fn A callback function that is called with attributes, options
   */
  public static beforeCreate<M extends Model>(
    this: { new (): M } & typeof Model,
    name: string,
    fn: (attributes: M, options: CreateOptions) => HookReturn
  ): void;
  public static beforeCreate<M extends Model>(
    this: { new (): M } & typeof Model,
    fn: (attributes: M, options: CreateOptions) => HookReturn
  ): void;

  /**
   * A hook that is run after creating a single instance
   *
   * @param name
   * @param fn A callback function that is called with attributes, options
   */
  public static afterCreate<M extends Model>(
    this: { new (): M } & typeof Model,
    name: string,
    fn: (attributes: M, options: CreateOptions) => HookReturn
  ): void;
  public static afterCreate<M extends Model>(
    this: { new (): M } & typeof Model,
    fn: (attributes: M, options: CreateOptions) => HookReturn
  ): void;

  /**
   * A hook that is run before destroying a single instance
   *
   * @param name
   * @param fn A callback function that is called with instance, options
   */
  public static beforeDestroy<M extends Model>(
    this: { new (): M } & typeof Model,
    name: string,
    fn: (instance: M, options: InstanceDestroyOptions) => HookReturn
  ): void;
  public static beforeDestroy<M extends Model>(
    this: { new (): M } & typeof Model,
    fn: (instance: Model, options: InstanceDestroyOptions) => HookReturn
  ): void;

  /**
   * A hook that is run after destroying a single instance
   *
   * @param name
   * @param fn A callback function that is called with instance, options
   */
  public static afterDestroy<M extends Model>(
    this: { new (): M } & typeof Model,
    name: string,
    fn: (instance: M, options: InstanceDestroyOptions) => HookReturn
  ): void;
  public static afterDestroy<M extends Model>(
    this: { new (): M } & typeof Model,
    fn: (instance: M, options: InstanceDestroyOptions) => HookReturn
  ): void;

  /**
   * A hook that is run before updating a single instance
   *
   * @param name
   * @param fn A callback function that is called with instance, options
   */
  public static beforeUpdate<M extends Model>(
    this: { new (): M } & typeof Model,
    name: string,
    fn: (instance: M, options: UpdateOptions) => HookReturn
  ): void;
  public static beforeUpdate<M extends Model>(
    this: { new (): M } & typeof Model,
    fn: (instance: M, options: UpdateOptions) => HookReturn
  ): void;

  /**
   * A hook that is run after updating a single instance
   *
   * @param name
   * @param fn A callback function that is called with instance, options
   */
  public static afterUpdate<M extends Model>(
    this: { new (): M } & typeof Model,
    name: string,
    fn: (instance: M, options: UpdateOptions) => HookReturn
  ): void;
  public static afterUpdate<M extends Model>(
    this: { new (): M } & typeof Model,
    fn: (instance: M, options: UpdateOptions) => HookReturn
  ): void;

  /**
   * A hook that is run before creating instances in bulk
   *
   * @param name
   * @param fn A callback function that is called with instances, options
   */
  public static beforeBulkCreate<M extends Model>(
    this: { new (): M } & typeof Model,
    name: string,
    fn: (instances: M[], options: BulkCreateOptions) => HookReturn
  ): void;
  public static beforeBulkCreate<M extends Model>(
    this: { new (): M } & typeof Model,
    fn: (instances: M[], options: BulkCreateOptions) => HookReturn
  ): void;

  /**
   * A hook that is run after creating instances in bulk
   *
   * @param name
   * @param fn A callback function that is called with instances, options
   */
  public static afterBulkCreate<M extends Model>(
    this: { new (): M } & typeof Model,
    name: string,
    fn: (instances: M[], options: BulkCreateOptions) => HookReturn
  ): void;
  public static afterBulkCreate<M extends Model>(
    this: { new (): M } & typeof Model,
    fn: (instances: M[], options: BulkCreateOptions) => HookReturn
  ): void;

  /**
   * A hook that is run before destroying instances in bulk
   *
   * @param name
   * @param fn   A callback function that is called with options
   */
  public static beforeBulkDestroy(name: string, fn: (options: BulkCreateOptions) => HookReturn): void;
  public static beforeBulkDestroy(fn: (options: BulkCreateOptions) => HookReturn): void;

  /**
   * A hook that is run after destroying instances in bulk
   *
   * @param name
   * @param fn   A callback function that is called with options
   */
  public static afterBulkDestroy(name: string, fn: (options: DestroyOptions) => HookReturn): void;
  public static afterBulkDestroy(fn: (options: DestroyOptions) => HookReturn): void;

  /**
   * A hook that is run after updating instances in bulk
   *
   * @param name
   * @param fn   A callback function that is called with options
   */
  public static beforeBulkUpdate(name: string, fn: (options: UpdateOptions) => HookReturn): void;
  public static beforeBulkUpdate(fn: (options: UpdateOptions) => HookReturn): void;

  /**
   * A hook that is run after updating instances in bulk
   *
   * @param name
   * @param fn   A callback function that is called with options
   */
  public static afterBulkUpdate(name: string, fn: (options: UpdateOptions) => HookReturn): void;
  public static afterBulkUpdate(fn: (options: UpdateOptions) => HookReturn): void;

  /**
   * A hook that is run before a find (select) query
   *
   * @param name
   * @param fn   A callback function that is called with options
   */
  public static beforeFind(name: string, fn: (options: FindOptions) => HookReturn): void;
  public static beforeFind(fn: (options: FindOptions) => HookReturn): void;

  /**
   * A hook that is run before a count query
   *
   * @param name
   * @param fn   A callback function that is called with options
   */
  public static beforeCount(name: string, fn: (options: CountOptions) => HookReturn): void;
  public static beforeCount(fn: (options: CountOptions) => HookReturn): void;

  /**
   * A hook that is run before a find (select) query, after any { include: {all: ...} } options are expanded
   *
   * @param name
   * @param fn   A callback function that is called with options
   */
  public static beforeFindAfterExpandIncludeAll(name: string, fn: (options: FindOptions) => HookReturn): void;
  public static beforeFindAfterExpandIncludeAll(fn: (options: FindOptions) => HookReturn): void;

  /**
   * A hook that is run before a find (select) query, after all option parsing is complete
   *
   * @param name
   * @param fn   A callback function that is called with options
   */
  public static beforeFindAfterOptions(name: string, fn: (options: FindOptions) => HookReturn): void;
  public static beforeFindAfterOptions(fn: (options: FindOptions) => void): HookReturn;

  /**
   * A hook that is run after a find (select) query
   *
   * @param name
   * @param fn   A callback function that is called with instance(s), options
   */
  public static afterFind<M extends Model>(
    this: { new (): M } & typeof Model,
    name: string,
    fn: (instancesOrInstance: M[] | M, options: FindOptions) => HookReturn
  ): void;
  public static afterFind<M extends Model>(
    this: { new (): M } & typeof Model,
    fn: (instancesOrInstance: M[] | M, options: FindOptions) => HookReturn
  ): void;

  /**
   * A hook that is run before sequelize.sync call
   * @param fn   A callback function that is called with options passed to sequelize.sync
   */
  public static beforeBulkSync(name: string, fn: (options: SyncOptions) => HookReturn): void;
  public static beforeBulkSync(fn: (options: SyncOptions) => HookReturn): void;

  /**
   * A hook that is run after sequelize.sync call
   * @param fn   A callback function that is called with options passed to sequelize.sync
   */
  public static afterBulkSync(name: string, fn: (options: SyncOptions) => HookReturn): void;
  public static afterBulkSync(fn: (options: SyncOptions) => HookReturn): void;

  /**
   * A hook that is run before Model.sync call
   * @param fn   A callback function that is called with options passed to Model.sync
   */
  public static beforeSync(name: string, fn: (options: SyncOptions) => HookReturn): void;
  public static beforeSync(fn: (options: SyncOptions) => HookReturn): void;

  /**
   * A hook that is run after Model.sync call
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
    this: ModelCtor<M>, target: ModelCtor<T>, options?: HasOneOptions
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
    this: ModelCtor<M>, target: ModelCtor<T>, options?: BelongsToOptions
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
    this: ModelCtor<M>, target: ModelCtor<T>, options?: HasManyOptions
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
    this: ModelCtor<M>, target: ModelCtor<T>, options: BelongsToManyOptions
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
   * @param values an object of key value pairs
   */
  constructor(values?: object, options?: BuildOptions);

  /**
   * Get an object representing the query for this instance, use with `options.where`
   */
  public where(): object;

  /**
   * Get the value of the underlying data value
   */
  public getDataValue<K extends keyof this>(key: K): this[K];

  /**
   * Update the underlying data value
   */
  public setDataValue<K extends keyof this>(key: K, value: this[K]): void;

  /**
   * If no key is given, returns all values of the instance, also invoking virtual getters.
   *
   * If key is given and a field or virtual getter is present for the key it will call that getter - else it
   * will return the value for key.
   *
   * @param options.plain If set to true, included instances will be returned as plain objects
   */
  public get(options?: { plain?: boolean; clone?: boolean }): object;
  public get(key: string, options?: { plain?: boolean; clone?: boolean }): unknown;
  public get<K extends keyof this>(key: K, options?: { plain?: boolean; clone?: boolean }): this[K];

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
  public set<K extends keyof this>(key: K, value: this[K], options?: SetOptions): this;
  public set(keys: Partial<this>, options?: SetOptions): this;
  public setAttributes<K extends keyof this>(key: K, value: this[K], options?: SetOptions): this;
  public setAttributes(keys: object, options?: SetOptions): this;

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
  public previous<K extends keyof this>(key: K): this[K];

  /**
   * Validate this instance, and if the validation passes, persist it to the database.
   *
   * On success, the callback will be called with this instance. On validation error, the callback will be
   * called with an instance of `Sequelize.ValidationError`. This error will have a property for each of the
   * fields for which validation failed, with the error message for that field.
   */
  public save(options?: SaveOptions): Promise<this>;

  /**
   * Refresh the current instance in-place, i.e. update the object with current data from the DB and return
   * the same object. This is different from doing a `find(Instance.id)`, because that would create and
   * return a new instance. With this method, all references to the Instance are updated with the new data
   * and no new objects are created.
   */
  public reload(options?: FindOptions): Promise<this>;

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
  public update<K extends keyof this>(key: K, value: this[K], options?: InstanceUpdateOptions): Promise<this>;
  public update(keys: object, options?: InstanceUpdateOptions): Promise<this>;

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
  public increment<K extends keyof this>(
    fields: K | K[] | Partial<this>,
    options?: IncrementDecrementOptionsWithBy
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
  public decrement<K extends keyof this>(
    fields: K | K[] | Partial<this>,
    options?: IncrementDecrementOptionsWithBy
  ): Promise<this>;

  /**
   * Check whether all values of this and `other` Instance are the same
   */
  public equals(other: this): boolean;

  /**
   * Check if this is eqaul to one of `others` by calling equals
   */
  public equalsOneOf(others: this[]): boolean;

  /**
   * Convert the instance to a JSON representation. Proxies to calling `get` with no keys. This means get all
   * values gotten from the DB, and apply all custom getters.
   */
  public toJSON(): object;
}

export type ModelType = typeof Model;

export type ModelCtor<M extends Model> = { new (): M } & ModelType;

export default Model;
