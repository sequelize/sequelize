import { DataType } from './data-types';

export type Primitive = 'string' | 'number' | 'boolean';

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
export function cloneDeep<T>(obj: T, fn?: (el: any) => any): T;

/** Expand and normalize finder options */
export function mapFinderOptions(options: any, Model: any): any;

/* Used to map field names in attributes and where conditions */
export function mapOptionFieldNames(options: any, Model: any): any;

export function mapWhereFieldNames(attributes: any, Model: any): any;
/** Used to map field names in values */
export function mapValueFieldNames(dataValues: any, fields: any, Model: any): any;

export function isColString(value: string): boolean;
export function canTreatArrayAsAnd(arr: unknown[]): boolean;
export function combineTableNames(tableName1: string, tableName2: string): string;

export function singularize(s: string): string;
export function pluralize(s: string): string;

export function toDefaultValue(value: any): any;

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

export class SequelizeMethod {

}

/*
 * Utility functions for representing SQL functions, and columns that should be escaped.
 * Please do not use these functions directly, use Sequelize.fn and Sequelize.col instead.
 */
export class Fn extends SequelizeMethod {
  constructor(fn: string, args: any);
  public clone(): this;
}

export class Col extends SequelizeMethod {
  public col: string;
  constructor(col: string);
}

export class Cast extends SequelizeMethod {
  public val: any;
  public type: string;
  constructor(val: any, type?: string);
}

export class Literal extends SequelizeMethod {
  public val: any;
  constructor(val: any);
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

export { Promise } from './promise';
