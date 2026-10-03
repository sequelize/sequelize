import { AssociationPath, Attribute, sql } from '@sequelize/core';
import type { DialectAwareFn } from '@sequelize/core/_non-semver-use-at-your-own-risk_/expression-builders/dialect-aware-fn.js';
import { Unquote } from '@sequelize/core/_non-semver-use-at-your-own-risk_/expression-builders/dialect-aware-fn.js';
import {
  ATTRIBUTE_SYNTAX_CACHE_MAX_SIZE,
  MAX_JSON_ARRAY_INDEX,
  parseAttributeSyntax,
  parseNestedJsonKeySyntax,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/attribute-syntax.js';
import { expect } from 'chai';
import type { Class } from 'type-fest';
// registers the "throwWithCause" chai assertion
import '../../support';

type SyntaxKind = 'attribute' | 'json path';

/**
 * Builds the exact error message produced by the parser when it rejects an input.
 * The parser prints the input (escaped as a JSON string) on its own line, followed by a caret pointing at the offending index.
 *
 * @param kind Which entry point produced the error.
 * @param input The input that was rejected.
 * @param index The index at which the parser stopped.
 * @param reason Optional reason appended to the first line.
 */
function parseErrorMessage(
  kind: SyntaxKind,
  input: string,
  index: number,
  reason?: string,
): string {
  const caretColumn = JSON.stringify(input.slice(0, index)).length - 1;

  return `Failed to parse syntax of ${kind}. Parse error at index ${index}${reason ? ` (${reason})` : ''}:
${JSON.stringify(input)}
${' '.repeat(caretColumn)}^`;
}

const INDEX_TOO_LARGE = `JSON array index must not exceed ${MAX_JSON_ARRAY_INDEX}`;

const unknownModifierMessage = (kind: SyntaxKind, input: string, name: string) =>
  `Failed to parse syntax of ${kind}. ${JSON.stringify(input)}: "${name}" is not a recognized built-in modifier. Here is the list of supported modifiers: unquote`;

describe('parseAttributeSyntax', () => {
  beforeEach(() => parseAttributeSyntax.cache.clear());
  afterEach(() => parseAttributeSyntax.cache.clear());

  describe('attributes & associations', () => {
    const cases: Array<{ input: string; expected: Attribute | AssociationPath }> = [
      { input: 'foo', expected: new Attribute('foo') },
      { input: 'FOO', expected: new Attribute('FOO') },
      { input: 'foo123', expected: new Attribute('foo123') },
      { input: '_foo', expected: new Attribute('_foo') },
      { input: 'a_b_c', expected: new Attribute('a_b_c') },
      { input: '_', expected: new Attribute('_') },
      // a single-segment association degrades to a plain attribute
      { input: '$bar$', expected: new Attribute('bar') },
      { input: '$foo.bar$', expected: new AssociationPath(['foo'], 'bar') },
      { input: '$A.B$', expected: new AssociationPath(['A'], 'B') },
      { input: '$foo1.bar_2$', expected: new AssociationPath(['foo1'], 'bar_2') },
      { input: '$foo.zzz.bar$', expected: new AssociationPath(['foo', 'zzz'], 'bar') },
      { input: '$a.b.c.d$', expected: new AssociationPath(['a', 'b', 'c'], 'd') },
      { input: '$a.b.c.d.e$', expected: new AssociationPath(['a', 'b', 'c', 'd'], 'e') },
    ];

    for (const { input, expected } of cases) {
      it(`parses ${JSON.stringify(input)}`, () => {
        expect(parseAttributeSyntax(input)).to.deep.eq(expected);
      });
    }

    it('accepts identifiers made of digits only', () => {
      // Intended: identifiers are always quoted in the generated SQL, so there is no reason to restrict their first character.
      expect(parseAttributeSyntax('123')).to.deep.eq(new Attribute('123'));
      expect(parseAttributeSyntax('$1.2$')).to.deep.eq(new AssociationPath(['1'], '2'));
    });
  });

  describe('non-reserved characters in identifiers', () => {
    // Identifiers accept any character except the ones reserved by the syntax ($ . : [ ] and control characters),
    // because the identifier is always quoted in the generated SQL (the quoting doubles the delimiter).
    // This mirrors the validation of attribute names in ModelDefinition: every name a model can declare
    // must be usable as a WHERE key.
    // The parser does not know about SQL: it is the responsibility of quoteIdentifier to neutralize these characters.
    const identifiers: Array<{ identifier: string; reason: string }> = [
      { identifier: 'café', reason: 'non-ASCII letter' },
      { identifier: 'Ünïcödé', reason: 'non-ASCII letters (mixed case)' },
      { identifier: '日本', reason: 'CJK characters' },
      { identifier: '名前', reason: 'CJK characters (2)' },
      { identifier: 'имя', reason: 'cyrillic characters' },
      { identifier: '😀', reason: 'emoji (astral plane, two UTF-16 code units)' },
      { identifier: 'a😀b', reason: 'emoji inside identifier' },
      { identifier: 'first-name', reason: 'dash' },
      { identifier: '-a', reason: 'leading dash' },
      { identifier: 'a-', reason: 'trailing dash' },
      { identifier: '-', reason: 'dash only' },
      { identifier: 'a b', reason: 'space' },
      { identifier: ' foo', reason: 'leading space' },
      { identifier: 'foo ', reason: 'trailing space' },
      { identifier: '   ', reason: 'spaces only' },
      { identifier: 'a b', reason: 'non-breaking space' },
      { identifier: 'a"b', reason: 'double quote' },
      { identifier: '"foo"', reason: 'wrapped in double quotes' },
      { identifier: "a'b", reason: 'single quote' },
      { identifier: 'a`b', reason: 'backtick' },
      { identifier: '`foo`', reason: 'wrapped in backticks' },
      { identifier: 'a\\b', reason: 'backslash' },
      { identifier: 'foo\\', reason: 'trailing backslash' },
      { identifier: 'a;b', reason: 'semicolon' },
      { identifier: 'a--b', reason: 'SQL line comment' },
      { identifier: 'a/*b*/', reason: 'SQL block comment' },
      { identifier: "a'; DROP TABLE users; --", reason: 'SQL injection attempt' },
      { identifier: 'a=b', reason: 'equals sign' },
      { identifier: '(a)', reason: 'parentheses' },
      { identifier: '{a}', reason: 'curly braces' },
      { identifier: 'a,b', reason: 'comma' },
      { identifier: 'a|b', reason: 'pipe' },
      { identifier: 'a#b', reason: 'hash' },
      { identifier: 'a%b', reason: 'percent' },
      { identifier: 'a?b', reason: 'question mark' },
      { identifier: 'a@b', reason: 'at sign' },
      { identifier: 'a/b', reason: 'slash' },
      { identifier: 'a<b>', reason: 'angle brackets' },
      { identifier: 'a~b', reason: 'tilde' },
      { identifier: 'a^b', reason: 'caret' },
      { identifier: 'a&b', reason: 'ampersand' },
      { identifier: 'a*b', reason: 'asterisk' },
      { identifier: 'a+b', reason: 'plus' },
      { identifier: 'a!b', reason: 'exclamation mark' },
      // "->" is rejected by ModelDefinition (it is used in the SQL generated for nested includes),
      // but it has no meaning in the attribute syntax itself
      { identifier: 'a->b', reason: 'arrow' },
    ];

    for (const { identifier, reason } of identifiers) {
      it(`parses ${JSON.stringify(identifier)} as an attribute (${reason})`, () => {
        expect(parseAttributeSyntax(identifier)).to.deep.eq(new Attribute(identifier));
      });

      it(`parses ${JSON.stringify(`$${identifier}$`)} as an attribute (${reason})`, () => {
        expect(parseAttributeSyntax(`$${identifier}$`)).to.deep.eq(new Attribute(identifier));
      });

      it(`parses ${JSON.stringify(`$${identifier}.${identifier}$`)} as an association path (${reason})`, () => {
        expect(parseAttributeSyntax(`$${identifier}.${identifier}$`)).to.deep.eq(
          new AssociationPath([identifier], identifier),
        );
      });

      it(`parses ${JSON.stringify(`$${identifier}.attr$`)} as an association path (${reason})`, () => {
        expect(parseAttributeSyntax(`$${identifier}.attr$`)).to.deep.eq(
          new AssociationPath([identifier], 'attr'),
        );
      });

      it(`parses ${JSON.stringify(`$assoc.${identifier}$`)} as an association path (${reason})`, () => {
        expect(parseAttributeSyntax(`$assoc.${identifier}$`)).to.deep.eq(
          new AssociationPath(['assoc'], identifier),
        );
      });
    }

    const combinedCases: Array<{ input: string; expected: unknown }> = [
      { input: '$café.first-name$', expected: new AssociationPath(['café'], 'first-name') },
      { input: '$a b.c d.e f$', expected: new AssociationPath(['a b', 'c d'], 'e f') },
      { input: '$日本.名前$', expected: new AssociationPath(['日本'], '名前') },
      {
        input: '$a"b.c\'d.e`f$',
        expected: new AssociationPath(['a"b', "c'd"], 'e`f'),
      },
      // json paths, casts & modifiers still apply to these identifiers
      { input: 'café.bar', expected: sql.jsonPath(new Attribute('café'), ['bar']) },
      { input: 'first-name.bar', expected: sql.jsonPath(new Attribute('first-name'), ['bar']) },
      { input: 'a b[0]', expected: sql.jsonPath(new Attribute('a b'), [0]) },
      { input: 'a"b::int', expected: sql.cast(new Attribute('a"b'), 'int') },
      { input: 'a`b:unquote', expected: sql.unquote(new Attribute('a`b')) },
      {
        input: '$café.first-name$.bar::int',
        expected: sql.cast(
          sql.jsonPath(new AssociationPath(['café'], 'first-name'), ['bar']),
          'int',
        ),
      },
      // the space & backslash are part of the identifier, the dot still starts a json path
      { input: 'foo .a', expected: sql.jsonPath(new Attribute('foo '), ['a']) },
      { input: 'foo\\.bar', expected: sql.jsonPath(new Attribute('foo\\'), ['bar']) },
      // the identifier stops at the first reserved character
      { input: 'a-b.c-d', expected: sql.jsonPath(new Attribute('a-b'), ['c-d']) },
      { input: 'a b.c', expected: sql.jsonPath(new Attribute('a b'), ['c']) },
      { input: '"a".b', expected: sql.jsonPath(new Attribute('"a"'), ['b']) },
      { input: '"a"::int', expected: sql.cast(new Attribute('"a"'), 'int') },
      // a single-segment association made of a non-ASCII identifier degrades to a plain attribute
      { input: '$café$.bar', expected: sql.jsonPath(new Attribute('café'), ['bar']) },
    ];

    for (const { input, expected } of combinedCases) {
      it(`parses ${JSON.stringify(input)}`, () => {
        expect(parseAttributeSyntax(input)).to.deep.eq(expected);
      });
    }

    it('does not widen the alphabet of unquoted JSON keys', () => {
      // The alphabet of unquoted keys is unchanged: keys containing other characters must be quoted.
      expect(() => parseAttributeSyntax('foo.bär')).to.throwWithCause(
        TypeError,
        parseErrorMessage('attribute', 'foo.bär', 5),
      );
      expect(() => parseAttributeSyntax('foo.a b')).to.throwWithCause(
        TypeError,
        parseErrorMessage('attribute', 'foo.a b', 5),
      );
      expect(parseAttributeSyntax('foo."bär"')).to.deep.eq(
        sql.jsonPath(new Attribute('foo'), ['bär']),
      );
    });

    it('does not widen the alphabet of cast types & modifier names', () => {
      // The cast type is inserted verbatim in the generated SQL, so it must stay restricted.
      expect(() => parseAttributeSyntax('foo::café')).to.throwWithCause(
        TypeError,
        parseErrorMessage('attribute', 'foo::café', 8),
      );
      expect(() => parseAttributeSyntax('foo::a b')).to.throwWithCause(
        TypeError,
        parseErrorMessage('attribute', 'foo::a b', 6),
      );
      expect(() => parseAttributeSyntax('foo::a"b')).to.throwWithCause(
        TypeError,
        parseErrorMessage('attribute', 'foo::a"b', 6),
      );
      expect(() => parseAttributeSyntax("foo::int'; DROP TABLE users; --")).to.throwWithCause(
        TypeError,
        parseErrorMessage('attribute', "foo::int'; DROP TABLE users; --", 8),
      );
      expect(() => parseAttributeSyntax('foo:café')).to.throwWithCause(
        TypeError,
        parseErrorMessage('attribute', 'foo:café', 7),
      );
    });
  });

  describe('casts & modifiers', () => {
    const cases: Array<{ input: string; expected: unknown }> = [
      { input: 'foo::bar', expected: sql.cast(new Attribute('foo'), 'bar') },
      // cast types are kept verbatim (case preserved)
      { input: 'foo::Int', expected: sql.cast(new Attribute('foo'), 'Int') },
      { input: 'foo::INT', expected: sql.cast(new Attribute('foo'), 'INT') },
      { input: 'foo::my_type1', expected: sql.cast(new Attribute('foo'), 'my_type1') },
      {
        input: 'foo::bar::baz',
        expected: sql.cast(sql.cast(new Attribute('foo'), 'bar'), 'baz'),
      },
      { input: 'foo:unquote', expected: sql.unquote(new Attribute('foo')) },
      // modifier names are case-insensitive
      { input: 'foo:UNQUOTE', expected: sql.unquote(new Attribute('foo')) },
      { input: 'foo:UnQuote', expected: sql.unquote(new Attribute('foo')) },
      {
        input: 'foo:unquote:unquote',
        expected: sql.unquote(sql.unquote(new Attribute('foo'))),
      },
      {
        input: 'foo:unquote:UNQUOTE',
        expected: sql.unquote(sql.unquote(new Attribute('foo'))),
      },
      // the first cast/modifier is applied first (innermost), the last is applied last (outermost)
      {
        input: 'foo:unquote::text',
        expected: sql.cast(sql.unquote(new Attribute('foo')), 'text'),
      },
      {
        input: 'foo::text:unquote',
        expected: sql.unquote(sql.cast(new Attribute('foo'), 'text')),
      },
      {
        input: 'textAttr::json:unquote::integer',
        expected: sql.cast(sql.unquote(sql.cast(new Attribute('textAttr'), 'json')), 'integer'),
      },
      {
        input: 'foo::int:UNQUOTE::text',
        expected: sql.cast(sql.unquote(sql.cast(new Attribute('foo'), 'int')), 'text'),
      },
      // associations can be cast/modified too
      {
        input: '$a.b$::int',
        expected: sql.cast(new AssociationPath(['a'], 'b'), 'int'),
      },
      {
        input: '$a.b$:unquote',
        expected: sql.unquote(new AssociationPath(['a'], 'b')),
      },
    ];

    for (const { input, expected } of cases) {
      it(`parses ${JSON.stringify(input)}`, () => {
        expect(parseAttributeSyntax(input)).to.deep.eq(expected);
      });
    }

    it('accepts cast types that start with an underscore', () => {
      // The cast type is inserted verbatim in the generated SQL, which is why it is restricted to [A-Za-z_][A-Za-z0-9_]*.
      // Digits & underscores are allowed after the first character.
      expect(parseAttributeSyntax('foo::_')).to.deep.eq(sql.cast(new Attribute('foo'), '_'));
      expect(parseAttributeSyntax('foo::_1')).to.deep.eq(sql.cast(new Attribute('foo'), '_1'));
      expect(parseAttributeSyntax('foo::a1')).to.deep.eq(sql.cast(new Attribute('foo'), 'a1'));
    });

    it('throws for unknown modifiers, listing the supported ones', () => {
      expect(() => parseAttributeSyntax('foo:nope')).to.throwWithCause(
        TypeError,
        unknownModifierMessage('attribute', 'foo:nope', 'nope'),
      );

      // the modifier name is reported using its original casing
      expect(() => parseAttributeSyntax('foo:NoPe')).to.throwWithCause(
        TypeError,
        unknownModifierMessage('attribute', 'foo:NoPe', 'NoPe'),
      );

      // the unknown modifier is detected regardless of its position in the chain
      expect(() => parseAttributeSyntax('foo::int:nope')).to.throwWithCause(
        TypeError,
        unknownModifierMessage('attribute', 'foo::int:nope', 'nope'),
      );
      expect(() => parseAttributeSyntax('foo:nope::int')).to.throwWithCause(
        TypeError,
        unknownModifierMessage('attribute', 'foo:nope::int', 'nope'),
      );
    });

    it('treats a colon inside an identifier as the start of a modifier', () => {
      // ":" is reserved: "a:b" is the attribute "a" with the modifier "b", which does not exist.
      // This is why ModelDefinition rejects attribute names containing ":".
      expect(() => parseAttributeSyntax('a:b')).to.throwWithCause(
        TypeError,
        unknownModifierMessage('attribute', 'a:b', 'b'),
      );
      expect(() => parseAttributeSyntax('first:name')).to.throwWithCause(
        TypeError,
        unknownModifierMessage('attribute', 'first:name', 'name'),
      );
      expect(() => parseAttributeSyntax('$user.first:name$')).to.throwWithCause(
        TypeError,
        parseErrorMessage('attribute', '$user.first:name$', 11),
      );

      // "a::b" is the attribute "a" cast to the type "b"
      expect(parseAttributeSyntax('a::b')).to.deep.eq(sql.cast(new Attribute('a'), 'b'));
    });

    it('treats everything after ::/: as a cast/modifier', () => {
      // "json.property" is treated as a cast, not a JSON path
      // but it's not a valid cast, so it will throw
      expect(() => parseAttributeSyntax('textAttr::json.property')).to.throwWithCause(
        TypeError,
        parseErrorMessage('attribute', 'textAttr::json.property', 14),
      );

      // "json.property" is treated as a modifier (which does not exist and will throw), not a JSON path
      expect(() => parseAttributeSyntax('textAttr:json.property')).to.throwWithCause(
        TypeError,
        parseErrorMessage('attribute', 'textAttr:json.property', 13),
      );
    });
  });

  describe('JSON paths', () => {
    const foo = new Attribute('foo');

    const cases: Array<{ input: string; expected: unknown }> = [
      // dot keys
      { input: 'foo.bar', expected: sql.jsonPath(foo, ['bar']) },
      { input: 'foo.bar.baz', expected: sql.jsonPath(foo, ['bar', 'baz']) },
      { input: 'foo.a.b.c.d.e', expected: sql.jsonPath(foo, ['a', 'b', 'c', 'd', 'e']) },
      { input: 'foo.BAR', expected: sql.jsonPath(foo, ['BAR']) },
      { input: 'foo._bar1', expected: sql.jsonPath(foo, ['_bar1']) },
      // digits-only dot keys stay strings (they are object keys, not array indexes)
      { input: 'foo.0', expected: sql.jsonPath(foo, ['0']) },
      { input: 'foo.123', expected: sql.jsonPath(foo, ['123']) },
      // dashes are allowed in unquoted keys (but not in identifiers or associations)
      { input: 'foo.a-b', expected: sql.jsonPath(foo, ['a-b']) },
      { input: 'foo.a-b-c', expected: sql.jsonPath(foo, ['a-b-c']) },
      { input: 'foo.-a', expected: sql.jsonPath(foo, ['-a']) },
      { input: 'foo.a-', expected: sql.jsonPath(foo, ['a-']) },
      { input: 'foo.a-1', expected: sql.jsonPath(foo, ['a-1']) },
      { input: 'foo.1-a', expected: sql.jsonPath(foo, ['1-a']) },

      // quoted keys
      { input: 'foo."bar"', expected: sql.jsonPath(foo, ['bar']) },
      { input: 'foo."a"."b"', expected: sql.jsonPath(foo, ['a', 'b']) },
      { input: 'foo."a".b', expected: sql.jsonPath(foo, ['a', 'b']) },
      { input: 'foo.a."b"', expected: sql.jsonPath(foo, ['a', 'b']) },
      // digits-only quoted keys stay strings
      { input: 'foo."123"', expected: sql.jsonPath(foo, ['123']) },
      // quoted keys may contain characters that are otherwise meaningful
      { input: 'foo."a.b"', expected: sql.jsonPath(foo, ['a.b']) },
      { input: 'foo."."', expected: sql.jsonPath(foo, ['.']) },
      { input: 'foo."a[0]"', expected: sql.jsonPath(foo, ['a[0]']) },
      { input: 'foo."a:b"', expected: sql.jsonPath(foo, ['a:b']) },
      { input: 'foo."a::b"', expected: sql.jsonPath(foo, ['a::b']) },
      { input: 'foo."a$b"', expected: sql.jsonPath(foo, ['a$b']) },
      { input: 'foo."$a.b$"', expected: sql.jsonPath(foo, ['$a.b$']) },
      { input: 'foo."a b"', expected: sql.jsonPath(foo, ['a b']) },
      { input: 'foo."-"', expected: sql.jsonPath(foo, ['-']) },
      // non-ASCII & control characters are accepted inside quotes
      { input: 'foo."bär"', expected: sql.jsonPath(foo, ['bär']) },
      { input: 'foo."日本"', expected: sql.jsonPath(foo, ['日本']) },
      { input: 'foo."b\nc"', expected: sql.jsonPath(foo, ['b\nc']) },
      { input: 'foo."a b\tc"', expected: sql.jsonPath(foo, ['a b\tc']) },
      // escape sequences: \" and \\ are the only two supported
      { input: 'foo."bar\\""', expected: sql.jsonPath(foo, ['bar"']) },
      { input: 'foo."bar\\\\"', expected: sql.jsonPath(foo, ['bar\\']) },
      { input: 'foo."\\"\\""', expected: sql.jsonPath(foo, ['""']) },
      // the empty string is a valid JSON object key
      { input: 'foo.""', expected: sql.jsonPath(foo, ['']) },
      { input: 'foo."".x', expected: sql.jsonPath(foo, ['', 'x']) },
      { input: 'foo.x.""', expected: sql.jsonPath(foo, ['x', '']) },
      { input: 'foo.""[0]', expected: sql.jsonPath(foo, ['', 0]) },
      { input: 'foo."\\\\\\""', expected: sql.jsonPath(foo, ['\\"']) },
      { input: 'foo."a\\"b\\\\c"', expected: sql.jsonPath(foo, ['a"b\\c']) },

      // index access
      { input: 'foo[0]', expected: sql.jsonPath(foo, [0]) },
      { input: 'foo[123]', expected: sql.jsonPath(foo, [123]) },
      { input: 'foo[0][1]', expected: sql.jsonPath(foo, [0, 1]) },
      { input: 'foo[0][1][2]', expected: sql.jsonPath(foo, [0, 1, 2]) },
      { input: 'foo[0].a', expected: sql.jsonPath(foo, [0, 'a']) },
      { input: 'foo.a[0]', expected: sql.jsonPath(foo, ['a', 0]) },
      { input: 'foo.a[0].b', expected: sql.jsonPath(foo, ['a', 0, 'b']) },
      { input: 'foo[0]."a"', expected: sql.jsonPath(foo, [0, 'a']) },
      { input: 'foo."a"[0]', expected: sql.jsonPath(foo, ['a', 0]) },
      { input: 'foo.abc[0]."def"[1]', expected: sql.jsonPath(foo, ['abc', 0, 'def', 1]) },
      { input: 'foo.a[0][1][2]', expected: sql.jsonPath(foo, ['a', 0, 1, 2]) },

      // json path on associations
      { input: '$a.b$.c', expected: sql.jsonPath(new AssociationPath(['a'], 'b'), ['c']) },
      { input: '$a.b$."c"', expected: sql.jsonPath(new AssociationPath(['a'], 'b'), ['c']) },
      { input: '$a.b$[0]', expected: sql.jsonPath(new AssociationPath(['a'], 'b'), [0]) },
      { input: '$a.b$[0].c', expected: sql.jsonPath(new AssociationPath(['a'], 'b'), [0, 'c']) },
      { input: '$a$.c', expected: sql.jsonPath(new Attribute('a'), ['c']) },

      // json path followed by casts & modifiers
      { input: 'foo.bar::int', expected: sql.cast(sql.jsonPath(foo, ['bar']), 'int') },
      { input: 'foo.bar:unquote', expected: sql.unquote(sql.jsonPath(foo, ['bar'])) },
      { input: 'foo[0]::int', expected: sql.cast(sql.jsonPath(foo, [0]), 'int') },
      { input: 'foo[1][2]::int', expected: sql.cast(sql.jsonPath(foo, [1, 2]), 'int') },
      {
        input: 'foo."x"::int:unquote',
        expected: sql.unquote(sql.cast(sql.jsonPath(foo, ['x']), 'int')),
      },
      {
        input: 'foo.a.b[1]."c"::int:unquote::json',
        expected: sql.cast(
          sql.unquote(sql.cast(sql.jsonPath(foo, ['a', 'b', 1, 'c']), 'int')),
          'json',
        ),
      },
      {
        input: '$a.b$.c[0]::int',
        expected: sql.cast(sql.jsonPath(new AssociationPath(['a'], 'b'), ['c', 0]), 'int'),
      },
    ];

    for (const { input, expected } of cases) {
      it(`parses ${JSON.stringify(input)}`, () => {
        expect(parseAttributeSyntax(input)).to.deep.eq(expected);
      });
    }

    it('normalizes indexes with leading zeros', () => {
      // Intended: the index is always rendered as a normalized number in the generated SQL
      // (mariadb returns NULL for a raw JSON path containing a leading zero, e.g. `$.arr[01]`).
      expect(parseAttributeSyntax('foo[00]')).to.deep.eq(sql.jsonPath(foo, [0]));
      expect(parseAttributeSyntax('foo[007]')).to.deep.eq(sql.jsonPath(foo, [7]));
    });

    it('accepts indexes up to MAX_JSON_ARRAY_INDEX', () => {
      expect(parseAttributeSyntax(`foo[${MAX_JSON_ARRAY_INDEX}]`)).to.deep.eq(
        sql.jsonPath(foo, [MAX_JSON_ARRAY_INDEX]),
      );
    });

    it('rejects indexes above MAX_JSON_ARRAY_INDEX', () => {
      for (const input of [
        `foo[${MAX_JSON_ARRAY_INDEX + 1}]`,
        'foo[9007199254740993]',
        'foo[99999999999999999999]',
      ]) {
        expect(() => parseAttributeSyntax(input)).to.throwWithCause(
          TypeError,
          parseErrorMessage('attribute', input, 3, INDEX_TOO_LARGE),
        );
      }

      // the error points at the offending index, wherever it is in the path
      expect(() => parseAttributeSyntax('foo.a[0][2147483648]')).to.throwWithCause(
        TypeError,
        parseErrorMessage('attribute', 'foo.a[0][2147483648]', 8, INDEX_TOO_LARGE),
      );
    });
  });

  describe('rejected inputs', () => {
    const cases: Array<{ input: string; index: number; reason: string }> = [
      { input: '', index: 0, reason: 'empty string' },

      // control characters (U+0000 to U+001F, and U+007F) are reserved
      { input: '\tfoo', index: 0, reason: 'leading tab' },
      { input: 'foo\n', index: 3, reason: 'trailing newline' },
      { input: 'a\tb', index: 1, reason: 'tab inside identifier' },
      { input: 'a\nb', index: 1, reason: 'newline inside identifier' },
      { input: 'a\rb', index: 1, reason: 'carriage return inside identifier' },
      { input: 'a\u0000b', index: 1, reason: 'NUL inside identifier' },
      { input: '\u0000', index: 0, reason: 'NUL only' },
      { input: 'a\u001Fb', index: 1, reason: 'U+001F inside identifier' },
      { input: 'a\u007Fb', index: 1, reason: 'DEL inside identifier' },
      { input: '\n', index: 0, reason: 'newline only' },
      { input: '$a\nb$', index: 2, reason: 'newline in association' },
      { input: '$a.b\tc$', index: 4, reason: 'tab in association attribute' },
      { input: '$a\u0000.b$', index: 2, reason: 'NUL in association' },

      // reserved characters ($ . : [ ]) cannot appear in identifiers
      { input: 'a$b', index: 1, reason: '$ inside identifier' },
      { input: 'a]b', index: 1, reason: '] inside identifier' },
      { input: 'a[b', index: 2, reason: '[ inside identifier' },
      { input: '$a]b$', index: 2, reason: '] inside association' },
      { input: '$a[b$', index: 2, reason: '[ inside association' },
      { input: '$a:b$', index: 2, reason: ': inside association' },
      { input: '$a::b$', index: 2, reason: ':: inside association' },
      { input: '$a$b$', index: 3, reason: '$ inside association' },

      // associations
      { input: 'foo$', index: 3, reason: 'unbalanced $ (closing only)' },
      { input: '$foo', index: 4, reason: 'unbalanced $ (opening only)' },
      { input: '$$', index: 1, reason: 'empty association' },
      { input: '$$a$', index: 1, reason: 'double opening $' },
      { input: '$a.$', index: 3, reason: 'association with empty last segment' },
      { input: '$a.b.$', index: 5, reason: 'association with empty last segment (2 levels)' },
      { input: '$.a$', index: 1, reason: 'association with empty first segment' },
      { input: '$a..b$', index: 3, reason: 'association with empty middle segment' },
      { input: '$a$ ', index: 3, reason: 'trailing whitespace after association' },
      { input: '$a$b', index: 3, reason: 'identifier directly after association' },
      { input: '$a.b$c', index: 5, reason: 'identifier directly after association (2 levels)' },
      { input: '$a.b$-c', index: 5, reason: 'dash after association' },
      { input: '$a.b$$', index: 5, reason: 'extra $ after association' },
      { input: '$a$$b$', index: 3, reason: 'two consecutive associations' },
      { input: '$a.b$$c$', index: 5, reason: 'two consecutive associations (2 levels)' },
      { input: '$a$.b$', index: 5, reason: '$ after json path' },
      { input: 'a.b$', index: 3, reason: '$ after json path' },
      { input: '[0]', index: 0, reason: 'index access without attribute' },
      { input: '$café$ ', index: 6, reason: 'trailing whitespace after non-ASCII association' },

      // non-ASCII unquoted json keys (the alphabet of unquoted keys is narrower than the one of identifiers)
      { input: 'foo.bär', index: 5, reason: 'non-ASCII unquoted key' },
      { input: 'foo.日本', index: 4, reason: 'non-ASCII unquoted key (leading)' },
      { input: '$a.b$.bär', index: 7, reason: 'non-ASCII unquoted key after association' },

      // casts & modifiers
      { input: 'foo::', index: 5, reason: 'trailing ::' },
      { input: 'foo:', index: 4, reason: 'trailing :' },
      { input: 'foo::int::', index: 10, reason: 'trailing :: after cast' },
      { input: 'foo:::int', index: 5, reason: 'triple colon' },
      { input: 'foo::::int', index: 5, reason: 'quadruple colon' },
      { input: 'foo::int.b', index: 8, reason: 'json path after cast' },
      { input: 'foo:unquote.b', index: 11, reason: 'json path after modifier' },
      { input: 'foo::int[0]', index: 8, reason: 'index access after cast' },
      { input: 'foo::a-b', index: 6, reason: 'dash in cast type' },
      { input: 'foo:un-quote', index: 6, reason: 'dash in modifier name' },
      { input: 'foo::"int"', index: 5, reason: 'quoted cast type' },
      { input: 'foo::int ', index: 8, reason: 'trailing whitespace after cast' },
      { input: 'foo:: int', index: 5, reason: 'whitespace after ::' },
      { input: 'foo::in t', index: 7, reason: 'whitespace inside cast type' },
      { input: 'foo::int::text.b', index: 14, reason: 'json path after consecutive casts' },

      // json paths
      { input: '.a', index: 0, reason: 'leading dot' },
      { input: 'foo.', index: 4, reason: 'trailing dot' },
      { input: 'foo..b', index: 4, reason: 'double dot' },
      { input: 'foo.a..b', index: 6, reason: 'double dot (after key)' },
      { input: 'foo. a', index: 4, reason: 'whitespace after dot' },
      { input: 'foo.a b', index: 5, reason: 'whitespace inside key' },
      { input: 'foo.[0]', index: 4, reason: 'dot before index access' },
      { input: 'foo[0].', index: 7, reason: 'trailing dot after index access' },
      { input: 'foo[]', index: 4, reason: 'empty index' },
      { input: 'foo[0][]', index: 7, reason: 'empty index after index' },
      { input: 'foo[-1]', index: 4, reason: 'negative index' },
      { input: 'foo[1.5]', index: 5, reason: 'decimal index' },
      { input: 'foo[a]', index: 4, reason: 'identifier as index' },
      { input: 'foo["a"]', index: 4, reason: 'quoted string as index' },
      { input: 'foo[ 0]', index: 4, reason: 'whitespace inside index' },
      { input: 'foo[0', index: 5, reason: 'unclosed index' },
      { input: 'foo]', index: 3, reason: 'unopened index' },
      { input: 'foo.a]', index: 5, reason: 'unopened index after key' },
      { input: 'foo[[0]]', index: 4, reason: 'nested brackets' },
      { input: 'foo[0]]', index: 6, reason: 'extra closing bracket' },
      { input: 'foo[0]a', index: 6, reason: 'identifier directly after index' },
      { input: 'foo."unterminated', index: 17, reason: 'unterminated quoted key' },
      { input: 'foo."x"."unterminated', index: 21, reason: 'unterminated second quoted key' },
      { input: 'foo."b\\nc"', index: 7, reason: 'unsupported escape sequence \\n' },
      { input: 'foo::123', index: 5, reason: 'cast type starting with a digit' },
      {
        input: 'foo::1a',
        index: 5,
        reason: 'cast type starting with a digit (followed by letters)',
      },
      { input: 'foo:123', index: 4, reason: 'modifier name starting with a digit' },
      {
        input: 'foo:unquote::2',
        index: 13,
        reason: 'cast type starting with a digit after a modifier',
      },
      { input: 'foo."b\\tc"', index: 7, reason: 'unsupported escape sequence \\t' },
      { input: 'foo."a\\b"', index: 7, reason: 'unsupported escape sequence \\b' },
      { input: 'foo."\\"', index: 7, reason: 'escaped closing quote (unterminated)' },
      { input: 'foo."a""b"', index: 7, reason: 'two consecutive quoted keys without dot' },
      { input: 'foo."a"b', index: 7, reason: 'identifier directly after quoted key' },
      { input: 'foo.a"b"', index: 5, reason: 'quoted key directly after key' },
    ];

    for (const { input, index, reason } of cases) {
      it(`rejects ${JSON.stringify(input)} (${reason}) at index ${index}`, () => {
        expect(() => parseAttributeSyntax(input)).to.throwWithCause(
          TypeError,
          parseErrorMessage('attribute', input, index),
        );
      });
    }
  });

  describe('cache', () => {
    it('returns the same instance for the same input', () => {
      expect(parseAttributeSyntax('foo.bar')).to.equal(parseAttributeSyntax('foo.bar'));
    });

    it('does not cache rejected inputs', () => {
      expect(() => parseAttributeSyntax('foo$')).to.throw();
      expect(parseAttributeSyntax.cache.has('foo$')).to.be.false;

      expect(() => parseAttributeSyntax('foo:nope')).to.throw();
      expect(parseAttributeSyntax.cache.has('foo:nope')).to.be.false;
    });

    it('keeps recently used attributes cached within a fixed bound', () => {
      const syntaxes = Array.from(
        { length: ATTRIBUTE_SYNTAX_CACHE_MAX_SIZE },
        (_, index) => `field${index}`,
      );

      for (const syntax of syntaxes) {
        parseAttributeSyntax(syntax);
      }

      const firstSyntax = syntaxes[0];
      const secondSyntax = syntaxes[1];
      const firstResult = parseAttributeSyntax(firstSyntax);

      parseAttributeSyntax('nextField');

      expect(parseAttributeSyntax.cache.size).to.equal(ATTRIBUTE_SYNTAX_CACHE_MAX_SIZE);
      expect(parseAttributeSyntax.cache.has(firstSyntax)).to.be.true;
      expect(parseAttributeSyntax.cache.has(secondSyntax)).to.be.false;
      expect(parseAttributeSyntax(firstSyntax)).to.equal(firstResult);
    });
  });
});

describe('parseNestedJsonKeySyntax', () => {
  beforeEach(() => parseNestedJsonKeySyntax.cache.clear());
  afterEach(() => parseNestedJsonKeySyntax.cache.clear());

  describe('accepted inputs', () => {
    const cases: Array<{
      input: string;
      pathSegments: Array<string | number>;
      castsAndModifiers?: Array<string | Class<DialectAwareFn>>;
    }> = [
      // single key
      { input: 'foo', pathSegments: ['foo'] },
      { input: 'FOO', pathSegments: ['FOO'] },
      { input: 'foo123', pathSegments: ['foo123'] },
      { input: '_foo', pathSegments: ['_foo'] },
      // digits-only keys stay strings
      { input: '123', pathSegments: ['123'] },
      { input: '0', pathSegments: ['0'] },
      // dashes are allowed in unquoted keys
      { input: 'a-b', pathSegments: ['a-b'] },
      { input: 'abc-def.ijk-lmn', pathSegments: ['abc-def', 'ijk-lmn'] },
      { input: '-a', pathSegments: ['-a'] },
      { input: 'a-', pathSegments: ['a-'] },
      { input: '-', pathSegments: ['-'] },
      { input: 'a-1', pathSegments: ['a-1'] },
      { input: '1-a', pathSegments: ['1-a'] },

      // dot keys
      { input: 'foo.bar', pathSegments: ['foo', 'bar'] },
      { input: 'a.b.c', pathSegments: ['a', 'b', 'c'] },
      { input: 'a.0', pathSegments: ['a', '0'] },

      // quoted keys
      { input: '"foo"', pathSegments: ['foo'] },
      { input: '"foo"."bar"', pathSegments: ['foo', 'bar'] },
      { input: 'a."b"', pathSegments: ['a', 'b'] },
      { input: '"a".b', pathSegments: ['a', 'b'] },
      { input: '"123"', pathSegments: ['123'] },
      { input: '"a.b"', pathSegments: ['a.b'] },
      { input: '"a.b".c', pathSegments: ['a.b', 'c'] },
      { input: '"a[0]"', pathSegments: ['a[0]'] },
      { input: '"a:b"', pathSegments: ['a:b'] },
      { input: '"a$b"', pathSegments: ['a$b'] },
      { input: '"$a.b$"', pathSegments: ['$a.b$'] },
      { input: '"a b"', pathSegments: ['a b'] },
      { input: '"fóo"', pathSegments: ['fóo'] },
      { input: '"b\nc"', pathSegments: ['b\nc'] },
      { input: '"bar\\""', pathSegments: ['bar"'] },
      { input: '"bar\\\\"', pathSegments: ['bar\\'] },
      { input: '"\\"\\""', pathSegments: ['""'] },
      // the empty string is a valid JSON object key
      { input: '""', pathSegments: [''] },
      { input: '"".a', pathSegments: ['', 'a'] },
      { input: 'a.""', pathSegments: ['a', ''] },
      { input: '"a\\"b\\\\c"', pathSegments: ['a"b\\c'] },

      // index access
      { input: '[0]', pathSegments: [0] },
      { input: '[123]', pathSegments: [123] },
      { input: '[0][1]', pathSegments: [0, 1] },
      { input: '[0][1][2]', pathSegments: [0, 1, 2] },
      { input: '[0].a', pathSegments: [0, 'a'] },
      { input: 'a[0]', pathSegments: ['a', 0] },
      { input: 'a[0].b', pathSegments: ['a', 0, 'b'] },
      { input: '[0]."a"', pathSegments: [0, 'a'] },
      { input: '"a"[0]', pathSegments: ['a', 0] },
      { input: '"a"."b"[0]', pathSegments: ['a', 'b', 0] },

      // casts & modifiers
      { input: 'a::int', pathSegments: ['a'], castsAndModifiers: ['int'] },
      { input: 'a::Int', pathSegments: ['a'], castsAndModifiers: ['Int'] },
      { input: 'a::int::text', pathSegments: ['a'], castsAndModifiers: ['int', 'text'] },
      { input: 'a:unquote', pathSegments: ['a'], castsAndModifiers: [Unquote] },
      { input: 'a:UNQUOTE', pathSegments: ['a'], castsAndModifiers: [Unquote] },
      { input: 'a:unquote:unquote', pathSegments: ['a'], castsAndModifiers: [Unquote, Unquote] },
      { input: 'a:unquote::text', pathSegments: ['a'], castsAndModifiers: [Unquote, 'text'] },
      { input: 'a::text:unquote', pathSegments: ['a'], castsAndModifiers: ['text', Unquote] },
      { input: 'a.b::int', pathSegments: ['a', 'b'], castsAndModifiers: ['int'] },
      { input: 'a-b::int', pathSegments: ['a-b'], castsAndModifiers: ['int'] },
      { input: '"a"::int', pathSegments: ['a'], castsAndModifiers: ['int'] },
      {
        input: '"a"."b"::int:unquote',
        pathSegments: ['a', 'b'],
        castsAndModifiers: ['int', Unquote],
      },
      { input: '[0]::int', pathSegments: [0], castsAndModifiers: ['int'] },
      { input: '[0]:UNQUOTE', pathSegments: [0], castsAndModifiers: [Unquote] },
      {
        input: '[0]:unquote::text:unquote::text',
        pathSegments: [0],
        castsAndModifiers: [Unquote, 'text', Unquote, 'text'],
      },
      {
        input: '[1]::int::text:unquote',
        pathSegments: [1],
        castsAndModifiers: ['int', 'text', Unquote],
      },
    ];

    for (const { input, pathSegments, castsAndModifiers = [] } of cases) {
      it(`parses ${JSON.stringify(input)}`, () => {
        expect(parseNestedJsonKeySyntax(input)).to.deep.eq({ pathSegments, castsAndModifiers });
      });
    }

    it('normalizes indexes with leading zeros', () => {
      // Intended, see the parseAttributeSyntax test of the same name.
      expect(parseNestedJsonKeySyntax('[00]')).to.deep.eq({
        pathSegments: [0],
        castsAndModifiers: [],
      });
    });

    it('throws for unknown modifiers, listing the supported ones', () => {
      expect(() => parseNestedJsonKeySyntax('a:nope')).to.throwWithCause(
        TypeError,
        unknownModifierMessage('json path', 'a:nope', 'nope'),
      );

      expect(() => parseNestedJsonKeySyntax('[0]::int:nope')).to.throwWithCause(
        TypeError,
        unknownModifierMessage('json path', '[0]::int:nope', 'nope'),
      );
    });
  });

  describe('rejected inputs', () => {
    const cases: Array<{ input: string; index: number; reason: string; extra?: string }> = [
      { input: '', index: 0, reason: 'empty string' },
      { input: '   ', index: 0, reason: 'whitespace only' },
      { input: ' "a"', index: 0, reason: 'leading whitespace' },
      { input: '"a" ', index: 3, reason: 'trailing whitespace' },
      { input: 'a b', index: 1, reason: 'whitespace inside key' },

      // associations are not supported by this entry point
      { input: '$a$', index: 0, reason: 'association syntax' },
      { input: '$a.b$', index: 0, reason: 'association syntax (2 levels)' },
      { input: '$', index: 0, reason: 'lone $' },
      { input: 'a$', index: 1, reason: '$ after key' },
      { input: 'a.$b', index: 2, reason: '$ inside path' },
      { input: 'a.b$', index: 3, reason: '$ after path' },

      // non-ASCII unquoted keys
      { input: 'fóo', index: 1, reason: 'non-ASCII unquoted key' },

      // casts & modifiers
      { input: '::int', index: 0, reason: 'cast without key' },
      { input: ':unquote', index: 0, reason: 'modifier without key' },
      { input: 'a::', index: 3, reason: 'trailing ::' },
      { input: 'a:', index: 2, reason: 'trailing :' },
      { input: '[0]::', index: 5, reason: 'trailing :: after index' },
      { input: 'a::int.b', index: 6, reason: 'json path after cast' },
      { input: 'a::a-b', index: 4, reason: 'dash in cast type' },
      { input: 'a:un-quote', index: 4, reason: 'dash in modifier name' },

      // json paths
      { input: '.a', index: 0, reason: 'leading dot' },
      { input: '.foo', index: 0, reason: 'leading dot (longer key)' },
      { input: 'a.', index: 2, reason: 'trailing dot' },
      { input: 'a..b', index: 2, reason: 'double dot' },
      { input: '[]', index: 1, reason: 'empty index' },
      { input: '[-1]', index: 1, reason: 'negative index' },
      { input: '[1.5]', index: 2, reason: 'decimal index' },
      { input: '[0].', index: 4, reason: 'trailing dot after index' },
      { input: '[0', index: 2, reason: 'unclosed index' },
      { input: ']', index: 0, reason: 'unopened index' },
      { input: 'a]', index: 1, reason: 'unopened index after key' },
      { input: '[[0]]', index: 1, reason: 'nested brackets' },
      { input: '[0]a', index: 3, reason: 'key directly after index' },
      { input: 'a[0]a', index: 4, reason: 'key directly after index (after key)' },
      { input: '"unterminated', index: 13, reason: 'unterminated quoted key' },
      { input: '"b\\nc"', index: 3, reason: 'unsupported escape sequence \\n' },
      { input: 'a::123', index: 3, reason: 'cast type starting with a digit' },
      { input: 'a:1', index: 2, reason: 'modifier name starting with a digit' },
      {
        input: '[2147483648]',
        index: 0,
        reason: 'index above MAX_JSON_ARRAY_INDEX',
        extra: INDEX_TOO_LARGE,
      },
      {
        input: 'a[0][99999999999999999999]',
        index: 4,
        reason: 'index above MAX_JSON_ARRAY_INDEX (nested)',
        extra: INDEX_TOO_LARGE,
      },
      { input: '"a"b', index: 3, reason: 'key directly after quoted key' },
      { input: 'a"b"', index: 1, reason: 'quoted key directly after key' },
    ];

    for (const { input, index, reason, extra } of cases) {
      it(`rejects ${JSON.stringify(input)} (${reason}) at index ${index}`, () => {
        expect(() => parseNestedJsonKeySyntax(input)).to.throwWithCause(
          TypeError,
          parseErrorMessage('json path', input, index, extra),
        );
      });
    }
  });

  describe('cache', () => {
    it('returns the same instance for the same input', () => {
      expect(parseNestedJsonKeySyntax('foo.bar')).to.equal(parseNestedJsonKeySyntax('foo.bar'));
    });

    it('does not cache rejected inputs', () => {
      expect(() => parseNestedJsonKeySyntax('.a')).to.throw();
      expect(parseNestedJsonKeySyntax.cache.has('.a')).to.be.false;
    });

    it('keeps recently used JSON keys cached within a fixed bound', () => {
      const syntaxes = Array.from(
        { length: ATTRIBUTE_SYNTAX_CACHE_MAX_SIZE },
        (_, index) => `property${index}`,
      );

      for (const syntax of syntaxes) {
        parseNestedJsonKeySyntax(syntax);
      }

      const firstSyntax = syntaxes[0];
      const secondSyntax = syntaxes[1];
      const firstResult = parseNestedJsonKeySyntax(firstSyntax);

      parseNestedJsonKeySyntax('nextProperty');

      expect(parseNestedJsonKeySyntax.cache.size).to.equal(ATTRIBUTE_SYNTAX_CACHE_MAX_SIZE);
      expect(parseNestedJsonKeySyntax.cache.has(firstSyntax)).to.be.true;
      expect(parseNestedJsonKeySyntax.cache.has(secondSyntax)).to.be.false;
      expect(parseNestedJsonKeySyntax(firstSyntax)).to.equal(firstResult);
    });
  });
});
