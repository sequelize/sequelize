import type { Optional } from '../..';
import { getComplexKeys } from './format';

export * from './array';
export * from './check';
export * from './class-to-invokable';
export * from './dialect';
export * from './format';
export * from './join-sql-fragments';
export * from './object';
export * from './sequelize-method';
export * from './string';

/**
 * getComplexSize
 *
 * @param obj
 * @returns Length of object properties including operators if obj is array returns its length
 * @private
 */
export function getComplexSize(obj: object | any[]): number {
  return Array.isArray(obj) ? obj.length : getComplexKeys(obj).length;
}

export type DeepWriteable<T> = { -readonly [P in keyof T]: DeepWriteable<T[P]> };

export type PartlyRequired<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

export type AnyFunction = (...args: any[]) => any;

/**
 * Returns all shallow properties that accept `undefined`.
 * Does not include Optional properties, only `undefined`.
 *
 * @example
 * type UndefinedProps = UndefinedPropertiesOf<{
 *   id: number | undefined,
 *   createdAt: string | undefined,
 *   firstName: string,
 *   lastName?: string, // optional properties are not included.
 * }>;
 *
 * // is equal to
 *
 * type UndefinedProps = 'id' | 'createdAt';
 */
export type UndefinedPropertiesOf<T> = {
  [P in keyof T]-?: undefined extends T[P] ? P : never
}[keyof T];

/**
 * Makes all shallow properties of an object `optional` if they accept `undefined` as a value.
 *
 * @example
 * type MyOptionalType = MakeUndefinedOptional<{
 *   id: number | undefined,
 *   name: string,
 * }>;
 *
 * // is equal to
 *
 * type MyOptionalType = {
 *   // this property is optional.
 *   id?: number | undefined,
 *   name: string,
 * };
 */
export type MakeUndefinedOptional<T extends object> = Optional<T, UndefinedPropertiesOf<T>>;
