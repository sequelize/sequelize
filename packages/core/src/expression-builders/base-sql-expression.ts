import type { Cast } from './cast.js';
import type { Col } from './col.js';
import type { Fn } from './fn.js';
import type { Json } from './json.js';
import type { Literal } from './literal.js';
import type { Where } from './where.js';

/**
 * Utility functions for representing SQL functions, and columns that should be escaped.
 * Please do not use these functions directly, use Sequelize.fn and Sequelize.col instead.
 *
 * @private
 */
export class BaseSqlExpression {}

export type DynamicSqlExpression =
  | Fn
  | Col
  | Cast
  | Literal
  | Where
  | Json;
