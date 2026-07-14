import * as crypto from 'node:crypto';
import { v1 as generateUuidV1, v4 as generateUuidV4, v7 as generateUuidV7Fallback } from 'uuid';
import type { AbstractDialect } from '../abstract-dialect/dialect.js';
import { DialectAwareFn } from './dialect-aware-fn.js';

type UuidV7Generator = (() => string | undefined) | undefined;

function getNativeUuidV7(): string | undefined {
  const nativeUuidV7 = (crypto as typeof crypto & { randomUUIDv7?: unknown }).randomUUIDv7;

  return typeof nativeUuidV7 === 'function' ? nativeUuidV7() : undefined;
}

export function generateUuidV7(nativeUuidV7: UuidV7Generator = getNativeUuidV7): string {
  return nativeUuidV7?.() ?? generateUuidV7Fallback();
}

export class SqlUuidV7 extends DialectAwareFn {
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
    return generateUuidV7();
  }

  supportsDialect(dialect: AbstractDialect): boolean {
    return dialect.supports.uuidV7Generation;
  }

  applyForDialect(dialect: AbstractDialect): string {
    return dialect.queryGenerator.getUuidV7FunctionCall();
  }
}

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
    return generateUuidV4();
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
