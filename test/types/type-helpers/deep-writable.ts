/**
 * Adapted from krzkaczor/ts-essentials
 *
 * https://github.com/krzkaczor/ts-essentials/blob/v7.1.0/lib/types.ts#L165
 *
 * Thank you!
 */

import {
  Model,
  Sequelize,
  ModelCtor,
  ModelDefined,
  ModelStatic,
} from 'sequelize';

type Builtin =
  | string
  | number
  | boolean
  | bigint
  | symbol
  | undefined
  | null
  | Function
  | Date
  | Error
  | RegExp;

type SequelizeBasic =
  | Builtin
  | Sequelize
  | Model
  | ModelCtor<Model>
  | ModelDefined<any, any>
  | ModelStatic<Model>;

// type ToMutableArrayIfNeeded<T> = T extends readonly any[]
//   ? { -readonly [K in keyof T]: ToMutableArrayIfNeeded<T[K]> }
//   : T;

type NoReadonlyArraysDeep<T> = T extends SequelizeBasic
  ? T
  : T extends readonly any[]
  ? { -readonly [K in keyof T]: NoReadonlyArraysDeep<T[K]> }
  : T extends Record<string, any>
  ? { [K in keyof T]: NoReadonlyArraysDeep<T[K]> }
  : T;

type ShallowWritable<T> = T extends Record<string, any> ? { -readonly [K in keyof T]: T[K] } : T;

export type SemiDeepWritable<T> = ShallowWritable<NoReadonlyArraysDeep<T>>;

export type DeepWritable<T> = T extends SequelizeBasic
  ? T
  : T extends Map<infer K, infer V>
  ? Map<DeepWritable<K>, DeepWritable<V>>
  : T extends ReadonlyMap<infer K, infer V>
  ? Map<DeepWritable<K>, DeepWritable<V>>
  : T extends WeakMap<infer K, infer V>
  ? WeakMap<DeepWritable<K>, DeepWritable<V>>
  : T extends Set<infer U>
  ? Set<DeepWritable<U>>
  : T extends ReadonlySet<infer U>
  ? Set<DeepWritable<U>>
  : T extends WeakSet<infer U>
  ? WeakSet<DeepWritable<U>>
  : T extends Promise<infer U>
  ? Promise<DeepWritable<U>>
  : T extends {}
  ? { -readonly [K in keyof T]: DeepWritable<T[K]> }
  : T;
