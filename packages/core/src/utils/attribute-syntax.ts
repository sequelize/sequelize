import NodeUtil from 'node:util';
import memoize from 'lodash/memoize.js';
import type { Class } from 'type-fest';
import { AssociationPath } from '../expression-builders/association-path.js';
import { Attribute } from '../expression-builders/attribute.js';
import { Cast } from '../expression-builders/cast.js';
import type { DialectAwareFn } from '../expression-builders/dialect-aware-fn.js';
import { Unquote } from '../expression-builders/dialect-aware-fn.js';
import { JsonPath } from '../expression-builders/json-path.js';
import { noPrototype } from './object.js';
import { getEscapingBackslashCount } from './sql.js';

/**
 * List of supported attribute modifiers.
 * They can be specified in the attribute syntax, e.g. `foo:upper` will call the `upper` modifier on the `foo` attribute.
 *
 * All names should be lowercase, as they are case-insensitive.
 */
const builtInModifiers: Record<string, Class<DialectAwareFn>> = noPrototype({
  unquote: Unquote,
});

/**
 * Parses the attribute syntax (the syntax of keys in WHERE POJOs) into its "BaseExpression" representation.
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
export const parseAttributeSyntax = memoize(code => {
  try {
    return parseAttributeSyntaxInternal(code);
  } catch (error) {
    throw new Error(`Failed to parse syntax of attribute ${NodeUtil.inspect(code)}`, { cause: error });
  }
});

/**
 * Parses the syntax supported by nested JSON properties.
 * This is a subset of {@link parseAttributeSyntax}, which does not parse associations, and returns raw data
 * instead of a BaseExpression.
 */
export const parseNestedJsonKeySyntax = memoize(parseJsonPropertyKeyInternal);

function parseAttributeSyntaxInternal(
  code: string,
): Cast | JsonPath | AssociationPath | Attribute | DialectAwareFn {

  const castMatch = parseCastAndModifierSyntax(code);
  if (castMatch) {
    const { type, remainder, castToken } = castMatch;

    if (castToken === '::') {
      // recursive: casts & modifiers can be chained
      // e.g. `foo::string::number`
      return new Cast(parseAttributeSyntaxInternal(remainder), type);
    }

    const ModifierClass = builtInModifiers[type.toLowerCase()];
    if (!ModifierClass) {
      throw new Error(`${type} is not a recognized built-in modifier. Here is the list of supported modifiers: ${Object.keys(builtInModifiers).join(', ')}`);
    }

    // recursive: casts & modifiers can be chained
    // e.g. `foo::string:upper`
    return new ModifierClass(parseAttributeSyntaxInternal(remainder));
  }

  // extract $association.attribute$ syntax
  const associationMatch = code.match(/^(\$(?<associationPath>[a-zA-Z0-9_.]+)\$|(?<attribute>[a-zA-Z0-9_.]+))(?:$|(?<remainder>[[.].*))/);
  if (associationMatch === null) {
    throw new Error(`Could not find a valid association or attribute in ${NodeUtil.inspect(code)}.`);
  }

  const associationOrAttributeStr = associationMatch.groups!.associationPath ?? associationMatch.groups!.attribute;
  const associationOrAttribute = parseAssociationPath(associationOrAttributeStr);

  const jsonPath = associationMatch.groups!.remainder;

  if (jsonPath) {
    const [segments, isUnquoteOperator] = parseJsonPathRaw(jsonPath);
    if (segments.length > 0) {
      return new JsonPath(associationOrAttribute, segments, isUnquoteOperator);
    }
  }

  return associationOrAttribute;
}

/**
 * Do not mutate this! It is memoized to avoid re-parsing the same path over and over.
 */
export interface ParsedJsonPropertyKey {
  readonly pathSegments: ReadonlyArray<string | number>;
  readonly shouldUnquote: boolean;
  readonly casts: readonly string[];
}

function parseJsonPropertyKeyInternal(code: string): ParsedJsonPropertyKey {
  const casts: string[] = [];
  let remainder = code;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const castMatch = parseCastAndModifierSyntax(remainder);
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

export function parseJsonPathRaw(code: string): [segments: Array<string | number>, isUnquoteOperator: boolean] {
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

/**
 * Parses cast & unary function syntax.
 *
 * @example
 * // this is a function call. It will result in LOWER(foo)
 * parseCastAndFunctionSyntax('foo:lower') // { type: 'lower', remainder: 'foo', castToken: ':' }
 *
 * // this is a cast. It will result in CAST(foo AS string)
 * parseCastAndFunctionSyntax('foo::string') // { type: 'string', remainder: 'foo', castToken: '::' }
 *
 * @param value
 */
function parseCastAndModifierSyntax(value: string) {
  const castMatch = value.match(/(?<remainder>.*[^:])(?<castToken>:{1,2})(?<type>[a-zA-Z_]+)$/);
  if (!castMatch) {
    return null;
  }

  return castMatch.groups! as { type: string, remainder: string, castToken: string };
}

function parseAssociationPath(syntax: string): AssociationPath | Attribute {
  const path = syntax.split('.');

  if (path.length > 1) {
    const attr = path.pop()!;

    return new AssociationPath(path, attr);
  }

  return new Attribute(syntax);
}
