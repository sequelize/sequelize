import isPlainObject from 'lodash/isPlainObject';
import type { AbstractDialect, BindCollector } from '../abstract-dialect/dialect.js';
import type { EscapeOptions } from '../abstract-dialect/query-generator-typescript.js';
import type { AddLimitOffsetOptions } from '../abstract-dialect/query-generator.internal-types.js';
import type { AbstractQueryGenerator } from '../abstract-dialect/query-generator.js';
import { BaseSqlExpression } from '../expression-builders/base-sql-expression.js';
import type { BindOrReplacements, QueryRawOptions, Sequelize } from '../sequelize.js';

type OnBind = (oldName: string) => string;

type MapSqlOptions = {
  onPositionalReplacement?(): void;
};

/**
 * Internal function used by {@link mapBindParameters} and {@link injectReplacements}.
 * Parse bind parameters & replacements in places where they would be valid SQL values.
 *
 * @param sqlString The SQL that contains the bind parameters & replacements
 * @param dialect The dialect of the SQL
 * @param replacements if provided, this method will replace ':named' replacements & positional replacements (?)
 * @param onBind if provided, sequelize will call this method each time a $bind parameter is found, and replace it with its output.
 * @param options Options
 *
 * @returns The SQL with bind parameters & replacements rewritten in their dialect-specific syntax.
 */
function mapBindParametersAndReplacements(
  sqlString: string,
  dialect: AbstractDialect,
  replacements?: BindOrReplacements,
  onBind?: OnBind,
  options?: MapSqlOptions,
): string {
  const isNamedReplacements = isPlainObject(replacements);
  const isPositionalReplacements = Array.isArray(replacements);
  const escapeOptions: EscapeOptions = { replacements };

  let lastConsumedPositionalReplacementIndex = -1;

  let output: string = '';

  let currentDollarStringTagName = null;
  let isString = false;
  let isColumn = false;
  let previousSliceEnd = 0;
  let isSingleLineComment = false;
  let isCommentBlock = false;
  let stringIsBackslashEscapable = false;

  for (let i = 0; i < sqlString.length; i++) {
    const char = sqlString[i];

    if (isColumn) {
      if (char === dialect.TICK_CHAR_RIGHT) {
        isColumn = false;
      }

      continue;
    }

    if (isString) {
      if (char === `'` && (!stringIsBackslashEscapable || !isBackslashEscaped(sqlString, i - 1))) {
        isString = false;
        stringIsBackslashEscapable = false;
      }

      continue;
    }

    if (currentDollarStringTagName !== null) {
      if (char !== '$') {
        continue;
      }

      const remainingString = sqlString.slice(i, sqlString.length);

      const dollarStringStartMatch = remainingString.match(/^\$(?<name>[a-z_][0-9a-z_]*)?(\$)/i);
      const tagName = dollarStringStartMatch?.groups?.name ?? '';

      if (currentDollarStringTagName === tagName) {
        currentDollarStringTagName = null;
      }

      continue;
    }

    if (isSingleLineComment) {
      if (char === '\n') {
        isSingleLineComment = false;
      }

      continue;
    }

    if (isCommentBlock) {
      if (char === '*' && sqlString[i + 1] === '/') {
        isCommentBlock = false;
      }

      continue;
    }

    if (char === dialect.TICK_CHAR_LEFT) {
      isColumn = true;
      continue;
    }

    if (char === `'`) {
      isString = true;

      // The following query is supported in almost all dialects,
      //  SELECT E'test';
      // but postgres interprets it as an E-prefixed string, while other dialects interpret it as
      //  SELECT E 'test';
      // which selects the type E and aliases it to 'test'.

      stringIsBackslashEscapable =
        // all ''-style strings in this dialect can be backslash escaped
        dialect.canBackslashEscape() ||
        // checking if this is a postgres-style E-prefixed string, which also supports backslash escaping
        (dialect.supports.escapeStringConstants &&
          // is this a E-prefixed string, such as `E'abc'`, `e'abc'` ?
          (sqlString[i - 1] === 'E' || sqlString[i - 1] === 'e') &&
          // reject things such as `AE'abc'` (the prefix must be exactly E)
          canPrecedeNewToken(sqlString[i - 2]));

      continue;
    }

    if (char === '-' && sqlString.slice(i, i + 3) === '-- ') {
      isSingleLineComment = true;
      continue;
    }

    if (char === '/' && sqlString.slice(i, i + 2) === '/*') {
      isCommentBlock = true;
      continue;
    }

    // either the start of a $bind parameter, or the start of a $tag$string$tag$
    if (char === '$') {
      const previousChar = sqlString[i - 1];

      // we are part of an identifier
      if (/[0-9a-z_]/i.test(previousChar)) {
        continue;
      }

      const remainingString = sqlString.slice(i, sqlString.length);

      const dollarStringStartMatch = remainingString.match(/^\$(?<name>[a-z_][0-9a-z_]*)?\$/i);
      if (dollarStringStartMatch) {
        currentDollarStringTagName = dollarStringStartMatch.groups?.name ?? '';
        i += dollarStringStartMatch[0].length - 1;

        continue;
      }

      if (onBind) {
        // we want to be conservative with what we consider to be a bind parameter to avoid risk of conflict with potential operators
        // users need to add a space before the bind parameter (except after '(', ',', and '=')
        if (!canPrecedeNewToken(previousChar)) {
          continue;
        }

        // detect the bind param if it's a valid identifier and it's followed either by '::' (=cast), ')', whitespace of it's the end of the query.
        const match = remainingString.match(
          /^\$(?<name>([a-z_][0-9a-z_]*|[1-9][0-9]*))(?:\]|\)|,|$|\s|::|;)/i,
        );
        const bindParamName = match?.groups?.name;
        if (!bindParamName) {
          continue;
        }

        // we found a bind parameter
        const newName: string = onBind(bindParamName);

        // add everything before the bind parameter name
        output += sqlString.slice(previousSliceEnd, i);
        // continue after the bind parameter name
        previousSliceEnd = i + bindParamName.length + 1;

        output += newName;
      }

      continue;
    }

    if (isNamedReplacements && char === ':') {
      const previousChar = sqlString[i - 1];
      // we want to be conservative with what we consider to be a replacement to avoid risk of conflict with potential operators
      // users need to add a space before the bind parameter (except after '(', ',', '=', and '[' (for arrays))
      if (!canPrecedeNewToken(previousChar) && previousChar !== '[') {
        continue;
      }

      const remainingString = sqlString.slice(i, sqlString.length);

      const match = remainingString.match(/^:(?<name>[a-z_][0-9a-z_]*)(?:\)|,|$|\s|::|;|])/i);
      const replacementName = match?.groups?.name;
      if (!replacementName) {
        continue;
      }

      // @ts-expect-error -- isPlainObject does not tell typescript that replacements is a plain object, not an array
      const replacementValue = replacements[replacementName];
      if (
        !Object.hasOwn(replacements as object, replacementName) ||
        replacementValue === undefined
      ) {
        throw new Error(
          `Named replacement ":${replacementName}" has no entry in the replacement map.`,
        );
      }

      const escapedReplacement = escapeValueWithBackCompat(
        replacementValue,
        dialect,
        escapeOptions,
      );

      // add everything before the bind parameter name
      output += sqlString.slice(previousSliceEnd, i);
      // continue after the bind parameter name
      previousSliceEnd = i + replacementName.length + 1;

      output += escapedReplacement;

      continue;
    }

    if (isPositionalReplacements && char === '?') {
      const previousChar = sqlString[i - 1];

      // we want to be conservative with what we consider to be a replacement to avoid risk of conflict with potential operators
      // users need to add a space before the bind parameter (except after '(', ',', '=', and '[' (for arrays))
      // -> [ is temporarily added to allow 'ARRAY[:name]' to be replaced
      // https://github.com/sequelize/sequelize/issues/14410 will make this obsolete.
      if (!canPrecedeNewToken(previousChar) && previousChar !== '[') {
        continue;
      }

      // don't parse ?| and ?& operators as replacements
      const nextChar = sqlString[i + 1];
      if (nextChar === '|' || nextChar === '&') {
        continue;
      }

      // this is a positional replacement
      if (options?.onPositionalReplacement) {
        options.onPositionalReplacement();
      }

      const replacementIndex = ++lastConsumedPositionalReplacementIndex;
      const replacementValue = replacements[lastConsumedPositionalReplacementIndex];

      if (replacementValue === undefined) {
        throw new Error(
          `Positional replacement (?) ${replacementIndex} has no entry in the replacement map (replacements[${replacementIndex}] is undefined).`,
        );
      }

      const escapedReplacement = escapeValueWithBackCompat(
        replacementValue,
        dialect,
        escapeOptions,
      );

      // add everything before the bind parameter name
      output += sqlString.slice(previousSliceEnd, i);
      // continue after the bind parameter name
      previousSliceEnd = i + 1;

      output += escapedReplacement;
    }
  }

  if (isString) {
    throw new Error(
      `The following SQL query includes an unterminated string literal:\n${sqlString}`,
    );
  }

  output += sqlString.slice(previousSliceEnd, sqlString.length);

  return output;
}

function escapeValueWithBackCompat(
  value: unknown,
  dialect: AbstractDialect,
  escapeOptions: EscapeOptions,
): string {
  // Arrays used to be escaped as sql lists, not sql arrays
  // now they must be escaped as sql arrays, and the old behavior has been moved to the list() function.
  // The problem is that if we receive a list of list, there are cases where we don't want the extra parentheses around the list,
  // such as in the case of a bulk insert.
  // As a workaround, non-list arrays that contain dynamic values are joined with commas.
  if (Array.isArray(value) && value.some(item => item instanceof BaseSqlExpression)) {
    return value.map(item => dialect.queryGenerator.escape(item, escapeOptions)).join(', ');
  }

  return dialect.queryGenerator.escape(value, escapeOptions);
}

function canPrecedeNewToken(char: string | undefined): boolean {
  return char === undefined || /[\s([>,=]/.test(char);
}

/**
 * Maps bind parameters from Sequelize's format ($1 or $name) to the dialect's format.
 *
 * @param sqlString
 * @param dialect
 */
export function mapBindParameters(
  sqlString: string,
  dialect: AbstractDialect,
): {
  sql: string;
  bindOrder: string[] | null;
  parameterSet: Set<string>;
} {
  const parameterCollector = dialect.createBindCollector();
  const parameterSet = new Set<string>();

  const newSql = mapBindParametersAndReplacements(
    sqlString,
    dialect,
    undefined,
    foundBindParamName => {
      parameterSet.add(foundBindParamName);

      return parameterCollector.collect(foundBindParamName);
    },
  );

  return { sql: newSql, bindOrder: parameterCollector.getBindParameterOrder(), parameterSet };
}

export function injectReplacements(
  sqlString: string,
  dialect: AbstractDialect,
  replacements: BindOrReplacements,
  opts?: MapSqlOptions,
): string {
  if (replacements == null) {
    return sqlString;
  }

  if (!Array.isArray(replacements) && !isPlainObject(replacements)) {
    throw new TypeError(
      `"replacements" must be an array or a plain object, but received ${JSON.stringify(replacements)} instead.`,
    );
  }

  return mapBindParametersAndReplacements(sqlString, dialect, replacements, undefined, opts);
}

function isBackslashEscaped(string: string, pos: number): boolean {
  let escaped = false;
  for (let i = pos; i >= 0; i--) {
    const char = string[i];
    if (char !== '\\') {
      break;
    }

    escaped = !escaped;
  }

  return escaped;
}

/**
 * Collector for dialects that only support ordered parameters, and whose order matter in the SQL query. (e.g. dialects that use the "?" token for parameters)
 *
 * @param token The token to use as the bind parameter (e.g. '?' in mysql).
 */
export function createUnspecifiedOrderedBindCollector(token = '?'): BindCollector {
  const parameterOrder: string[] = [];

  return {
    collect(bindParameterName) {
      parameterOrder.push(bindParameterName);

      return token;
    },
    getBindParameterOrder() {
      return parameterOrder;
    },
  };
}

/**
 * Collector for dialects that only support ordered parameters, but whose order does not matter in the SQL query (e.g. dialect that support parameters names like '$1')
 *
 * Parameter index starts at 1!
 *
 * @param prefix The prefix to place before the name of the bind parameter (e.g. @ for mssql, $ for sqlite/postgres)
 */
export function createSpecifiedOrderedBindCollector(prefix = '$'): BindCollector {
  const parameterOrder: string[] = [];

  return {
    collect(bindParameterName) {
      const cachedPosition = parameterOrder.indexOf(bindParameterName);
      if (cachedPosition === -1) {
        parameterOrder.push(bindParameterName);

        return `${prefix}${parameterOrder.length}`;
      }

      return `${prefix}${cachedPosition + 1}`;
    },
    getBindParameterOrder() {
      return parameterOrder;
    },
  };
}

/**
 * Collector for dialects that support named bind parameters (e.g. @name, $name, etc)
 *
 * @param parameterPrefix The prefix to place before the name of the bind parameter (e.g. @ for mssql, $ for sqlite/postgres)
 */
export function createNamedParamBindCollector(parameterPrefix: string): BindCollector {
  return {
    collect(bindParameterName: string) {
      return parameterPrefix + bindParameterName;
    },
    getBindParameterOrder() {
      return null;
    },
  };
}

export function assertNoReservedBind(bind: BindOrReplacements): void {
  if (Array.isArray(bind)) {
    return;
  }

  for (const key of Object.keys(bind)) {
    if (key.startsWith('sequelize_')) {
      throw new Error(
        'Bind parameters cannot start with "sequelize_", these bind parameters are reserved by Sequelize.',
      );
    }
  }
}

export function combineBinds(bindA: BindOrReplacements, bindB: { [key: string]: unknown }) {
  if (Array.isArray(bindA)) {
    bindA = arrayBindToNamedBind(bindA);
  }

  return {
    ...bindA,
    ...bindB,
  };
}

function arrayBindToNamedBind(bind: unknown[]): { [key: string]: unknown } {
  const out = Object.create(null);

  // eslint-disable-next-line unicorn/no-for-loop -- too slow.
  for (let i = 0; i < bind.length; i++) {
    out[i + 1] = bind[i];
  }

  return out;
}

export function escapeMysqlMariaDbString(value: string): string {
  // eslint-disable-next-line no-control-regex -- \u001A is intended to be in this regex
  value = value.replaceAll(/[\b\0\t\n\r\u001A'\\]/g, s => {
    switch (s) {
      case '\0':
        return '\\0';
      case '\n':
        return '\\n';
      case '\r':
        return '\\r';
      case '\b':
        return '\\b';
      case '\t':
        return '\\t';
      case '\u001A':
        return '\\Z';
      default:
        return `\\${s}`;
    }
  });

  return `'${value}'`;
}

export function formatDb2StyleLimitOffset(
  options: AddLimitOffsetOptions,
  queryGenerator: AbstractQueryGenerator,
): string {
  let fragment = '';
  if (options.offset) {
    fragment += ` OFFSET ${queryGenerator.escape(options.offset, options)} ROWS`;
  }

  if (options.limit != null) {
    fragment += ` FETCH NEXT ${queryGenerator.escape(options.limit, options)} ROWS ONLY`;
  }

  return fragment;
}

export function formatMySqlStyleLimitOffset(
  options: AddLimitOffsetOptions,
  queryGenerator: AbstractQueryGenerator,
): string {
  let fragment = '';
  if (options.limit != null) {
    fragment += ` LIMIT ${queryGenerator.escape(options.limit, options)}`;
  } else if (options.offset) {
    // limit must be specified if offset is specified.
    fragment += ` LIMIT 18446744073709551615`;
  }

  if (options.offset) {
    fragment += ` OFFSET ${queryGenerator.escape(options.offset, options)}`;
  }

  return fragment;
}

export async function withSqliteForeignKeysOff<T>(
  sequelize: Sequelize,
  options: QueryRawOptions | undefined,
  cb: () => Promise<T>,
): Promise<T> {
  try {
    await sequelize.queryRaw('PRAGMA foreign_keys = OFF', options);

    return await cb();
  } finally {
    await sequelize.queryRaw('PRAGMA foreign_keys = ON', options);
  }
}

/**
 * Creates a function that can be used to collect bind parameters.
 *
 * @param bind A mutable object to which bind parameters will be added.
 */
export function createBindParamGenerator(
  bind: Record<string, unknown>,
): (value: unknown) => string {
  let i = 0;

  return (value: unknown): string => {
    const bindName = `sequelize_${++i}`;

    bind[bindName] = value;

    return `$${bindName}`;
  };
}
