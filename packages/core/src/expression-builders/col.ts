import { BaseSqlExpression, SQL_IDENTIFIER } from './base-sql-expression.js';

/**
 * Do not use me directly. Use {@link @sequelize/core!sql.col}
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
 * This is often useful in conjunction with {@link @sequelize/core!sql.fn}, {@link @sequelize/core!sql.where} and {@link @sequelize/core!sql} which interpret strings as values and not column names.
 *
 * Col works similarly to {@link @sequelize/core!sql.identifier}, but "*" has special meaning, for backwards compatibility.
 *
 * ⚠️ We recommend using {@link @sequelize/core!sql.identifier}, or {@link @sequelize/core!sql.attribute} instead.
 *
 * @param identifiers The name of the column
 */
export function col(...identifiers: string[]): Col {
  return new Col(...identifiers);
}
