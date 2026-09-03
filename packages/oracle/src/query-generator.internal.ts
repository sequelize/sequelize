// Copyright (c) 2025, Oracle and/or its affiliates. All rights reserved

import { attributeTypeToSql } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/data-types-utils.js';
import { AbstractQueryGeneratorInternal } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator-internal.js';
import type { EscapeOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator-typescript.js';
import type { AddLimitOffsetOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator.internal-types.js';
import { wrapAmbiguousWhere } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/where-sql-builder.js';
import type { Cast } from '@sequelize/core/_non-semver-use-at-your-own-risk_/expression-builders/cast.js';
import type { Fn } from '@sequelize/core/_non-semver-use-at-your-own-risk_/expression-builders/fn.js';
import util from 'node:util';
import type { OracleDialect } from './dialect.js';

const VECTOR_FUNCTIONS = new Set([
  'COSINE_DISTANCE',
  'INNER_PRODUCT',
  'L1_DISTANCE',
  'L2_DISTANCE',
  'VECTOR_DISTANCE',
]);

const VECTOR_ARG_ERROR =
  'expects the second argument to be a vector array, typed array, or VECTOR literal string';

export class OracleQueryGeneratorInternal<
  Dialect extends OracleDialect = OracleDialect,
> extends AbstractQueryGeneratorInternal<Dialect> {
  addLimitAndOffset(options: AddLimitOffsetOptions) {
    let fragment = '';
    const offset = options.offset || 0;

    if (options.offset || options.limit) {
      fragment += ` OFFSET ${this.queryGenerator.escape(offset, options)} ROWS`;
    }

    if (options.limit) {
      fragment += ` FETCH NEXT ${this.queryGenerator.escape(options.limit, options)} ROWS ONLY`;
    }

    return fragment;
  }

  formatCast(cast: Cast, options?: EscapeOptions | undefined): string {
    const type = this.sequelize.normalizeDataType(cast.type);

    let castSql = wrapAmbiguousWhere(
      cast.expression,
      this.queryGenerator.escape(cast.expression, { ...options, type }),
    );
    const targetSql = attributeTypeToSql(type).toUpperCase();

    if (type === 'boolean') {
      castSql = `(CASE WHEN ${castSql}='true' THEN 1 ELSE 0 END)`;

      return `CAST(${castSql} AS NUMBER)`;
    } else if (type === 'TIMESTAMPTZ') {
      castSql = castSql.slice(0, -1);

      return `${castSql} RETURNING TIMESTAMP WITH TIME ZONE)`;
    }

    return `CAST(${castSql} AS ${targetSql})`;
  }

  formatFn(piece: Fn, options?: EscapeOptions): string {
    const fnName = piece.fn.toUpperCase();
    if (!VECTOR_FUNCTIONS.has(fnName)) {
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

    return `${fnName}(${columnSql}, ${this.#formatVectorArg(vectorArg, fnName)})`;
  }

  #formatVectorArg(arg: unknown, fnName: string): string {
    if (Array.isArray(arg)) {
      return this.#formatVectorFromIterable(arg);
    }

    if (arg instanceof Float32Array || arg instanceof Float64Array || arg instanceof Uint8Array) {
      return this.#formatVectorFromIterable(arg);
    }

    if (typeof arg === 'string') {
      const trimmed = arg.trim();
      const parsed = parseVectorLiteral(trimmed);

      if (parsed) {
        return this.#formatVectorFromIterable(parsed);
      }

      if (!looksLikeVectorLiteral(trimmed)) {
        throw new Error(`${fnName} ${VECTOR_ARG_ERROR}`);
      }

      throw new Error(`${fnName} expects a well-formed VECTOR literal string`);
    }

    throw new Error(`${fnName} ${VECTOR_ARG_ERROR}`);
  }

  // Oracle expects VECTOR('[1,2,3]') literals. Reuse the iterable path for both plain arrays
  // and typed arrays so we only have one place that generates the comma-separated payload.
  #formatVectorFromIterable(values: Iterable<number>): string {
    const parts: number[] = [];
    for (const item of values) {
      if (typeof item !== 'number' || !Number.isFinite(item)) {
        throw new Error(`${util.format('%O is not a valid vector element', item)}`);
      }

      parts.push(item);
    }

    return `VECTOR('[${parts.join(',')}]')`;
  }

  getAliasToken(): string {
    return '';
  }
}

function looksLikeVectorLiteral(input: string): boolean {
  const trimmed = input.trim();

  return trimmed.toUpperCase().startsWith('VECTOR(') && trimmed.endsWith(')');
}

function parseVectorLiteral(input: string): number[] | null {
  const trimmed = input.trim();
  if (!looksLikeVectorLiteral(trimmed)) {
    return null;
  }

  const openParenIndex = trimmed.indexOf('(');
  const inner = trimmed.slice(openParenIndex + 1, -1).trim();
  if (!inner.startsWith("'") || !inner.endsWith("'")) {
    return null;
  }

  const body = inner.slice(1, -1);
  if (!body.startsWith('[') || !body.endsWith(']')) {
    return null;
  }

  let values: unknown;
  try {
    values = JSON.parse(body);
  } catch {
    return null;
  }

  if (
    !Array.isArray(values) ||
    values.some(value => typeof value !== 'number' || !Number.isFinite(value))
  ) {
    return null;
  }

  return values;
}
