import { BaseSqlExpression } from './base-sql-expression.js';

/**
 * Do not use me directly. Use {@link col}
 */
export class Col extends BaseSqlExpression {
  private readonly col: string[] | string;

  constructor(identifiers: string[] | string, ...args: string[]) {
    super();
    // TODO(ephys): this does not look right. First parameter is ignored if a second parameter is provided.
    //  should we change the signature to `constructor(...cols: string[])`
    if (args.length > 0) {
      identifiers = args;
    }

    this.col = identifiers;
  }
}

/**
 * Creates an object which represents a column in the DB, this allows referencing another column in your query.
 * This is often useful in conjunction with `sequelize.fn`, since raw string arguments to fn will be escaped.
 *
 * @param identifiers The name of the column
 */
export function col(identifiers: string[] | string): Col {
  return new Col(identifiers);
}
