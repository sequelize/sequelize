import type { TableOrModel } from '../abstract-dialect/query-generator.types';
import { BaseSqlExpression, SQL_IDENTIFIER } from './base-sql-expression.js';

/**
 * Use {@link identifier} instead.
 */
export class Identifier extends BaseSqlExpression {
  protected declare readonly [SQL_IDENTIFIER]: 'identifier';

  constructor(readonly values: Array<string | TableOrModel>) {
    super();
  }
}

/**
 * Used to represent a value that will either be escaped to a literal, or a bind parameter.
 * Unlike {@link attribute} and {@link col}, this identifier will be escaped as-is,
 * without mapping to a column name or any other transformation.
 *
 * This method supports strings, table structures, model classes (which), and model definitions
 *
 * @param values The identifiers to escape. Automatically joins them with a period (`.`).
 * @example
 * ```ts
 * sequelize.query(sql`SELECT * FROM users WHERE ${identifier('firstName')} = 'John'`);
 * ```
 *
 * Will generate (identifier quoting depending on the dialect):
 *
 * ```sql
 * SELECT * FROM users WHERE "firstName" = 'John'
 * ```
 */
export function identifier(...values: Array<string | TableOrModel>): Identifier {
  return new Identifier(values);
}
