import type { AbstractDialect } from '../abstract-dialect/dialect.js';
import { VIRTUAL } from '../data-types.js';
import { BaseSqlExpression } from '../expression-builders/base-sql-expression.js';

interface GeneratedColumnOptions {
  autoIncrement?: boolean | undefined;
  defaultValue?: unknown;
  generatedAs?: unknown;
  generatedColumn?: unknown;
  onDelete?: string | undefined;
  onUpdate?: string | undefined;
  references?: unknown;
  type?: unknown;
}

/**
 * Validates the options shared by model attributes and QueryInterface column definitions.
 *
 * @param attribute The attribute definition to validate.
 * @param dialect The dialect the attribute will be used with.
 * @param attributeDescription A human-readable attribute identifier for errors.
 */
export function validateGeneratedColumnOptions(
  attribute: GeneratedColumnOptions,
  dialect: AbstractDialect,
  attributeDescription: string,
): void {
  if (attribute.generatedColumn !== undefined && attribute.generatedAs === undefined) {
    throw new Error(
      `${attributeDescription}: "generatedColumn" requires "generatedAs" to be specified.`,
    );
  }

  if (attribute.generatedAs === undefined) {
    return;
  }

  if (!(attribute.generatedAs instanceof BaseSqlExpression)) {
    throw new TypeError(
      `${attributeDescription}: "generatedAs" must be a Sequelize SQL expression (for example, one created with the sql template tag or sql.fn).`,
    );
  }

  if (attribute.type instanceof VIRTUAL) {
    throw new TypeError(
      `${attributeDescription}: A generated column cannot use DataTypes.VIRTUAL because generated columns are physical database columns.`,
    );
  }

  const mode = attribute.generatedColumn ?? 'STORED';
  if (mode !== 'STORED' && mode !== 'VIRTUAL') {
    throw new Error(
      `${attributeDescription}: "generatedColumn" must be either "STORED" or "VIRTUAL".`,
    );
  }

  if (Object.hasOwn(attribute, 'defaultValue')) {
    throw new Error(`${attributeDescription}: A generated column cannot have a defaultValue.`);
  }

  if (attribute.autoIncrement) {
    throw new Error(`${attributeDescription}: A generated column cannot be autoIncrement.`);
  }

  if (attribute.references) {
    const onDelete = attribute.onDelete?.toUpperCase();
    if (onDelete === 'SET NULL' || onDelete === 'SET DEFAULT') {
      throw new Error(
        `${attributeDescription}: A generated foreign key cannot use ON DELETE ${onDelete} because generated columns cannot be updated directly.`,
      );
    }

    const onUpdate = attribute.onUpdate?.toUpperCase();
    if (onUpdate && onUpdate !== 'RESTRICT' && onUpdate !== 'NO ACTION') {
      throw new Error(
        `${attributeDescription}: A generated foreign key cannot use ON UPDATE ${onUpdate} because generated columns cannot be updated directly.`,
      );
    }
  }

  const supports = dialect.supports.generatedColumns;
  if (!supports.stored && !supports.virtual) {
    throw new Error(
      `${attributeDescription}: The ${dialect.name} dialect does not support generated columns.`,
    );
  }

  if (mode === 'STORED' && !supports.stored) {
    throw new Error(
      `${attributeDescription}: The ${dialect.name} dialect does not support STORED generated columns.`,
    );
  }

  if (mode === 'VIRTUAL' && !supports.virtual) {
    throw new Error(
      `${attributeDescription}: The ${dialect.name} dialect does not support VIRTUAL generated columns.`,
    );
  }
}

/**
 * Finds a SQL keyword that is outside of parentheses, quoted values, quoted identifiers, and
 * comments. Column definitions use top-level keywords to separate their data type from constraints,
 * but generated column expressions can contain the same keywords.
 *
 * @param sql The SQL fragment to search.
 * @param keyword The keyword to find.
 * @param dialect The dialect whose identifier and string quoting rules should be used.
 * @internal
 */
export function findTopLevelSqlKeyword(
  sql: string,
  keyword: string,
  dialect: AbstractDialect,
): number {
  const normalizedKeyword = keyword.toUpperCase();
  let parenthesesDepth = 0;
  let quotedIdentifierEnd: string | undefined;
  let inString = false;
  let stringIsBackslashEscapable = false;
  let dollarQuoteTag: string | undefined;
  let alternativeQuoteEnd: string | undefined;
  let inLineComment = false;
  let blockCommentDepth = 0;

  for (let index = 0; index < sql.length; index++) {
    const char = sql[index];

    if (quotedIdentifierEnd !== undefined) {
      if (char === quotedIdentifierEnd) {
        if (sql[index + 1] === quotedIdentifierEnd) {
          index++;
        } else {
          quotedIdentifierEnd = undefined;
        }
      }

      continue;
    }

    if (inString) {
      if (char === "'" && (!stringIsBackslashEscapable || !isBackslashEscaped(sql, index - 1))) {
        if (sql[index + 1] === "'") {
          index++;
        } else {
          inString = false;
          stringIsBackslashEscapable = false;
        }
      }

      continue;
    }

    if (dollarQuoteTag !== undefined) {
      if (sql.startsWith(dollarQuoteTag, index)) {
        index += dollarQuoteTag.length - 1;
        dollarQuoteTag = undefined;
      }

      continue;
    }

    if (alternativeQuoteEnd !== undefined) {
      if (char === alternativeQuoteEnd && sql[index + 1] === "'") {
        index++;
        alternativeQuoteEnd = undefined;
      }

      continue;
    }

    if (inLineComment) {
      if (char === '\n' || char === '\r') {
        inLineComment = false;
      }

      continue;
    }

    if (blockCommentDepth > 0) {
      if (char === '/' && sql[index + 1] === '*') {
        blockCommentDepth++;
        index++;
      } else if (char === '*' && sql[index + 1] === '/') {
        blockCommentDepth--;
        index++;
      }

      continue;
    }

    if (char === dialect.TICK_CHAR_LEFT) {
      quotedIdentifierEnd = dialect.TICK_CHAR_RIGHT;
      continue;
    }

    if (char === "'") {
      inString = true;
      stringIsBackslashEscapable =
        dialect.canBackslashEscape() ||
        (dialect.supports.escapeStringConstants &&
          (sql[index - 1] === 'E' || sql[index - 1] === 'e') &&
          isTokenBoundary(sql[index - 2]));
      continue;
    }

    if ((char === 'q' || char === 'Q') && sql[index + 1] === "'" && sql[index + 2]) {
      const quoteStart = sql[index + 2];
      alternativeQuoteEnd =
        quoteStart === '['
          ? ']'
          : quoteStart === '{'
            ? '}'
            : quoteStart === '('
              ? ')'
              : quoteStart === '<'
                ? '>'
                : quoteStart;
      index += 2;
      continue;
    }

    if (char === '-' && sql[index + 1] === '-') {
      inLineComment = true;
      index++;
      continue;
    }

    if (char === '/' && sql[index + 1] === '*') {
      blockCommentDepth = 1;
      index++;
      continue;
    }

    if (char === '$' && isTokenBoundary(sql[index - 1])) {
      const dollarQuoteMatch = sql.slice(index).match(/^\$(?:[a-z_][0-9a-z_]*)?\$/i);
      if (dollarQuoteMatch) {
        dollarQuoteTag = dollarQuoteMatch[0];
        index += dollarQuoteTag.length - 1;
        continue;
      }
    }

    if (char === '(') {
      parenthesesDepth++;
      continue;
    }

    if (char === ')') {
      parenthesesDepth = Math.max(0, parenthesesDepth - 1);
      continue;
    }

    if (
      parenthesesDepth === 0 &&
      isTokenBoundary(sql[index - 1]) &&
      sql.slice(index, index + keyword.length).toUpperCase() === normalizedKeyword &&
      isTokenBoundary(sql[index + keyword.length])
    ) {
      return index;
    }
  }

  return -1;
}

/**
 * @param sql The SQL fragment to edit.
 * @param keyword The top-level keyword to remove.
 * @param dialect The dialect whose SQL quoting rules should be used.
 * @internal
 */
export function removeTopLevelSqlKeyword(
  sql: string,
  keyword: string,
  dialect: AbstractDialect,
): string {
  const index = findTopLevelSqlKeyword(sql, keyword, dialect);

  return index === -1 ? sql : `${sql.slice(0, index)}${sql.slice(index + keyword.length)}`;
}

/**
 * @param sql The SQL fragment to split.
 * @param keyword The top-level keyword at which to split.
 * @param dialect The dialect whose SQL quoting rules should be used.
 * @internal
 */
export function splitSqlAtTopLevelKeyword(
  sql: string,
  keyword: string,
  dialect: AbstractDialect,
): [beforeKeyword: string, keywordAndAfter: string] | undefined {
  const index = findTopLevelSqlKeyword(sql, keyword, dialect);

  if (index === -1) {
    return undefined;
  }

  return [sql.slice(0, index).trimEnd(), sql.slice(index)];
}

/**
 * @param sql The SQL fragment to split.
 * @param keyword The last top-level keyword at which to split.
 * @param dialect The dialect whose SQL quoting rules should be used.
 * @internal
 */
export function splitSqlAtLastTopLevelKeyword(
  sql: string,
  keyword: string,
  dialect: AbstractDialect,
): [beforeKeyword: string, keywordAndAfter: string] | undefined {
  let lastKeywordIndex = -1;
  let searchStart = 0;

  while (searchStart < sql.length) {
    const relativeIndex = findTopLevelSqlKeyword(sql.slice(searchStart), keyword, dialect);
    if (relativeIndex === -1) {
      break;
    }

    lastKeywordIndex = searchStart + relativeIndex;
    searchStart = lastKeywordIndex + keyword.length;
  }

  if (lastKeywordIndex === -1) {
    return undefined;
  }

  return [sql.slice(0, lastKeywordIndex).trimEnd(), sql.slice(lastKeywordIndex)];
}

function isTokenBoundary(char: string | undefined): boolean {
  return char === undefined || !/[0-9a-z_$]/i.test(char);
}

function isBackslashEscaped(value: string, index: number): boolean {
  let escaped = false;

  for (let position = index; position >= 0 && value[position] === '\\'; position--) {
    escaped = !escaped;
  }

  return escaped;
}
