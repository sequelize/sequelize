import crypto from 'node:crypto';
import { v1 as generateUuidV1 } from 'uuid';
import type { AbstractDialect } from '../abstract-dialect/dialect.js';
import { DialectAwareFn } from './dialect-aware-fn.js';

export class SqlUuidV4 extends DialectAwareFn {
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
    return crypto.randomUUID();
  }

  supportsDialect(dialect: AbstractDialect): boolean {
    return dialect.supports.uuidV4Generation;
  }

  applyForDialect(dialect: AbstractDialect): string {
    return dialect.queryGenerator.getUuidV4FunctionCall();
  }
}

export class SqlUuidV1 extends DialectAwareFn {
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
    return generateUuidV1();
  }

  supportsDialect(dialect: AbstractDialect): boolean {
    return dialect.supports.uuidV1Generation;
  }

  applyForDialect(dialect: AbstractDialect): string {
    return dialect.queryGenerator.getUuidV1FunctionCall();
  }
}
