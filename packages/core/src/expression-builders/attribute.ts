import { parseAttributeSyntax } from '../utils/attribute-syntax.js';
import type { AssociationPath } from './association-path.js';
import { BaseSqlExpression, SQL_IDENTIFIER } from './base-sql-expression.js';
import type { Cast } from './cast.js';
import type { DialectAwareFn } from './dialect-aware-fn.js';
import type { JsonPath } from './json-path.js';

/**
 * Use {@link sql.attribute} instead.
 */
export class Attribute extends BaseSqlExpression {
  declare protected readonly [SQL_IDENTIFIER]: 'attribute';

  constructor(readonly attributeName: string) {
    super();
  }
}

/**
 * Used to represent the attribute of a model. You should use the attribute name, which will be mapped to the correct column name.
 * This attribute name follows the same rules as the attribute names in POJO where options.
 * As such, you can use dot notation to access nested JSON properties, and you can reference included associations.
 *
 * If you want to use a database name, without mapping, you can use {@link Identifier}.
 *
 * @example
 * Let's say the class User has an attribute `firstName`, which maps to the column `first_name`.
 *
 * ```ts
 * User.findAll({
 *  where: sql`${attribute('firstName')} = 'John'`
 * });
 * ```
 *
 * Will generate:
 *
 * ```sql
 * SELECT * FROM users WHERE first_name = 'John'
 * ```
 *
 * @example
 * Let's say the class User has an attribute `data`, which is a JSON column.
 *
 * ```ts
 * User.findAll({
 *  where: sql`${attribute('data.registered')} = 'true'`
 * });
 * ```
 *
 * Will generate (assuming the dialect supports JSON operators):
 *
 * ```sql
 * SELECT * FROM users WHERE data->'registered' = 'true'
 * ```
 *
 * @param attributeName
 */
export function attribute(
  attributeName: string,
): Cast | JsonPath | AssociationPath | Attribute | DialectAwareFn {
  return parseAttributeSyntax(attributeName);
}
