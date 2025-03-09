import { BaseSqlExpression, SQL_IDENTIFIER } from './base-sql-expression.js';

/**
 * Use {@link sql.list} instead.
 */
export class List extends BaseSqlExpression {
  declare protected readonly [SQL_IDENTIFIER]: 'list';

  constructor(readonly values: unknown[]) {
    super();
  }
}

/**
 * Used to represent an SQL list of values, e.g. `WHERE id IN (1, 2, 3)`. This ensure that the array is interpreted
 * as an SQL list, and not as an SQL Array.
 *
 * @example
 * ```ts
 * sequelize.query(sql`SELECT * FROM users WHERE id IN ${list([1, 2, 3])}`);
 * ```
 *
 * Will generate:
 *
 * ```sql
 * SELECT * FROM users WHERE id IN (1, 2, 3)
 * ```
 *
 * @param values The members of the list.
 */
export function list(values: unknown[]): List {
  return new List(values);
}
