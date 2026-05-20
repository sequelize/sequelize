import { AbstractQueryGeneratorInternal } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator-internal.js';
import type { EscapeOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator-typescript.js';
import type { AddLimitOffsetOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator.internal-types.js';
import type { Fn } from '@sequelize/core/_non-semver-use-at-your-own-risk_/expression-builders/fn.js';
import util from 'node:util';
import type { SnowflakeDialect } from './dialect.js';

const TECHNICAL_SCHEMA_NAMES = Object.freeze([
  'INFORMATION_SCHEMA',
  'PERFORMANCE_SCHEMA',
  'SYS',
  'information_schema',
  'performance_schema',
  'sys',
]);

export class SnowflakeQueryGeneratorInternal<
  Dialect extends SnowflakeDialect = SnowflakeDialect,
> extends AbstractQueryGeneratorInternal<Dialect> {
  getTechnicalSchemaNames() {
    return TECHNICAL_SCHEMA_NAMES;
  }

  addLimitAndOffset(options: AddLimitOffsetOptions): string {
    let fragment = '';
    if (options.limit != null) {
      fragment += ` LIMIT ${this.queryGenerator.escape(options.limit, options)}`;
    } else if (options.offset) {
      fragment += ` LIMIT NULL`;
    }

    if (options.offset) {
      fragment += ` OFFSET ${this.queryGenerator.escape(options.offset, options)}`;
    }

    return fragment;
  }

  formatFn(piece: Fn, options?: EscapeOptions): string {
    const fnName = piece.fn.toUpperCase();
    const mappedName =
      SNOWFLAKE_VECTOR_FUNCTION_MAP.get(fnName) ??
      (SNOWFLAKE_NATIVE_VECTOR_FUNCTIONS.has(fnName) ? fnName : undefined);

    if (!mappedName) {
      if (SNOWFLAKE_UNSUPPORTED_VECTOR_FUNCTIONS.has(fnName)) {
        throw new Error(`${fnName} is not implemented for the Snowflake vector sample`);
      }

      return super.formatFn(piece, options);
    }

    if (piece.args.length !== 2) {
      throw new Error(`${fnName} expects exactly 2 arguments`);
    }

    const [columnArg, vectorArg] = piece.args;
    const columnSql =
      typeof columnArg === 'string'
        ? this.queryGenerator.quoteIdentifier(columnArg)
        : this.queryGenerator.escape(columnArg, options);
    const vectorSql = this.#formatVectorArg(vectorArg, fnName);

    return `${mappedName}(${columnSql}, ${vectorSql})`;
  }

  #formatVectorArg(arg: unknown, fnName: string): string {
    if (Array.isArray(arg)) {
      return this.#formatVectorFromArray(arg, 'FLOAT');
    }

    if (ArrayBuffer.isView(arg) && !(arg instanceof DataView) && isNumericTypedArray(arg)) {
      return this.#formatTypedArrayVector(arg);
    }

    if (typeof arg === 'string') {
      const trimmed = arg.trim();
      const literal = this.#parseVectorLiteral(trimmed);
      if (literal) {
        return literal;
      }

      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) {
            return this.#formatVectorFromArray(parsed, 'FLOAT');
          }
        } catch {
          // fall through to error below
        }
      }
    }

    throw new Error(
      `${fnName} expects the second argument to be a number array, typed array, or VECTOR-compatible SQL literal`,
    );
  }

  #parseVectorLiteral(literal: string): string | null {
    const match = literal.match(
      /^(\[[^\]]+\])\s*::\s*VECTOR\s*\(\s*(FLOAT|INT)\s*,\s*(\d+)\s*\)$/i,
    );
    if (!match) {
      return null;
    }

    const [, body, elementType, dimension] = match;

    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      return null;
    }

    if (!Array.isArray(parsed)) {
      return null;
    }

    if (parsed.length !== Number(dimension)) {
      throw new Error(
        `Vector literal dimension ${dimension} does not match ${parsed.length} values`,
      );
    }

    return this.#formatVectorFromArray(parsed, elementType.toUpperCase() as 'FLOAT' | 'INT');
  }

  // Snowflake documents vector literals as ARRAY values cast with ::VECTOR(type, dimension),
  // e.g. [1,2,3]::VECTOR(FLOAT, 3).
  #formatVectorFromArray(values: unknown[], elementType: 'FLOAT' | 'INT'): string {
    if (values.length === 0) {
      throw new Error('Vector arguments must contain at least one element');
    }

    const numericValues = values.map(value => {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(util.format('%O is not a valid vector element', value));
      }

      return value;
    });

    return `[${numericValues.join(',')}]::VECTOR(${elementType}, ${numericValues.length})`;
  }

  #formatTypedArrayVector(values: NumericTypedArray): string {
    const elementType = isIntegerTypedArray(values) ? 'INT' : 'FLOAT';

    return this.#formatVectorFromArray([...values], elementType);
  }
}

// Sample cross-dialect implementation: keep only helper mappings that correspond directly to
// documented Snowflake vector functions.
const SNOWFLAKE_VECTOR_FUNCTION_MAP = new Map<string, string>([
  ['INNER_PRODUCT', 'VECTOR_INNER_PRODUCT'],
  ['L1_DISTANCE', 'VECTOR_L1_DISTANCE'],
  ['L2_DISTANCE', 'VECTOR_L2_DISTANCE'],
]);

const SNOWFLAKE_NATIVE_VECTOR_FUNCTIONS = new Set([
  'VECTOR_INNER_PRODUCT',
  'VECTOR_L1_DISTANCE',
  'VECTOR_L2_DISTANCE',
  'VECTOR_COSINE_SIMILARITY',
]);

const SNOWFLAKE_UNSUPPORTED_VECTOR_FUNCTIONS = new Set(['COSINE_DISTANCE', 'VECTOR_DISTANCE']);

function isNumericTypedArray(value: ArrayBufferView): value is NumericTypedArray {
  return (
    value instanceof Int8Array ||
    value instanceof Uint8Array ||
    value instanceof Uint8ClampedArray ||
    value instanceof Int16Array ||
    value instanceof Uint16Array ||
    value instanceof Int32Array ||
    value instanceof Uint32Array ||
    value instanceof Float32Array ||
    value instanceof Float64Array
  );
}

type NumericTypedArray =
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array;

function isIntegerTypedArray(
  value: NumericTypedArray,
): value is
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array {
  return (
    value instanceof Int8Array ||
    value instanceof Uint8Array ||
    value instanceof Uint8ClampedArray ||
    value instanceof Int16Array ||
    value instanceof Uint16Array ||
    value instanceof Int32Array ||
    value instanceof Uint32Array
  );
}
