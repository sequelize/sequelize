import type { AbstractDialect } from '../abstract-dialect/dialect';
import { DialectAwareFn } from './dialect-aware-fn';

/**
 * Do not use me directly. Use {@link sql.random}
 */
export class Random extends DialectAwareFn {
  get maxArgCount() {
    return 0;
  }

  get minArgCount() {
    return 0;
  }

  supportsJavaScript(): boolean {
    return true;
  }

  applyForJavaScript(): unknown {
    return Math.random();
  }

  supportsDialect(dialect: AbstractDialect): boolean {
    return dialect.supports.randomGeneration;
  }

  applyForDialect(dialect: AbstractDialect): string {
    return dialect.queryGenerator.getRandomFunctionCall();
  }
}
