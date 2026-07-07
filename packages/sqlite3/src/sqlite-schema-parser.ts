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

export function replaceSqlIdentifier(sql: string, identifier: string, replacement: string): string {
  let result = '';
  let index = 0;

  while (index < sql.length) {
    const character = sql[index];

    if (character === '-' && sql[index + 1] === '-') {
      const lineEnd = /[\r\n]/.exec(sql.slice(index + 2));
      const commentEnd = lineEnd ? index + 2 + lineEnd.index : sql.length;
      result += sql.slice(index, commentEnd);
      index = commentEnd;
      continue;
    }

    if (character === '/' && sql[index + 1] === '*') {
      const blockEnd = sql.indexOf('*/', index + 2);
      const commentEnd = blockEnd === -1 ? sql.length : blockEnd + 2;
      result += sql.slice(index, commentEnd);
      index = commentEnd;
      continue;
    }

    // Single-quoted tokens are string literals. SQLite accepts them as identifiers in a few
    // legacy contexts, but changing their contents here would corrupt defaults and trigger bodies.
    if (character === "'") {
      let stringEnd = index + 1;
      while (stringEnd < sql.length) {
        if (sql[stringEnd] !== "'") {
          stringEnd++;
        } else if (sql[stringEnd + 1] === "'") {
          stringEnd += 2;
        } else {
          stringEnd++;
          break;
        }
      }

      result += sql.slice(index, stringEnd);
      index = stringEnd;
      continue;
    }

    if (character === '"' || character === '`' || character === '[') {
      const closingQuote = character === '[' ? ']' : character;
      let quotedIdentifier = '';
      let quoteEnd = index + 1;
      while (quoteEnd < sql.length) {
        if (sql[quoteEnd] !== closingQuote) {
          quotedIdentifier += sql[quoteEnd];
          quoteEnd++;
        } else if (sql[quoteEnd + 1] === closingQuote) {
          quotedIdentifier += closingQuote;
          quoteEnd += 2;
        } else {
          quoteEnd++;
          break;
        }
      }

      if (quotedIdentifier.toLowerCase() === identifier.toLowerCase()) {
        const escapedReplacement = replacement.replaceAll(closingQuote, closingQuote.repeat(2));
        result += `${character}${escapedReplacement}${closingQuote}`;
      } else {
        result += sql.slice(index, quoteEnd);
      }

      index = quoteEnd;
      continue;
    }

    if (isIdentifierCharacter(character)) {
      let identifierEnd = index + 1;
      while (isIdentifierCharacter(sql[identifierEnd])) {
        identifierEnd++;
      }

      const token = sql.slice(index, identifierEnd);
      result += token.toLowerCase() === identifier.toLowerCase() ? replacement : token;
      index = identifierEnd;
      continue;
    }

    result += character;
    index++;
  }

  return result;
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
