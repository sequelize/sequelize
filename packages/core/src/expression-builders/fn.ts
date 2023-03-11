import type { WhereAttributeHash } from '../model.js';
import { BaseSqlExpression } from './base-sql-expression.js';

/**
 * Do not use me directly. Use {@link fn}
 */
export class Fn extends BaseSqlExpression {
  private readonly fn: string;

  // unknown already covers the other two types, but they've been added explicitly to document
  // passing WhereAttributeHash generates a condition inside the function.
  private readonly args: Array<unknown | BaseSqlExpression | WhereAttributeHash>;

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
 * If you want to refer to columns in your function, you should use {@link col}, so that the columns are properly interpreted as columns and not a strings.
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
  return new Fn(fnName, args);
}
