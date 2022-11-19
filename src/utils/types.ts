export type DeepPartial<T> = T extends object ? {
  [P in keyof T]?: DeepPartial<T[P]>;
} : T;

export type DeepWriteable<T> = {
  -readonly [K in keyof T]: T[K] extends Function ? T[K] : DeepWriteable<T[K]>
};

export type PartlyRequired<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

export type AnyFunction = (...args: any[]) => any;

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
  [P in keyof T]-?: undefined extends T[P] ? P
    : null extends T[P] ? P
      : never
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
export type MakeNullishOptional<T extends object> = Optional<T, NullishPropertiesOf<T>>;

/**
 * Makes the type accept null & undefined
 */
export type Nullish<T> = T | null | undefined;

export type AllowArray<T> = T | T[];

export type AllowReadonlyArray<T> = T | readonly T[];

export type ConstructorKeys<T> = ({ [P in keyof T]: T[P] extends new () => any ? P : never })[keyof T];

type NonConstructorKeys<T> = ({ [P in keyof T]: T[P] extends new () => any ? never : P })[keyof T];

export type OmitConstructors<T> = Pick<T, NonConstructorKeys<T>>;

/**
 * Type helper for making certain fields of an object optional. This is helpful
 * for creating the `CreationAttributes` from your `Attributes` for a Model.
 */
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Full credits to sindresorhus/type-fest
 *
 * https://github.com/sindresorhus/type-fest/blob/v0.8.1/source/set-required.d.ts
 *
 * Thank you!
 */
export type SetRequired<BaseType, Keys extends keyof BaseType = keyof BaseType> =
// Pick just the keys that are not required from the base type.
    Pick<BaseType, Exclude<keyof BaseType, Keys>> &
  // Pick the keys that should be required from the base type and make them required.
  Required<Pick<BaseType, Keys>> extends // If `InferredType` extends the previous, then for each key, use the inferred type key.
  infer InferredType
  ? { [KeyType in keyof InferredType]: InferredType[KeyType] }
  : never;
