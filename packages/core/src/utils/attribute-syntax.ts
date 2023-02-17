import memoize from 'lodash/memoize.js';
import { JsonPath, Attribute, AssociationPath, Cast } from './sequelize-method.js';
import { getEscapingBackslashCount } from './sql.js';

/**
 * Parses the attribute syntax (the syntax of keys in WHERE POJOs) into its "SequelizeMethod" representation.
 *
 * @example
 * ```ts
 * parseAttribute('id') // => attribute('id')
 * parseAttribute('$user.id$') // => association(['user'], 'id')
 * parseAttribute('json.key') // => jsonPath(attribute('json'), ['key'])
 * parseAttribute('name::number') // => cast(attribute('name'), 'number')
 * parseAttribute('json.key::number') // => cast(jsonPath(attribute('json'), ['key']), 'number')
 * ```
 *
 * @param attribute The syntax to parse
 */
export const parseAttributeSyntax = memoize(parseAttributeSyntaxInternal);

/**
 * Parses the syntax supported by nested JSON properties.
 * This is a subset of {@link parseAttributeSyntax}, which does not parse associations, and returns raw data
 * instead of a SequelizeMethod.
 */
export const parseNestedJsonKeySyntax = memoize(parseJsonPropertyKeyInternal);

function parseAttributeSyntaxInternal(
  code: string,
): Cast | JsonPath | AssociationPath | Attribute {
  const castMatch = parseCastSyntax(code);
  if (castMatch) {
    const { type, remainder } = castMatch;

    // recursive: can be cast multiple times
    // e.g. `foo::string::number`
    return new Cast(parseAttributeSyntaxInternal(remainder), type);
  }

  // extract $association.attribute$ syntax
  const associationMatch = code.match(/^\$(?<associationPath>[a-zA-Z0-9_.]+)\$(?:$|(?<remainder>[[.-].*))/);
  const associationPath = associationMatch?.groups!.associationPath;

  let unparsedJsonPath: string;
  if (associationMatch) {
    // parseJsonPathRaw does not support $association.attribute$ syntax, so we replace it with a dummy "x" segment
    // TODO: this hurts the error message display, we should make parseJsonPathRaw support this syntax for the very first segment (if a flag is set)
    unparsedJsonPath = `x${associationMatch.groups!.remainder}`;
  } else {
    unparsedJsonPath = code;
  }

  const [segments, isUnquoteOperator] = parseJsonPathRaw(unparsedJsonPath);
  if (segments.length === 1) {
    return parseAssociationPath(associationPath ?? segments[0]);
  }

  const firstSegment = segments.shift()!;

  return new JsonPath(parseAssociationPath(associationPath ?? firstSegment), segments, isUnquoteOperator);
}

/**
 * Do not mutate this! It is memoized to avoid re-parsing the same path over and over.
 */
export interface ParsedJsonPropertyKey {
  readonly pathSegments: readonly string[];
  readonly shouldUnquote: boolean;
  readonly casts: readonly string[];
}

function parseJsonPropertyKeyInternal(code: string): ParsedJsonPropertyKey {
  const casts: string[] = [];
  let remainder = code;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const castMatch = parseCastSyntax(remainder);
    if (!castMatch) {
      break;
    }

    casts.push(castMatch.type);
    remainder = castMatch.remainder;
  }

  const [segments, shouldUnquote] = parseJsonPathRaw(remainder);

  return { pathSegments: segments, shouldUnquote, casts };
}

const ALPHANUMERIC_REGEX = /^[a-zA-Z0-9_\-$]+$/;

const UNQUOTED_SEGMENT = Symbol('unquoted-segment');

function parseJsonPathRaw(code: string): [segments: string[], isUnquoteOperator: boolean] {
  const paths: string[] = [];

  let currentSegmentType: '[' | '"' | '\'' | typeof UNQUOTED_SEGMENT | null = null;
  // we reached the closing ], " or ' of the current path segment
  let hasUnquoteOperator = false;

  let currentPath = '';
  for (let i = 0; i < code.length; i++) {
    const char = code[i];

    if (currentPath.length > 0 && (currentSegmentType === null || currentSegmentType === UNQUOTED_SEGMENT)) {
      if (char === '.') {
        assertNoUnquoteOperator(hasUnquoteOperator, code, i);

        paths.push(currentPath);
        currentPath = '';
        continue;
      }

      // ->> operator
      if (char === '-' && code[i + 1] === '>' && code[i + 2] === '>') {
        assertNoUnquoteOperator(hasUnquoteOperator, code, i);

        paths.push(currentPath);
        currentPath = '';
        hasUnquoteOperator = true;
        i += 2;
        continue;
      }

      if (currentSegmentType === null && char !== '[') {
        throwSyntaxError(`Expected a ".", "->>", or "[" operator after a segment, but got ${char}`, code, i);
      }
    }

    if (currentSegmentType === null || currentSegmentType === UNQUOTED_SEGMENT) {
      if (char === '[') {
        paths.push(currentPath);
        currentPath = '';
        currentSegmentType = '[';
        continue;
      }

      if (char === '"' || char === '\'') {
        currentSegmentType = char;
        continue;
      }
    }

    if (currentSegmentType === null) {
      if (ALPHANUMERIC_REGEX.test(char)) {
        currentSegmentType = UNQUOTED_SEGMENT;
        currentPath += char;
        continue;
      }

      throwSyntaxError(`Invalid attribute syntax. Expected a property name but found "${char}"`, code, i);
    }

    if (currentSegmentType === '[' && char === ']') {
      currentSegmentType = null;
      assertNotEmptyPath(currentPath, code, i);
      continue;
    }

    if ((currentSegmentType === '"' || currentSegmentType === `'`) && char === currentSegmentType) {
      const escapeCount = getEscapingBackslashCount(code, i - 1);

      if (escapeCount > 0) {
        // remove half of the escaping backslashes that were used to escape the current quote
        currentPath = currentPath.slice(0, -Math.ceil(escapeCount / 2));
      }

      if (escapeCount % 2 === 0) {
        currentSegmentType = null;
        assertNotEmptyPath(currentPath, code, i);
        continue;
      }
    }

    // unquoted segment
    if (currentSegmentType !== UNQUOTED_SEGMENT || ALPHANUMERIC_REGEX.test(char)) {
      currentPath += char;
      continue;
    }

    throwSyntaxError(`Invalid attribute syntax. Expected a property name but found "${char}"`, code, i);
  }

  if (currentPath.length > 0) {
    paths.push(currentPath);
  }

  return [paths, hasUnquoteOperator];
}

function throwSyntaxError(message: string, code: string, pos: number): never {
  throw new Error(`${message}\nAt character ${pos}:\n${code}\n${' '.repeat(pos)}^`);
}

function assertNoUnquoteOperator(alreadyEnabled: boolean, code: string, pos: number) {
  if (alreadyEnabled) {
    throwSyntaxError('Invalid attribute syntax: "->>" and "." operators cannot be used after an unquote ("->>") operator as values produced by "->>" are not JSON', code, pos);
  }
}

function assertNotEmptyPath(path: string, code: string, pos: number) {
  if (path.length === 0) {
    throwSyntaxError(`Invalid attribute syntax: The current identifier is empty.`, code, pos);
  }
}

export function parseCastSyntax(value: string) {
  const castMatch = value.match(/(?<remainder>.+)::(?<type>[a-zA-Z_]+)$/);
  if (!castMatch) {
    return null;
  }

  return castMatch.groups! as { type: string, remainder: string };
}

function parseAssociationPath(syntax: string): AssociationPath | Attribute {
  const path = syntax.split('.');

  if (path.length > 1) {
    const attr = path.pop()!;

    return new AssociationPath(path, attr);
  }

  return new Attribute(syntax);
}
