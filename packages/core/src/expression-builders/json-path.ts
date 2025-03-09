import type { Expression } from '../sequelize.js';
import { BaseSqlExpression, SQL_IDENTIFIER } from './base-sql-expression.js';

/**
 * Do not use me directly. Use {@link sql.jsonPath}.
 */
export class JsonPath extends BaseSqlExpression {
  declare protected readonly [SQL_IDENTIFIER]: 'jsonPath';

  constructor(
    readonly expression: Expression,
    readonly path: ReadonlyArray<string | number>,
  ) {
    super();
  }
}

/**
 * Use this to access nested properties in a JSON column.
 * You can also use the dot notation with {@link sql.attribute}, but this works with any values, not just attributes.
 *
 * @param expression The expression to access the property on.
 * @param path The path to the property. If a number is used, it will be treated as an array index, otherwise as a key.
 *
 * @example
 * ```ts
 * sql`${jsonPath('data', ['name'])} = '"John"'`
 * ```
 *
 * will produce
 *
 * ```sql
 * -- postgres
 * "data"->'name' = '"John"'
 * -- sqlite, mysql, mariadb
 * JSON_EXTRACT("data", '$.name') = '"John"'
 * ```
 *
 * @example
 * ```ts
 * // notice here that 0 is a number, not a string. It will be treated as an array index.
 * sql`${jsonPath('array', [0])}`
 * ```
 *
 * will produce
 *
 * ```sql
 * -- postgres
 * "array"->0
 * -- sqlite, mysql, mariadb
 * JSON_EXTRACT(`array`, '$[0]')
 * ```
 *
 * @example
 * ```ts
 * // notice here that 0 is a string, not a number. It will be treated as an object key.
 * sql`${jsonPath('object', ['0'])}`
 * ```
 *
 * will produce
 *
 * ```sql
 * -- postgres
 * "object"->'0'
 * -- sqlite, mysql, mariadb
 * JSON_EXTRACT(`object`, '$.0')
 * ```
 */
export function jsonPath(expression: Expression, path: ReadonlyArray<string | number>): JsonPath {
  return new JsonPath(expression, path);
}
