import { pojo } from '@sequelize/utils';
import type { SyntaxNode } from 'bnf-parser';
import { BNF, Compile, ParseError } from 'bnf-parser';
import memoize from 'lodash/memoize.js';
import type { Class } from 'type-fest';
import { AssociationPath } from '../expression-builders/association-path.js';
import { Attribute } from '../expression-builders/attribute.js';
import { Cast } from '../expression-builders/cast.js';
import type { DialectAwareFn } from '../expression-builders/dialect-aware-fn.js';
import { Unquote } from '../expression-builders/dialect-aware-fn.js';
import { JsonPath } from '../expression-builders/json-path.js';

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
const builtInModifiers: Record<string, Class<DialectAwareFn>> = pojo({
  unquote: Unquote,
});

function getModifier(name: string): Class<DialectAwareFn> {
  const ModifierClass = builtInModifiers[name.toLowerCase()];
  if (!ModifierClass) {
    throw new Error(
      `${name} is not a recognized built-in modifier. Here is the list of supported modifiers: ${Object.keys(builtInModifiers).join(', ')}`,
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

    identifier ::= ( "A"->"Z" | "a"->"z" | digit | "_" )+ ;
    digit ::= "0"->"9" ;
    number ::= ...digit+ ;
    association ::= %"$" identifier ("." identifier)* %"$" ;
    jsonPath ::= ( ...indexAccess | ...keyAccess )+ ;
    indexAccess ::= %"[" number %"]" ;
    keyAccess ::= %"." key ;
    # path segments accept dashes without needing to be quoted
    key ::= nonEmptyString | ( "A"->"Z" | "a"->"z" | digit | "_" | "-" )+ ;
    nonEmptyString ::= ...(%"\\"" (anyExceptQuoteOrBackslash | escapedCharacter)+ %"\\"") ;
    escapedCharacter ::= %"\\\\" ( "\\"" | "\\\\" );
    any ::= !"" ;
    anyExceptQuoteOrBackslash ::= !("\\"" | "\\\\");
    castOrModifiers ::= (...cast | ...modifier)+;
    cast ::= %"::" identifier ;
    modifier ::= %":" identifier ;
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
    throw new TypeError(`Failed to parse syntax of attribute. Parse error at index ${parsed.ref.start.index}:
${code}
${' '.repeat(parsed.ref.start.index)}^`);
  }

  const [attributeNode, jsonPathNodeRaw, castOrModifiersNodeRaw] = parsed.value;

  let result: Cast | JsonPath | AssociationPath | Attribute | DialectAwareFn = parseAssociationPath(
    attributeNode.value,
  );

  const jsonPathNodes = jsonPathNodeRaw.value[0]?.value[0].value;
  if (jsonPathNodes) {
    const path = jsonPathNodes.map(pathNode => {
      return parseJsonPathSegment(pathNode);
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

      const ModifierClass = getModifier(castOrModifierNode.value);

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
    throw new TypeError(`Failed to parse syntax of json path. Parse error at index ${parsed.ref.start.index}:
${code}
${' '.repeat(parsed.ref.start.index)}^`);
  }

  const [firstKey, jsonPathNodeRaw, castOrModifiersNodeRaw] = parsed.value;

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
        castsAndModifiers.push(castOrModifierNode.value);
        continue;
      }

      const ModifierClass = getModifier(castOrModifierNode.value);

      castsAndModifiers.push(ModifierClass);
    }
  }

  return { pathSegments, castsAndModifiers };
}

function parseJsonPathSegment(node: StringNode<string>): string | number {
  if (node.type === 'indexAccess') {
    return Number(node.value);
  }

  return node.value;
}
