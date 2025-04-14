import { intersperse } from '@sequelize/utils';
import { attribute } from './attribute.js';
import { BaseSqlExpression } from './base-sql-expression.js';
import { cast } from './cast.js';
import { col } from './col.js';
import { Unquote } from './dialect-aware-fn.js';
import { fn } from './fn.js';
import { identifier } from './identifier.js';
import { jsonPath } from './json-path.js';
import { list } from './list.js';
import { Literal, literal } from './literal.js';
import { SqlUuidV1, SqlUuidV4 } from './uuid.js';
import { Value } from './value.js';
import { where } from './where.js';

/**
 * The template tag function used to easily create {@link sql.literal}.
 *
 * @param rawSql
 * @param values
 * @example
 * ```ts
 * sql`SELECT * FROM ${sql.identifier(table)} WHERE ${sql.identifier(column)} = ${value}`
 * ```
 */
export function sql(rawSql: TemplateStringsArray, ...values: unknown[]): Literal {
  const arg: Array<string | BaseSqlExpression> = [];

  for (const [i, element] of rawSql.entries()) {
    arg.push(element);

    if (i < values.length) {
      const value = values[i];

      arg.push(wrapValue(value));
    }
  }

  return new Literal(arg);
}

function wrapValue(value: unknown): BaseSqlExpression {
  return value instanceof BaseSqlExpression ? value : new Value(value);
}

/**
 * A version of {@link Array#join}, but for SQL expressions.
 * Using {@link Array#join} directly would not work, because the end result would be a string, not a SQL expression.
 *
 * @param parts The parts to join. Each part can be a SQL expression, or a value to escape.
 * @param separator A raw SQL string, or a SQL expression to separate each pair of adjacent elements of the array.
 * @returns A SQL expression representing the concatenation of all parts, interspersed with the separator.
 */
function joinSql(parts: unknown[], separator: string | BaseSqlExpression) {
  const escapedParts = parts.map(wrapValue);

  return new Literal(separator ? intersperse(escapedParts, separator) : escapedParts);
}

// The following builders are not listed here for the following reasons:
// - json(): deprecated & redundant with other builders
// - value(): internal detail of the `sql` template tag function
// - associationPath(): internal detail of attribute()
sql.attribute = attribute;
sql.cast = cast;
sql.col = col;
sql.fn = fn;
sql.identifier = identifier;
sql.jsonPath = jsonPath;
sql.list = list;
sql.literal = literal;
sql.where = where;
sql.uuidV4 = SqlUuidV4.build();
sql.uuidV1 = SqlUuidV1.build();
sql.unquote = Unquote.build.bind(Unquote);
sql.join = joinSql;
