import type { AbstractDialect } from '@sequelize/core';
import { Op } from '@sequelize/core';
import { BaseSqlExpression } from '@sequelize/core/_non-semver-use-at-your-own-risk_/expression-builders/base-sql-expression.js';
import { literal } from '@sequelize/core/_non-semver-use-at-your-own-risk_/expression-builders/literal.js';
import { isPlainObject } from '@sequelize/utils';

export interface DatabaseCollationLike {
  readonly codepage?: string | undefined;
}

export function isVarcharSafeString(value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    // eslint-disable-next-line unicorn/prefer-code-point -- classifier intentionally checks UTF-16 code units
    if (value.charCodeAt(index) > 0x7f) {
      return false;
    }
  }

  return true;
}

/**
 * Single quoting primitive for MSSQL string literals.
 *
 * @param value The raw string contents.
 * @param unicode When true, emits `N'...'`; otherwise `'...'`.
 */
export function quoteMsSqlStringLiteral(value: string, unicode: boolean): string {
  const escapedValue = value.replaceAll("'", "''");

  return `${unicode ? 'N' : ''}'${escapedValue}'`;
}

export function escapeUserStringLiteral(value: string): string {
  return quoteMsSqlStringLiteral(value, !isVarcharSafeString(value));
}

export function canBindAsVarChar(
  databaseCollation: DatabaseCollationLike | null | undefined,
): boolean {
  return Boolean(databaseCollation?.codepage);
}

/**
 * Escapes a DEFAULT value for MSSQL DDL: strings always use dialect Unicode
 * literals; other values use the provided escape callback.
 *
 * @param value The default value.
 * @param dialect The MSSQL dialect.
 * @param escapeNonString Escaper for non-string defaults.
 */
export function escapeMsSqlDefaultValue(
  value: unknown,
  dialect: AbstractDialect,
  escapeNonString: (value: unknown) => string,
): string {
  if (typeof value === 'string') {
    return dialect.escapeString(value);
  }

  return escapeNonString(value);
}

/**
 * Rewrites leaf strings in a where tree to dialect Unicode literals so CHECK
 * constraints do not pick up DataType-scoped VARCHAR-safe escaping.
 * Does not mutate the input. Leaves `Op.col` identifier targets untouched.
 *
 * @param value A where fragment or leaf value.
 * @param dialect The dialect whose `escapeString` produces Unicode literals.
 */
export function withDialectStringLiterals(value: unknown, dialect: AbstractDialect): unknown {
  if (typeof value === 'string') {
    return literal(dialect.escapeString(value));
  }

  if (Array.isArray(value)) {
    return value.map(item => withDialectStringLiterals(item, dialect));
  }

  if (value instanceof BaseSqlExpression) {
    return value;
  }

  if (!isPlainObject(value)) {
    return value;
  }

  // Op.col string targets are identifiers, not SQL string literals.
  if (Op.col in (value as object)) {
    return value;
  }

  const result: Record<PropertyKey, unknown> = {};
  for (const key of Reflect.ownKeys(value as object)) {
    result[key] = withDialectStringLiterals((value as Record<PropertyKey, unknown>)[key], dialect);
  }

  return result;
}
