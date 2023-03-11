import { BaseSqlExpression } from './base-sql-expression.js';

/**
 * Do not use me directly. Use {@link literal}
 */
export class Literal extends BaseSqlExpression {
  /** this (type-only) brand prevents TypeScript from thinking Cast is assignable to Literal because they share the same shape */
  declare private readonly brand: 'literal';

  private readonly val: unknown;

  constructor(val: unknown) {
    super();
    this.val = val;
  }
}

/**
 * Creates an object representing a literal, i.e. something that will not be escaped.
 *
 * @param val literal value
 */
export function literal(val: string) {
  return new Literal(val);
}
