import { DataType } from './data-types';
import { Model, ModelCtor, ModelType, WhereOptions, Attributes } from './model';
import { Optional } from './index';

export type Primitive = 'string' | 'number' | 'boolean';

export type DeepWriteable<T> = { -readonly [P in keyof T]: DeepWriteable<T[P]> };

export interface Inflector {
  singularize(str: string): string;
  pluralize(str: string): string;
}

export function useInflection(inflection: Inflector): void;

export function camelizeIf(string: string, condition?: boolean): string;
export function underscoredIf(string: string, condition?: boolean): string;
export function isPrimitive(val: unknown): val is Primitive;

/** Same concept as _.merge, but don't overwrite properties that have already been assigned */
export function mergeDefaults<T>(a: T, b: Partial<T>): T;
export function spliceStr(str: string, index: number, count: number, add: string): string;
export function camelize(str: string): string;
export function format(arr: string[], dialect: string): string;
export function formatNamedParameters(sql: string, parameters: {
  [key: string]: string | number | boolean;
}, dialect: string): string;
export function cloneDeep<T>(obj: T, fn?: (el: unknown) => unknown): T;

export interface OptionsForMapping<TAttributes> {
  attributes?: string[];
  where?: WhereOptions<TAttributes>;
}

/** Expand and normalize finder options */
export function mapFinderOptions<M extends Model, T extends OptionsForMapping<Attributes<M>>>(
  options: T,
  model: ModelCtor<M>
): T;

/* Used to map field names in attributes and where conditions */
export function mapOptionFieldNames<M extends Model, T extends OptionsForMapping<Attributes<M>>>(
  options: T, model: ModelCtor<M>
): T;

export function mapWhereFieldNames(attributes: object, model: ModelType): object;
/** Used to map field names in values */
export function mapValueFieldNames(dataValues: object, fields: string[], model: ModelType): object;

export function isColString(value: string): boolean;
export function canTreatArrayAsAnd(arr: unknown[]): boolean;
export function combineTableNames(tableName1: string, tableName2: string): string;

export function singularize(s: string): string;
export function pluralize(s: string): string;

export function toDefaultValue<T>(value: unknown): unknown;

/**
 * Determine if the default value provided exists and can be described
 * in a db schema using the DEFAULT directive.
 *
 * @param value Any default value.
 */
export function defaultValueSchemable(hash: DataType): boolean;
export function stack(): NodeJS.CallSite[];
export function now(dialect: string): Date;

// Note: Use the `quoteIdentifier()` and `escape()` methods on the
// `QueryInterface` instead for more portable code.
export const TICK_CHAR: string;
export function addTicks(s: string, tickChar?: string): string;
export function removeTicks(s: string, tickChar?: string): string;

/**
 * Wraps a constructor to not need the `new` keyword using a proxy.
 * Only used for data types.
 */
export function classToInvokable<T extends new (...args: any[]) => any>(ctor: T): T & {
  (...args: ConstructorParameters<T>): T;
}

export class SequelizeMethod {

}

/*
 * Utility functions for representing SQL functions, and columns that should be escaped.
 * Please do not use these functions directly, use Sequelize.fn and Sequelize.col instead.
 */
export class Fn extends SequelizeMethod {
  constructor(fn: string, args: unknown[]);
  public clone(): this;
}

export class Col extends SequelizeMethod {
  public col: string;
  constructor(col: string);
}

export class Cast extends SequelizeMethod {
  public val: unknown;
  public type: string;
  constructor(val: unknown, type?: string);
}

export class Literal extends SequelizeMethod {
  public val: unknown;
  constructor(val: unknown);
}

export class Json extends SequelizeMethod {
  public conditions: object;
  public path: string;
  public value: string | number | boolean;
  constructor(conditionsOrPath: string | object, value?: string | number | boolean);
}

export class Where extends SequelizeMethod {
  public attribute: object;
  public comparator: string;
  public logic: string | object;
  constructor(attr: object, comparator: string, logic: string | object);
  constructor(attr: object, logic: string | object);
}

export type AnyFunction = (...args: any[]) => any;

/**
 * Returns all shallow properties that accept `undefined` or `null`.
 * Does not include Optional properties, only `undefined` or `null`.
 *
 * @example
 * type UndefinedProps = NullishPropertiesOf<{
 *   id: number | undefined,
 *   createdAt: string | undefined,
 *   firstName: string | null, // nullable properties are included
 *   lastName?: string, // optional properties are not included.
 * }>;
 *
 * // is equal to
 *
 * type UndefinedProps = 'id' | 'createdAt' | 'firstName';
 */
export type NullishPropertiesOf<T> = {
  [P in keyof T]-?: undefined extends T[P] ? P
    : null extends T[P] ? P
    : never
}[keyof T];

/**
 * Makes all shallow properties of an object `optional` if they accept `undefined` or `null` as a value.
 *
 * @example
 * type MyOptionalType = MakeUndefinedOptional<{
 *   id: number | undefined,
 *   firstName: string,
 *   lastName: string | null,
 * }>;
 *
 * // is equal to
 *
 * type MyOptionalType = {
 *   // this property is optional.
 *   id?: number | undefined,
 *   firstName: string,
 *   // this property is optional.
 *   lastName?: string | null,
 * };
 */
// 'T extends any' is done to support https://github.com/sequelize/sequelize/issues/14129
// source: https://stackoverflow.com/questions/51691235/typescript-map-union-type-to-another-union-type
export type MakeNullishOptional<T extends object> = T extends any ? Optional<T, NullishPropertiesOf<T>> : never;
