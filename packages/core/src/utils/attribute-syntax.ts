import memoize from 'lodash/memoize.js';
import type { Class } from 'type-fest';
import { AssociationPath } from '../expression-builders/association-path.js';
import { Attribute } from '../expression-builders/attribute.js';
import { Cast } from '../expression-builders/cast.js';
import type { DialectAwareFn } from '../expression-builders/dialect-aware-fn.js';
import { Unquote } from '../expression-builders/dialect-aware-fn.js';
import { JsonPath } from '../expression-builders/json-path.js';
import { ParseError, type SyntaxNode } from './bnf/shared';
import AttributeParser from './bnf/syntax';
import { noPrototype } from './object.js';

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
export const parseAttributeSyntax = memoize(parseAttributeSyntaxInternal);

/**
 * Parses the syntax supported by nested JSON properties.
 * This is a subset of {@link parseAttributeSyntax}, which does not parse associations, and returns raw data
 * instead of a BaseExpression.
 */
export const parseNestedJsonKeySyntax = memoize(parseJsonPropertyKeyInternal);

/**
 * List of supported attribute modifiers.
 * They can be specified in the attribute syntax, e.g. `foo:upper` will call the `upper` modifier on the `foo` attribute.
 *
 * All names should be lowercase, as they are case-insensitive.
 */
const builtInModifiers: Record<string, Class<DialectAwareFn>> = noPrototype({
  unquote: Unquote,
});

function getModifier(name: string): Class<DialectAwareFn> {
  const ModifierClass = builtInModifiers[name.toLowerCase()];
  if (!ModifierClass) {
    throw new Error(`${name} is not a recognized built-in modifier. Here is the list of supported modifiers: ${Object.keys(builtInModifiers).join(', ')}`);
  }

  return ModifierClass;
}

export interface StringNode<Type extends string> extends SyntaxNode {
  type: Type;
  value: string;
}

function parseAttributeSyntaxInternal(
  code: string,
): Cast | JsonPath | AssociationPath | Attribute | DialectAwareFn {
  // This function is expensive (parsing produces a lot of objects), but we cache the final result, so it's only
  // going to be slow once per attribute.
  const parsed = AttributeParser.Parse_Attribute(code);
  if (parsed instanceof ParseError) {
    throw new TypeError(`Failed to parse syntax of attribute. Parse error at index ${parsed.ref.start.index}:\n${code}\n${' '.repeat(parsed.ref.start.index)}^`);
  }

  if (parsed.isPartial) {
    throw new TypeError(`Failed to parse syntax of attribute. Parse error at index ${parsed.reach?.index || 0}:\n${code}\n${' '.repeat(parsed.reach?.index || 0)}^`);
  }

  const [attributeNode, jsonPathNodeRaw, castOrModifiersNodeRaw] = parsed.root.value;

  let result: Cast | JsonPath | AssociationPath | Attribute | DialectAwareFn = parseAssociationPath(attributeNode);

  const jsonPathNodes = jsonPathNodeRaw.value[0]?.value[0];
  if (jsonPathNodes) {
    result = new JsonPath(
      result,
      jsonPathNodes.value.map(node => parseJsonPathSegment(node)),
    );
  }

  const castOrModifierNodes = castOrModifiersNodeRaw.value[0]?.value[0].value;
  if (castOrModifierNodes) {
    // casts & modifiers can be chained, the last one is applied last
    // foo:upper:lower needs to produce LOWER(UPPER(foo))
    for (const node of castOrModifierNodes) {
      const identifier = node.value[0].value;

      if (node.type === 'cast') {
        result = new Cast(result, identifier);
        continue;
      }

      const ModifierClass = getModifier(identifier);
      result = new ModifierClass(result);
    }
  }

  return result;
}

function parseAssociationPath(syntax: AttributeParser.Term_Attribute_begin): AssociationPath | Attribute {
  const child = syntax.value[0];

  if (child.type === 'literal') {
    return new Attribute(child.value);
  }

  const path = [
    child.value[0].value,
    ...child.value[1].value.map(x => x.value[0].value),
  ];

  const attr = path.pop() as string; // path will be at least 1 long

  return new AssociationPath(path, attr);
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

function parseJsonPropertyKeyInternal(code: string): ParsedJsonPropertyKey {
  const parsed = AttributeParser.Parse_PartialJsonPath(code, true);
  if (parsed instanceof ParseError) {
    throw new TypeError(`Failed to parse syntax of json path. Parse error at index ${parsed.ref.start.index}:\n${code}\n${' '.repeat(parsed.ref.start.index)}^`);
  }

  if (parsed.isPartial) {
    throw new TypeError(`Failed to parse syntax of json path. Parse error at index ${parsed.reach?.index || 0}:\n${code}\n${' '.repeat(parsed.reach?.index || 0)}^`);
  }

  const [firstKey, jsonPathNodeRaw, castOrModifiersNodeRaw] = parsed.root.value;

  const pathSegments: Array<string | number> = [parseJsonPathSegment(firstKey)];

  const jsonPathNodes = jsonPathNodeRaw.value[0]?.value[0].value;
  if (jsonPathNodes) {
    for (const pathNode of jsonPathNodes) {
      pathSegments.push(parseJsonPathSegment(pathNode));
    }
  }

  const castOrModifierNodes = castOrModifiersNodeRaw.value[0]?.value[0].value;
  const castsAndModifiers: Array<string | Class<DialectAwareFn>> = [];

  if (castOrModifierNodes) {
    // casts & modifiers can be chained, the last one is applied last
    // foo:upper:lower needs to produce LOWER(UPPER(foo))
    for (const castOrModifierNode of castOrModifierNodes) {

      if (castOrModifierNode.type === 'cast') {
        castsAndModifiers.push(castOrModifierNode.value[0].value);
        continue;
      }

      const ModifierClass = getModifier(castOrModifierNode.value[0].value);

      castsAndModifiers.push(ModifierClass);
    }
  }

  return { pathSegments, castsAndModifiers };
}

function parseJsonPathSegment(node: AttributeParser.Term_JsonPath_Elm): string | number {
  const child = node.value[0];
  if (child.type === 'indexAccess') {
    return Number(child.value[0].value);
  }

  return child.value[0].value;
}
