import { BaseSqlExpression, SQL_IDENTIFIER } from './base-sql-expression.js';

/**
 * Do not use me directly. Use {@link sql.col}
 */
export class Col extends BaseSqlExpression {
  declare protected readonly [SQL_IDENTIFIER]: 'col';

  readonly identifiers: string[];

  constructor(...identifiers: string[]) {
    super();

    // TODO: verify whether the "more than one identifier" case is still needed
    this.identifiers = identifiers;
  }
}

/**
 * Creates an object which represents a column in the DB, this allows referencing another column in your query.
 * This is often useful in conjunction with {@link sql.fn}, {@link sql.where} and {@link sql} which interpret strings as values and not column names.
 *
 * Col works similarly to {@link sql.identifier}, but "*" has special meaning, for backwards compatibility.
 *
 * ⚠️ We recommend using {@link sql.identifier}, or {@link sql.attribute} instead.
 *
 * @param identifiers The name of the column
 */
export function col(...identifiers: string[]): Col {
  return new Col(...identifiers);
}
