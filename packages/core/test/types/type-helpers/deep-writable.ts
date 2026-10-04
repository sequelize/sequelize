/**
 * Adapted from krzkaczor/ts-essentials
 *
 * https://github.com/krzkaczor/ts-essentials/blob/v7.1.0/lib/types.ts#L165
 *
 * Thank you!
 */

import type { Association, Model, ModelStatic, Sequelize, Transaction } from '@sequelize/core';
import type { AbstractQuery } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query.js';
import type { BaseSqlExpression } from '@sequelize/core/_non-semver-use-at-your-own-risk_/expression-builders/base-sql-expression.js';

type Builtin =
  string | number | boolean | bigint | symbol | undefined | null | Function | Date | Error | RegExp;

// Sequelize classes that the hooks receive as-is. They are left alone: their internals are not part of the check.
type SequelizeBasic =
  | Builtin
  | Sequelize
  | Model
  | ModelStatic
  | Transaction
  | Association<any, any, any, any>
  | AbstractQuery
  | BaseSqlExpression;

// type ToMutableArrayIfNeeded<T> = T extends readonly any[]
//   ? { -readonly [K in keyof T]: ToMutableArrayIfNeeded<T[K]> }
//   : T;

type NoReadonlyArraysDeep<T> = T extends SequelizeBasic
  ? T
  : T extends readonly any[]
    ? { -readonly [K in keyof T]: NoReadonlyArraysDeep<T[K]> }
    : T extends Record<string, any>
      ? {
          // attribute lists are allowed to be readonly arrays (#18186)
          [K in keyof T]: K extends 'attributes' ? T[K] : NoReadonlyArraysDeep<T[K]>;
        }
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
