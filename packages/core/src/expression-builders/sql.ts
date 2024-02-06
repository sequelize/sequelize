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
 * The template tag function used to easily create {@link literal}.
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

      arg.push(value instanceof BaseSqlExpression ? value : new Value(value));
    }
  }

  return new Literal(arg);
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
