import { BaseSqlExpression } from './base-sql-expression.js';

/**
 * Do not use me directly. Use {@link cast}
 */
export class Cast extends BaseSqlExpression {
  private readonly val: any;
  private readonly type: string;
  private readonly json: boolean;

  constructor(val: unknown, type: string = '', json: boolean = false) {
    super();
    this.val = val;
    this.type = type.trim();
    this.json = json;
  }
}

/**
 * Creates a object representing a call to the cast function.
 *
 * @param val The value to cast
 * @param type The type to cast it to
 */
export function cast(val: unknown, type: string): Cast {
  return new Cast(val, type);
}
