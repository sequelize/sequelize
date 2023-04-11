import type { Class } from 'type-fest';
import { BaseSqlExpression } from './base-sql-expression.js';
import { JsonPath } from './json-path.js';
import type { AbstractDialect } from '../dialects/abstract/index.js';
import type { EscapeOptions } from '../dialects/abstract/query-generator-typescript.js';
import type { Expression } from '../sequelize.js';

/**
 * Unlike {@link Fn}, this class does not accept a function name.
 * It must instead be extended by a class that implements the {@link apply} method, in which
 * the function name is provided.
 *
 * The goal of this class is to allow dialect-specific functions to be used in a cross-dialect way.
 * For instance, an extension of this class could be used to represent the `LOWER` function in a cross-dialect way,
 * by generating the correct SQL function name based on which dialect is used.
 */
export abstract class DialectAwareFn extends BaseSqlExpression {
  readonly args: readonly Expression[];

  constructor(...args: DialectAwareFn['args']) {
    super();
    this.args = args;

    if (this.args.length > this.maxArgCount) {
      throw new Error(`Too many arguments provided to ${this.constructor.name} function. Expected ${this.maxArgCount} or less, but got ${this.args.length}.`);
    }

    if (this.args.length < this.minArgCount) {
      throw new Error(`Too few arguments provided to ${this.constructor.name} function. Expected ${this.minArgCount} or more, but got ${this.args.length}.`);
    }
  }

  get maxArgCount() {
    return Number.POSITIVE_INFINITY;
  }

  get minArgCount() {
    return 0;
  }

  abstract apply(dialect: AbstractDialect, options?: EscapeOptions): string;

  static build<M extends DialectAwareFn>(this: Class<M>, ...args: DialectAwareFn['args']): M {
    return new this(...args);
  }
}

/**
 * Unquotes JSON values.
 */
export class Unquote extends DialectAwareFn {
  get maxArgCount() {
    return 1;
  }

  get minArgCount() {
    return 1;
  }

  apply(dialect: AbstractDialect, options?: EscapeOptions): string {
    const arg = this.args[0];

    if (arg instanceof JsonPath) {
      return dialect.queryGenerator.jsonPathExtractionQuery(
        dialect.queryGenerator.escape(arg.expression),
        arg.path,
        true,
      );
    }

    return dialect.queryGenerator.formatUnquoteJson(arg, options);
  }
}
