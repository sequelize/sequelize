import isObject from 'lodash/isObject.js';
import { BaseSqlExpression } from './base-sql-expression.js';

/**
 * Do not use me directly. Use {@link json}
 */
export class Json extends BaseSqlExpression {
  private readonly conditions?: { [key: string]: any };
  private readonly path?: string;
  private readonly value?: string | number | boolean | null;

  constructor(
    conditionsOrPath: { [key: string]: any } | string,
    value?: string | number | boolean | null,
  ) {
    super();

    if (typeof conditionsOrPath === 'string') {
      this.path = conditionsOrPath;

      if (value) {
        this.value = value;
      }
    } else if (isObject(conditionsOrPath)) {
      this.conditions = conditionsOrPath;
    }
  }
}

/**
 * Creates an object representing nested where conditions for postgres's json data-type.
 *
 * @param conditionsOrPath A hash containing strings/numbers or other nested hash, a string using dot
 *   notation or a string using postgres json syntax.
 * @param value An optional value to compare against.
 *   Produces a string of the form "&lt;json path&gt; = '&lt;value&gt;'".
 */
export function json(conditionsOrPath: string | object, value?: string | number | boolean): Json {
  return new Json(conditionsOrPath, value);
}
