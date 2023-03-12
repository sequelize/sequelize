import { BaseSqlExpression } from './base-sql-expression.js';

/**
 * Do not use me directly. Use {@link literal}
 */
export class Literal extends BaseSqlExpression {
  /** this (type-only) brand prevents TypeScript from thinking Cast is assignable to Literal because they share the same shape */
  declare private readonly brand: 'literal';

  readonly val: ReadonlyArray<string | BaseSqlExpression>;

  constructor(val: string | Array<string | BaseSqlExpression>) {
    super();

    this.val = Array.isArray(val) ? val : [val];
  }
}

/**
 * Creates an object representing a literal, i.e. something that will not be escaped.
 * We recommend using {@link sql} for a better DX.
 *
 * @param val literal value
 */
export function literal(val: string | Array<string | BaseSqlExpression>): Literal {
  return new Literal(val);
}

