import type { AssociationPath } from './association-path.js';
import type { Attribute } from './attribute.js';
import type { Cast } from './cast.js';
import type { Col } from './col.js';
import type { DialectAwareFn } from './dialect-aware-fn.js';
import type { Fn } from './fn.js';
import type { Identifier } from './identifier.js';
import type { JsonPath } from './json-path.js';
import type { List } from './list.js';
import type { Literal } from './literal.js';
import type { Value } from './value.js';
import type { Where } from './where.js';

/**
 * A symbol that can be used as the key for a static property on a BaseSqlExpression class to uniquely identify it.
 */
export declare const SQL_IDENTIFIER: unique symbol;

/**
 * Utility functions for representing SQL functions, and columns that should be escaped.
 * Please do not use these functions directly, use Sequelize.fn and Sequelize.col instead.
 *
 * @private
 */
export class BaseSqlExpression {
  declare protected readonly [SQL_IDENTIFIER]: string;
}

export type DynamicSqlExpression =
  | List
  | Value
  | Identifier
  | Attribute
  | Fn
  | DialectAwareFn
  | Col
  | Cast
  | Literal
  | Where
  | JsonPath
  | AssociationPath;
