import { BaseSqlExpression, SQL_IDENTIFIER } from './base-sql-expression.js';

/**
 * Do not use me directly. Use {@link sql.literal}
 */
export class Literal extends BaseSqlExpression {
  declare protected readonly [SQL_IDENTIFIER]: 'literal';

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
