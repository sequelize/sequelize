import { BaseSqlExpression } from './base-sql-expression.js';

/**
 * Use {@link @sequelize/core.identifier} instead.
 */
export class Identifier extends BaseSqlExpression {
  declare private readonly brand: 'identifier';

  constructor(readonly value: string) {
    super();
  }
}

/**
 * Used to represent a value that will either be escaped to a literal, or a bind parameter.
 * Unlike {@link attribute} and {@link col}, this identifier will be escaped as-is,
 * without mapping to a column name or any other transformation.
 *
 * @param value
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
export function identifier(value: string): Identifier {
  return new Identifier(value);
}
