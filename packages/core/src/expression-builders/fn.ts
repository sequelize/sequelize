import { BaseSqlExpression } from './base-sql-expression.js';
import { where } from './where.js';
import { Op } from '../operators.js';
import type { Expression } from '../sequelize.js';
import { isPlainObject } from '../utils/check.js';

/**
 * Do not use me directly. Use {@link fn}
 */
export class Fn extends BaseSqlExpression {
  declare private readonly brand: 'fn';

  readonly fn: string;
  readonly args: readonly Expression[];

  constructor(fnName: string, args: Fn['args']) {
    super();
    this.fn = fnName;
    this.args = args;
  }

  clone(): Fn {
    return new Fn(this.fn, this.args);
  }
}

/**
 * Creates an object representing a database function. This can be used in search queries, both in where and order parts, and as default values in column definitions.
 * If you want to refer to columns in your function, you should use {@link attribute} (recommended), {@link identifier}, or {@link col} (discouraged)
 * otherwise the value will be interpreted as a string.
 *
 * ℹ️ This method is usually verbose and we recommend using the {@link sql} template string tag instead.
 *
 * @param fnName The SQL function you want to call
 * @param args All further arguments will be passed as arguments to the function
 *
 * @example Convert a user's username to upper case
 * ```ts
 * instance.update({
 *   username: fn('upper', col('username'))
 * });
 * ```
 */
export function fn(fnName: string, ...args: Fn['args']): Fn {
  for (let i = 0; i < args.length; i++) {
    // Users should wrap this parameter with `where` themselves, but we do it to ensure backwards compatibility
    // with https://github.com/sequelize/sequelize/issues/6666
    // @ts-expect-error -- backwards compatibility hack
    if (isPlainObject(args[i]) && !(Op.col in args[i])) {
      // @ts-expect-error -- backwards compatibility hack
      args[i] = where(args[i]);
    }
  }

  return new Fn(fnName, args);
}
