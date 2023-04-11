import { BaseSqlExpression } from './base-sql-expression.js';
import { where } from './where.js';
import type { DataType } from '../dialects/abstract/data-types.js';
import { Op } from '../operators.js';
import type { Expression } from '../sequelize.js';
import { isPlainObject } from '../utils/check.js';

/**
 * Do not use me directly. Use {@link cast}
 */
export class Cast extends BaseSqlExpression {
  declare private readonly brand: 'cast';

  constructor(
    readonly expression: Expression,
    readonly type: DataType,
  ) {
    super();
  }
}

/**
 * Creates an object representing a call to the cast function.
 *
 * @param val The value to cast
 * @param type The type to cast it to
 */
export function cast(val: unknown, type: DataType): Cast {
  if (isPlainObject(val) && !(Op.col in val)) {
    // Users should wrap this parameter with `where` themselves, but we do it to ensure backwards compatibility
    // with https://github.com/sequelize/sequelize/issues/6666
    // @ts-expect-error -- backwards compatibility hack
    val = where(val);
  }

  return new Cast(val, type);
}
