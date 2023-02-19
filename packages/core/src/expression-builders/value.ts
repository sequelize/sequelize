import { BaseSqlExpression } from './base-sql-expression.js';

/**
 * Used to represent a value that will either be escaped to a literal, or a bind parameter.
 * You do not need to use this function directly, it will be used automatically when you interpolate parameters
 * in a template string tagged with {@link sql}.
 */
export class Value extends BaseSqlExpression {
  declare private readonly brand: 'value';

  constructor(readonly value: unknown) {
    super();
  }
}
