function isIdentifierCharacter(character: string | undefined): boolean {
  return character !== undefined && /[\w$]/.test(character);
}

function skipWhitespaceAndComments(sql: string, start: number): number {
  let index = start;
  while (index < sql.length) {
    if (/\s/.test(sql[index])) {
      index++;
      continue;
    }

    if (sql[index] === '-' && sql[index + 1] === '-') {
      const lineEnd = /[\r\n]/.exec(sql.slice(index + 2));
      index = lineEnd ? index + 2 + lineEnd.index + 1 : sql.length;
      continue;
    }

    if (sql[index] === '/' && sql[index + 1] === '*') {
      const commentEnd = sql.indexOf('*/', index + 2);
      index = commentEnd === -1 ? sql.length : commentEnd + 2;
      continue;
    }

    break;
  }

  return index;
}

export function getSqlColumnName(definition: string): string | undefined {
  const start = skipWhitespaceAndComments(definition, 0);
  const openingQuote = definition[start];
  const closingQuote = openingQuote === '[' ? ']' : openingQuote;
  if (
    openingQuote === '`' ||
    openingQuote === '"' ||
    openingQuote === "'" ||
    openingQuote === '['
  ) {
    let columnName = '';
    for (let index = start + 1; index < definition.length; index++) {
      const character = definition[index];
      if (character !== closingQuote) {
        columnName += character;
      } else if (definition[index + 1] === closingQuote) {
        columnName += closingQuote;
        index++;
      } else {
        return columnName;
      }
    }

    return undefined;
  }

  return /^([^\s]+)/.exec(definition.slice(start))?.[1];
}

export function findSqlClosingParenthesis(sql: string, openingParenthesis: number): number {
  let depth = 0;
  let closingQuote: string | undefined;
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = openingParenthesis; index < sql.length; index++) {
    const character = sql[index];

    if (inLineComment) {
      if (character === '\n' || character === '\r') {
        inLineComment = false;
      }

      continue;
    }

    if (inBlockComment) {
      if (character === '*' && sql[index + 1] === '/') {
        inBlockComment = false;
        index++;
      }

      continue;
    }

    if (closingQuote) {
      if (character === closingQuote) {
        if (sql[index + 1] === closingQuote) {
          index++;
        } else {
          closingQuote = undefined;
        }
      }

      continue;
    }

    if (character === '-' && sql[index + 1] === '-') {
      inLineComment = true;
      index++;
    } else if (character === '/' && sql[index + 1] === '*') {
      inBlockComment = true;
      index++;
    } else if (character === "'" || character === '"' || character === '`') {
      closingQuote = character;
    } else if (character === '[') {
      closingQuote = ']';
    } else if (character === '(') {
      depth++;
    } else if (character === ')' && --depth === 0) {
      return index;
    }
  }

  return -1;
}

export function findSqlOpeningParenthesis(sql: string): number {
  let closingQuote: string | undefined;
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = 0; index < sql.length; index++) {
    const character = sql[index];

    if (inLineComment) {
      if (character === '\n' || character === '\r') {
        inLineComment = false;
      }

      continue;
    }

    if (inBlockComment) {
      if (character === '*' && sql[index + 1] === '/') {
        inBlockComment = false;
        index++;
      }

      continue;
    }

    if (closingQuote) {
      if (character === closingQuote) {
        if (sql[index + 1] === closingQuote) {
          index++;
        } else {
          closingQuote = undefined;
        }
      }

      continue;
    }

    if (character === '-' && sql[index + 1] === '-') {
      inLineComment = true;
      index++;
    } else if (character === '/' && sql[index + 1] === '*') {
      inBlockComment = true;
      index++;
    } else if (character === "'" || character === '"' || character === '`') {
      closingQuote = character;
    } else if (character === '[') {
      closingQuote = ']';
    } else if (character === '(') {
      return index;
    }
  }

  return -1;
}

export function findSqlTokenOpeningParenthesis(sql: string, token: string): number {
  let closingQuote: string | undefined;
  let inLineComment = false;
  let inBlockComment = false;
  let parenthesisDepth = 0;

  for (let index = 0; index < sql.length; index++) {
    const character = sql[index];

    if (inLineComment) {
      if (character === '\n' || character === '\r') {
        inLineComment = false;
      }

      continue;
    }

    if (inBlockComment) {
      if (character === '*' && sql[index + 1] === '/') {
        inBlockComment = false;
        index++;
      }

      continue;
    }

    if (closingQuote) {
      if (character === closingQuote) {
        if (sql[index + 1] === closingQuote) {
          index++;
        } else {
          closingQuote = undefined;
        }
      }

      continue;
    }

    if (character === '-' && sql[index + 1] === '-') {
      inLineComment = true;
      index++;
      continue;
    }

    if (character === '/' && sql[index + 1] === '*') {
      inBlockComment = true;
      index++;
      continue;
    }

    if (character === "'" || character === '"' || character === '`') {
      closingQuote = character;
      continue;
    }

    if (character === '[') {
      closingQuote = ']';
      continue;
    }

    if (character === '(') {
      parenthesisDepth++;
      continue;
    }

    if (character === ')') {
      parenthesisDepth--;
      continue;
    }

    if (
      parenthesisDepth !== 0 ||
      sql.slice(index, index + token.length).toLowerCase() !== token.toLowerCase() ||
      isIdentifierCharacter(sql[index - 1]) ||
      isIdentifierCharacter(sql[index + token.length])
    ) {
      continue;
    }

    const openingParenthesis = skipWhitespaceAndComments(sql, index + token.length);
    if (sql[openingParenthesis] === '(') {
      return openingParenthesis;
    }
  }

  return -1;
}
