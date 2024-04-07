/**
 * Represents any plain function (no `this`)
 */
export type AnyFunction = (...args: any[]) => any;

export type UnknownFunction = (...args: unknown[]) => unknown;

/**
 * Represents any plain object (or Record, as TypeScript calls it).
 *
 * Prefer {@link UnknownRecord} unless you're encountering issues with it.
 */
export type AnyRecord = Record<PropertyKey, any>;

/**
 * Represents any plain object (or Record, as TypeScript calls it)
 *
 * Stricter than {@link AnyRecord}. Not all records can be assigned to this value due to how TypeScript works
 * but its usage is recommended because the value won't be typed as any.
 */
export type UnknownRecord = Record<PropertyKey, unknown>;

export type Nullish = null | undefined;

export type NonNullish = {};

/**
 * Makes the type accept null & undefined
 */
export type MakeNullish<T> = T | Nullish;

export type MakeNonNullish<T> = NonNullable<T>;

export type NonUndefined<T> = T extends undefined ? never : T;

export type NonNull<T> = T extends null ? never : T;

export type NonUndefinedKeys<T, K extends keyof T> = {
  [P in keyof T]: P extends K ? NonUndefined<T[P]> : T[P];
};

export type AllowArray<T> = T | T[];

export type AllowIterable<T> = T | Iterable<T>;

export type AllowReadonlyArray<T> = T | readonly T[];

export type AllowPromise<T> = T | Promise<T>;

/**
 * Like {@link Partial}, but also allows undefined.
 * Useful when "exactOptionalPropertyTypes" is enabled.
 */
export type PartialOrUndefined<T> = {
  [P in keyof T]?: T[P] | undefined;
};

/**
 * Type helper for making certain fields of an object optional.
 */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequiredBy<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

export type StrictRequiredBy<T, K extends keyof T> = NonUndefinedKeys<
  Omit<T, K> & Required<Pick<T, K>>,
  K
>;

export type ReadOnlyRecord<K extends PropertyKey, V> = Readonly<Record<K, V>>;

export type PartialRecord<K extends PropertyKey, V> = {
  [P in K]?: V;
};

export type PartialReadonlyRecord<K extends PropertyKey, V> = Readonly<PartialRecord<K, V>>;

export type Entry<Key, Value> = [key: Key, value: Value];

export type JsonArray = JsonValue[];
export type JsonObject = { [key: string]: JsonValue };
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

export type PickByType<T, U> = { [K in keyof T as U extends T[K] ? K : never]: T[K] };

export interface ReadonlyMapLike<K, V> {
  entries(): IterableIterator<Entry<K, V>>;
  get(key: K): V | undefined;
  has(key: K): boolean;
  keys(): IterableIterator<K>;
  readonly size: number;
  [Symbol.iterator](): IterableIterator<Entry<K, V>>;
  values(): IterableIterator<V>;
}

export interface MapLike<K, V> extends ReadonlyMapLike<K, V> {
  clear(): void;
  delete(key: K): boolean;
  set(key: K, value: V): this;
}

export interface ReadonlySetLike<V> {
  has(value: V): boolean;
  readonly size: number;
  [Symbol.iterator](): IterableIterator<V>;
  values(): IterableIterator<V>;
}

export interface SetLike<V> extends ReadonlySetLike<V> {
  add(value: V): this;
  clear(): void;
  delete(value: V): boolean;
}
