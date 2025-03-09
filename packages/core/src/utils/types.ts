import type { NonUndefined, PartialBy } from '@sequelize/utils';

export type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    }
  : T;

export type DeepWriteable<T> = {
  -readonly [K in keyof T]: T[K] extends Function ? T[K] : DeepWriteable<T[K]>;
};

/**
 * Returns all shallow properties that accept `undefined` or `null`.
 * Does not include Optional properties, only `undefined` or `null`.
 *
 * @example
 * ```typescript
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
 * ```
 */
export type NullishPropertiesOf<T> = {
  [P in keyof T]-?: undefined extends T[P] ? P : null extends T[P] ? P : never;
}[keyof T];

/**
 * Makes all shallow properties of an object `optional` if they accept `undefined` or `null` as a value.
 *
 * @example
 * ```typescript
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
 * ```
 */
export type MakeNullishOptional<T extends object> = PartialBy<T, NullishPropertiesOf<T>>;

export type NonUndefinedKeys<T, K extends keyof T> = {
  [P in keyof T]: P extends K ? NonUndefined<T[P]> : T[P];
};

export type AllowLowercase<T extends string> = T | Lowercase<T>;

export type ConstructorKeys<T> = {
  [P in keyof T]: T[P] extends new () => any ? P : never;
}[keyof T];

type NonConstructorKeys<T> = { [P in keyof T]: T[P] extends new () => any ? never : P }[keyof T];

export type OmitConstructors<T> = Pick<T, NonConstructorKeys<T>>;
