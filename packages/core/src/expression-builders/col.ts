import { BaseSqlExpression } from './base-sql-expression.js';

/**
 * Do not use me directly. Use {@link col}
 */
export class Col extends BaseSqlExpression {
  declare private readonly brand: 'col';

  readonly identifiers: string[];

  constructor(...identifiers: string[]) {
    super();

    // TODO: verify whether the "more than one identifier" case is still needed
    this.identifiers = identifiers;
  }
}

/**
 * Creates an object which represents a column in the DB, this allows referencing another column in your query.
 * This is often useful in conjunction with {@link fn}, {@link where} and {@link sql} which interpret strings as values and not column names.
 *
 * Col works similarly to {@link Identifier}, but "*" has special meaning, for backwards compatibility.
 *
 * ⚠️ We recommend using {@link Identifier}, or {@link Attribute} instead.
 *
 * @param identifiers The name of the column
 */
export function col(...identifiers: string[]): Col {
  return new Col(...identifiers);
}
