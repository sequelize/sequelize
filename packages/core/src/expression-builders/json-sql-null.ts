import type { AbstractDialect } from '../abstract-dialect/dialect.js';
import { DialectAwareFn } from './dialect-aware-fn.js';
import { literal } from './literal.js';

class JsonNullClass extends DialectAwareFn {
  get maxArgCount() {
    return 0;
  }

  get minArgCount() {
    return 0;
  }

  supportsDialect(): boolean {
    return true;
  }

  applyForDialect(dialect: AbstractDialect): string {
    return dialect.escapeJson(null);
  }
}

/**
 * null as a JSON value
 */
export const JSON_NULL = JsonNullClass.build();

/**
 * null as an SQL value
 */
export const SQL_NULL = literal('NULL');
