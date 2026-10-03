import { pojo } from '@sequelize/utils';
import type { SyntaxNode } from 'bnf-parser';
import { BNF, Compile, ParseError } from 'bnf-parser';
import type { Class } from 'type-fest';
import { AssociationPath } from '../expression-builders/association-path.js';
import { Attribute } from '../expression-builders/attribute.js';
import { Cast } from '../expression-builders/cast.js';
import type { DialectAwareFn } from '../expression-builders/dialect-aware-fn.js';
import { Unquote } from '../expression-builders/dialect-aware-fn.js';
import { JsonPath } from '../expression-builders/json-path.js';

// Defensive upper bound; not derived from workload measurements.
export const ATTRIBUTE_SYNTAX_CACHE_MAX_SIZE = 1000;

type MemoizedParser<T> = ((key: string) => T) & {
  cache: Map<string, T>;
};

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
export const parseAttributeSyntax = memoizeWithBoundedCache(parseAttributeSyntaxInternal);

/**
 * Parses the syntax supported by nested JSON properties.
 * This is a subset of {@link parseAttributeSyntax}, which does not parse associations, and returns raw data
 * instead of a BaseExpression.
 */
export const parseNestedJsonKeySyntax = memoizeWithBoundedCache(parseJsonPropertyKeyInternal);

function memoizeWithBoundedCache<T>(fn: (key: string) => T): MemoizedParser<T> {
  const cache = new Map<string, T>();

  const memoized = (key: string): T => {
    if (cache.has(key)) {
      const result = cache.get(key)!;

      // Reinsert cache hits so untouched entries are evicted first.
      cache.delete(key);
      cache.set(key, result);

      return result;
    }

    const result = fn(key);

    if (cache.size >= ATTRIBUTE_SYNTAX_CACHE_MAX_SIZE) {
      const oldestKey = cache.keys().next().value;

      if (oldestKey !== undefined) {
        cache.delete(oldestKey);
      }
    }

    cache.set(key, result);

    return result;
  };

  return Object.assign(memoized, { cache });
}

/**
 * List of supported attribute modifiers.
 * They can be specified in the attribute syntax, e.g. `foo:upper` will call the `upper` modifier on the `foo` attribute.
 *
 * All names should be lowercase, as they are case-insensitive.
 */
const builtInModifiers: Record<string, Class<DialectAwareFn>> = pojo({
  unquote: Unquote,
});

/**
 * Upper bound (inclusive) for JSON array indexes.
 *
 * Larger indexes are not usable in practice (postgres rejects them with "operator does not exist: jsonb -> bigint",
 * mysql rejects the path, mariadb silently wraps around at 2^32), and above Number.MAX_SAFE_INTEGER
 * the parsed value would silently lose precision.
 */
export const MAX_JSON_ARRAY_INDEX = 2_147_483_647;

/**
 * The characters that cannot be used in the name of a model attribute, because they have a special meaning
 * in the attribute syntax (the syntax of keys in WHERE POJOs and of {@link @sequelize/core!sql.attribute}):
 *
 * - `$` delimits associations (`$association.attribute$`),
 * - `.` accesses nested JSON keys (`json.key`),
 * - `:` introduces casts & modifiers (`attribute::cast`, `attribute:unquote`),
 * - `[` and `]` access array indexes (`json[0]`).
 *
 * Control characters (U+0000 to U+001F, and U+007F) are reserved too, see {@link isReservedAttributeNameCharacter}.
 *
 * This is the only restriction: any other character (dashes, spaces, quotes, non-ASCII characters...) is accepted,
 * because attribute names are always quoted in the generated SQL.
 *
 * The parser's `identifier` rule and {@link findReservedAttributeNameCharacter} must always agree.
 */
export const RESERVED_ATTRIBUTE_NAME_CHARACTERS: ReadonlySet<string> = new Set([
  '$',
  '.',
  ':',
  '[',
  ']',
]);

// Control characters are expressed as a range in the grammar; the grammar operates on UTF-16 code units.
const CONTROL_CHARACTERS_START = '\u0000';
const CONTROL_CHARACTERS_END = '\u001F';
const DELETE_CHARACTER = '\u007F';

/**
 * Whether a single UTF-16 code unit is reserved in attribute names.
 * See {@link RESERVED_ATTRIBUTE_NAME_CHARACTERS}.
 *
 * @param char A single UTF-16 code unit.
 */
export function isReservedAttributeNameCharacter(char: string): boolean {
  return (
    RESERVED_ATTRIBUTE_NAME_CHARACTERS.has(char) ||
    (char >= CONTROL_CHARACTERS_START && char <= CONTROL_CHARACTERS_END) ||
    char === DELETE_CHARACTER
  );
}

/**
 * Returns the first reserved character found in an attribute name, or null if the name does not contain any.
 * See {@link RESERVED_ATTRIBUTE_NAME_CHARACTERS}.
 *
 * @param attributeName The attribute name to check.
 */
export function findReservedAttributeNameCharacter(attributeName: string): string | null {
  for (const char of attributeName) {
    if (isReservedAttributeNameCharacter(char)) {
      return char;
    }
  }

  return null;
}

/**
 * Formats a reserved character for use in an error message: printable characters are quoted,
 * control characters are displayed using their unicode code point.
 *
 * @param char The reserved character, as returned by {@link findReservedAttributeNameCharacter}.
 */
export function describeReservedAttributeNameCharacter(char: string): string {
  if (RESERVED_ATTRIBUTE_NAME_CHARACTERS.has(char)) {
    return JSON.stringify(char);
  }

  const codePoint = char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0');

  return `U+${codePoint} (control character)`;
}

type SyntaxKind = 'attribute' | 'json path';

function createParseError(
  kind: SyntaxKind,
  code: string,
  index: number,
  reason?: string,
): TypeError {
  // The input is displayed escaped (as a JSON string), so that newlines and other control characters
  // do not break the caret line. The caret position must be computed on the escaped prefix, which can be
  // longer than the raw prefix when it contains characters that need escaping.
  // `- 1` skips the closing quote added by JSON.stringify.
  const caretColumn = JSON.stringify(code.slice(0, index)).length - 1;

  return new TypeError(`Failed to parse syntax of ${kind}. Parse error at index ${index}${reason ? ` (${reason})` : ''}:
${JSON.stringify(code)}
${' '.repeat(caretColumn)}^`);
}

function getModifier(name: string, kind: SyntaxKind, code: string): Class<DialectAwareFn> {
  const ModifierClass = builtInModifiers[name.toLowerCase()];
  if (!ModifierClass) {
    throw new TypeError(
      `Failed to parse syntax of ${kind}. ${JSON.stringify(code)}: "${name}" is not a recognized built-in modifier. Here is the list of supported modifiers: ${Object.keys(builtInModifiers).join(', ')}`,
    );
  }

  return ModifierClass;
}

const attributeParser = (() => {
  const advancedAttributeBnf = `
    # Entry points

    ## Used when parsing the attribute
    attribute ::= ( ...association | ...identifier ) jsonPath? castOrModifiers?;

    ## Used when parsing a nested JSON path used inside of an attribute
    ## Difference with "attribute" is in the first part. Instead of accepting:
    ##  $association.attribute$ & attribute
    ## It accepts:
    ##  key, "quotedKey", and [0] (index access)
    partialJsonPath ::= ( ...indexAccess | ...key ) jsonPath? castOrModifiers? ;

    # Internals

    ## An identifier (attribute or association name) is any non-empty sequence of characters
    ## that are not reserved by this syntax (see RESERVED_ATTRIBUTE_NAME_CHARACTERS).
    ## Identifiers are always quoted in the generated SQL, so they are not restricted any further.
    ## The same set of characters is rejected in model attribute names by ModelDefinition.
    identifier ::= !( "$" | "." | ":" | "[" | "]" | "${CONTROL_CHARACTERS_START}"->"${CONTROL_CHARACTERS_END}" | "${DELETE_CHARACTER}" )+ ;
    digit ::= "0"->"9" ;
    number ::= ...digit+ ;
    association ::= %"$" identifier ("." identifier)* %"$" ;
    jsonPath ::= ( ...indexAccess | ...keyAccess )+ ;
    indexAccess ::= %"[" number %"]" ;
    keyAccess ::= %"." key ;
    # path segments accept dashes without needing to be quoted
    key ::= quotedString | ( "A"->"Z" | "a"->"z" | digit | "_" | "-" )+ ;
    ## the empty key ("") is a valid JSON object key, so quoted strings may be empty
    quotedString ::= ...(%"\\"" (anyExceptQuoteOrBackslash | escapedCharacter)* %"\\"") ;
    escapedCharacter ::= %"\\\\" ( "\\"" | "\\\\" );
    anyExceptQuoteOrBackslash ::= !("\\"" | "\\\\");
    castOrModifiers ::= (...cast | ...modifier)+;
    cast ::= %"::" castOrModifierName ;
    modifier ::= %":" castOrModifierName ;
    ## The cast type is inserted verbatim in the generated SQL, so this rule is what prevents SQL injection
    ## through the attribute syntax. Do not widen it without adding a validation step.
    ## Unlike attribute identifiers, a cast type or modifier name cannot start with a digit.
    castOrModifierName ::= ( "A"->"Z" | "a"->"z" | "_" ) ( "A"->"Z" | "a"->"z" | digit | "_" )* ;
  `;

  const parsedAttributeBnf = BNF.parse(advancedAttributeBnf);
  if (parsedAttributeBnf instanceof ParseError) {
    throw new Error(
      `Failed to initialize attribute syntax parser. This is a Sequelize bug: ${parsedAttributeBnf.toString()}`,
    );
  }

  return Compile(parsedAttributeBnf);
})();

interface UselessNode<Type extends string, WrappedValue extends SyntaxNode[]> extends SyntaxNode {
  type: Type;
  value: WrappedValue;
}

export interface StringNode<Type extends string> extends SyntaxNode {
  type: Type;
  value: string;
}

interface AttributeAst extends SyntaxNode {
  type: 'attribute';
  value: [
    attribute: StringNode<'association' | 'identifier'>,
    jsonPath: UselessNode<
      'jsonPath?',
      [
        UselessNode<
          'jsonPath',
          [UselessNode<'(...)+', Array<StringNode<'keyAccess' | 'indexAccess'>>>]
        >,
      ]
    >,
    castOrModifiers: UselessNode<
      'castOrModifiers?',
      [
        UselessNode<
          'castOrModifiers',
          [UselessNode<'(...)+', Array<StringNode<'cast' | 'modifier'>>>]
        >,
      ]
    >,
  ];
}

function parseAttributeSyntaxInternal(
  code: string,
): Cast | JsonPath | AssociationPath | Attribute | DialectAwareFn {
  // This function is expensive (parsing produces a lot of objects), but we cache the final result, so it's only
  // going to be slow once per attribute.
  const parsed = attributeParser.parse(code, false, 'attribute') as AttributeAst | ParseError;
  if (parsed instanceof ParseError) {
    throw createParseError('attribute', code, parsed.ref.start.index);
  }

  const [attributeNode, jsonPathNodeRaw, castOrModifiersNodeRaw] = parsed.value;

  let result: Cast | JsonPath | AssociationPath | Attribute | DialectAwareFn = parseAssociationPath(
    attributeNode.value,
  );

  const jsonPathNodes = jsonPathNodeRaw.value[0]?.value[0].value;
  if (jsonPathNodes) {
    const path = jsonPathNodes.map(pathNode => {
      return parseJsonPathSegment(pathNode, 'attribute', code);
    });

    result = new JsonPath(result, path);
  }

  const castOrModifierNodes = castOrModifiersNodeRaw.value[0]?.value[0].value;
  if (castOrModifierNodes) {
    // casts & modifiers can be chained, the last one is applied last
    // foo:upper:lower needs to produce LOWER(UPPER(foo))
    for (const castOrModifierNode of castOrModifierNodes) {
      if (castOrModifierNode.type === 'cast') {
        result = new Cast(result, castOrModifierNode.value);
        continue;
      }

      const ModifierClass = getModifier(castOrModifierNode.value, 'attribute', code);

      result = new ModifierClass(result);
    }
  }

  return result;
}

function parseAssociationPath(syntax: string): AssociationPath | Attribute {
  const path = syntax.split('.');

  if (path.length > 1) {
    const attr = path.pop()!;

    return new AssociationPath(path, attr);
  }

  return new Attribute(syntax);
}

/**
 * Do not mutate this! It is memoized to avoid re-parsing the same path over and over.
 */
export interface ParsedJsonPropertyKey {
  readonly pathSegments: ReadonlyArray<string | number>;
  /**
   * If it's a string, it's a cast. If it's a class, it's a modifier.
   */
  readonly castsAndModifiers: ReadonlyArray<string | Class<DialectAwareFn>>;
}

interface JsonPathAst extends SyntaxNode {
  type: 'partialJsonPath';
  value: [
    firstKey: StringNode<'key' | 'indexAccess'>,
    jsonPath: UselessNode<
      'jsonPath?',
      [
        UselessNode<
          'jsonPath',
          [UselessNode<'(...)+', Array<StringNode<'keyAccess' | 'indexAccess'>>>]
        >,
      ]
    >,
    castOrModifiers: UselessNode<
      'castOrModifiers?',
      [
        UselessNode<
          'castOrModifiers',
          [UselessNode<'(...)+', Array<StringNode<'cast' | 'modifier'>>>]
        >,
      ]
    >,
  ];
}

function parseJsonPropertyKeyInternal(code: string): ParsedJsonPropertyKey {
  const parsed = attributeParser.parse(code, false, 'partialJsonPath') as JsonPathAst | ParseError;
  if (parsed instanceof ParseError) {
    throw createParseError('json path', code, parsed.ref.start.index);
  }

  const [firstKey, jsonPathNodeRaw, castOrModifiersNodeRaw] = parsed.value;

  const pathSegments: Array<string | number> = [parseJsonPathSegment(firstKey, 'json path', code)];

  const jsonPathNodes = jsonPathNodeRaw.value[0]?.value[0].value;
  if (jsonPathNodes) {
    for (const pathNode of jsonPathNodes) {
      pathSegments.push(parseJsonPathSegment(pathNode, 'json path', code));
    }
  }

  const castOrModifierNodes = castOrModifiersNodeRaw.value[0]?.value[0].value;
  const castsAndModifiers: Array<string | Class<DialectAwareFn>> = [];

  if (castOrModifierNodes) {
    // casts & modifiers can be chained, the last one is applied last
    // foo:upper:lower needs to produce LOWER(UPPER(foo))
    for (const castOrModifierNode of castOrModifierNodes) {
      if (castOrModifierNode.type === 'cast') {
        castsAndModifiers.push(castOrModifierNode.value);
        continue;
      }

      const ModifierClass = getModifier(castOrModifierNode.value, 'json path', code);

      castsAndModifiers.push(ModifierClass);
    }
  }

  return { pathSegments, castsAndModifiers };
}

function parseJsonPathSegment(
  node: StringNode<string>,
  kind: SyntaxKind,
  code: string,
): string | number {
  if (node.type === 'indexAccess') {
    const index = Number(node.value);
    if (index > MAX_JSON_ARRAY_INDEX) {
      throw createParseError(
        kind,
        code,
        node.ref.start.index,
        `JSON array index must not exceed ${MAX_JSON_ARRAY_INDEX}`,
      );
    }

    return index;
  }

  return node.value;
}
