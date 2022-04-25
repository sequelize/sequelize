import type { AbstractDialect, BindCollector } from '../dialects/abstract/index.js';
import type { BindOrReplacements } from '../sequelize.js';

/**
 * Maps bind parameters from Sequelize's format ($1 or $name) to the dialect's format.
 *
 * @param sqlString
 * @param dialect
 */
export function mapBindParameters(sqlString: string, dialect: AbstractDialect): {
  sql: string,
  bindOrder: string[] | null,
  parameterSet: Set<string>,
} {
  let output: string = '';

  const parameterCollector = dialect.createBindCollector();
  const parameterSet = new Set<string>();

  let currentDollarStringTagName = null;
  let isString = false;
  let isColumn = false;
  let previousSliceEnd = 0;
  let isSingleLineComment = false;
  let isCommentBlock = false;

  for (let i = 0; i < sqlString.length; i++) {
    const char = sqlString[i];

    if (isColumn) {
      if (char === dialect.TICK_CHAR_RIGHT) {
        isColumn = false;
      }

      continue;
    }

    if (isString) {
      if (char === `'` && !isBackslashEscaped(sqlString, i - 1)) {
        isString = false;
      }

      continue;
    }

    if (currentDollarStringTagName !== null) {
      if (char !== '$') {
        continue;
      }

      const remainingString = sqlString.slice(i, sqlString.length);

      const dollarStringStartMatch = remainingString.match(/^\$(?<name>[a-z_][0-9a-z_])?(\$)/i);
      const tagName = dollarStringStartMatch?.groups?.name;
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

        continue;
      }

      // we want to be conservative with what we consider to be a bind parameter to avoid risk of conflict with potential operators
      // users need to add a space before the bind parameter (except after '(', ',', and '=')
      if (previousChar !== undefined && !/[\s(,=]/.test(previousChar)) {
        continue;
      }

      // detect the bind param if it's a valid identifier and it's followed either by '::' (=cast), ')', whitespace of it's the end of the query.
      const match = remainingString.match(/^\$(?<name>([a-z_][0-9a-z_]*|[1-9][0-9]*))(?:\)|,|$|\s|::)/i);
      const bindParamName = match?.groups?.name;
      if (!bindParamName) {
        continue;
      }

      parameterSet.add(bindParamName);

      // we found a bind parameter
      const newName = parameterCollector.collect(bindParamName);

      // add everything before the bind parameter name
      output += sqlString.slice(previousSliceEnd, i);
      // continue after the bind parameter name
      previousSliceEnd = i + bindParamName.length + 1;

      output += newName;
    }
  }

  output += sqlString.slice(previousSliceEnd, sqlString.length);

  return { sql: output, bindOrder: parameterCollector.getBindParameterOrder(), parameterSet };
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
    collect(bindParameterName) {
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
      throw new Error('Bind parameters cannot start with "sequelize_", these bind parameters are reserved by Sequelize.');
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
