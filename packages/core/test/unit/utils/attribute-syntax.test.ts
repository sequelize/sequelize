import { AssociationPath, Attribute, sql } from '@sequelize/core';
import { Unquote } from '@sequelize/core/_non-semver-use-at-your-own-risk_/expression-builders/dialect-aware-fn.js';
import {
  parseAttributeSyntax,
  parseNestedJsonKeySyntax,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/attribute-syntax.js';
import { expect } from 'chai';

describe('parseAttributeSyntax', () => {
  it('parses simple attributes', () => {
    expect(parseAttributeSyntax('foo')).to.deep.eq(new Attribute('foo'));
  });

  it('parses simple associations', () => {
    expect(parseAttributeSyntax('$bar$')).to.deep.eq(new Attribute('bar'));

    expect(parseAttributeSyntax('$foo.bar$')).to.deep.eq(new AssociationPath(['foo'], 'bar'));

    expect(parseAttributeSyntax('$foo.zzz.bar$')).to.deep.eq(
      new AssociationPath(['foo', 'zzz'], 'bar'),
    );
  });

  it('throws for unbalanced association syntax', () => {
    // The error points at the erroneous character each time, but we only test the first one
    expect(() => parseAttributeSyntax('foo$')).to
      .throwWithCause(`Failed to parse syntax of attribute. Parse error at index 3:
foo$
   ^`);

    expect(() => parseAttributeSyntax('$foo')).to
      .throwWithCause(`Failed to parse syntax of attribute. Parse error at index 4:
$foo
    ^`);
  });

  it('parses cast syntax', () => {
    expect(parseAttributeSyntax('foo::bar')).to.deep.eq(sql.cast(new Attribute('foo'), 'bar'));
  });

  it('parses consecutive casts', () => {
    expect(parseAttributeSyntax('foo::bar::baz')).to.deep.eq(
      sql.cast(sql.cast(new Attribute('foo'), 'bar'), 'baz'),
    );
  });

  it('parses modifier syntax', () => {
    expect(parseAttributeSyntax('foo:unquote')).to.deep.eq(sql.unquote(new Attribute('foo')));
  });

  it('parses consecutive modifiers', () => {
    expect(parseAttributeSyntax('foo:unquote:unquote')).to.deep.eq(
      sql.unquote(sql.unquote(new Attribute('foo'))),
    );
  });

  it('parses casts and modifiers', () => {
    expect(parseAttributeSyntax('textAttr::json:unquote::integer')).to.deep.eq(
      sql.cast(sql.unquote(sql.cast(new Attribute('textAttr'), 'json')), 'integer'),
    );
  });

  it('treats everything after ::/: as a cast/modifier', () => {
    // "json.property" is treated as a cast, not a JSON path
    // but it's not a valid cast, so it will throw
    expect(() => parseAttributeSyntax('textAttr::json.property')).to
      .throwWithCause(`Failed to parse syntax of attribute. Parse error at index 14:
textAttr::json.property
              ^`);

    // "json.property" is treated as a modifier (which does not exist and will throw), not a JSON path
    expect(() => parseAttributeSyntax('textAttr:json.property')).to
      .throwWithCause(`Failed to parse syntax of attribute. Parse error at index 13:
textAttr:json.property
             ^`);
  });

  it('parses JSON paths', () => {
    expect(parseAttributeSyntax('foo.bar')).to.deep.eq(sql.jsonPath(new Attribute('foo'), ['bar']));

    expect(parseAttributeSyntax('foo."bar"')).to.deep.eq(
      sql.jsonPath(new Attribute('foo'), ['bar']),
    );

    expect(parseAttributeSyntax('foo."bar\\""')).to.deep.eq(
      sql.jsonPath(new Attribute('foo'), ['bar"']),
    );

    expect(parseAttributeSyntax('foo."bar\\\\"')).to.deep.eq(
      sql.jsonPath(new Attribute('foo'), ['bar\\']),
    );

    expect(parseAttributeSyntax('foo[123]')).to.deep.eq(sql.jsonPath(new Attribute('foo'), [123]));

    expect(parseAttributeSyntax('foo."123"')).to.deep.eq(
      sql.jsonPath(new Attribute('foo'), ['123']),
    );

    expect(parseAttributeSyntax('foo.abc[0]."def"[1]')).to.deep.eq(
      sql.jsonPath(new Attribute('foo'), ['abc', 0, 'def', 1]),
    );
  });
});

describe('parseNestedJsonKeySyntax', () => {
  it('parses JSON paths', () => {
    expect(parseNestedJsonKeySyntax('foo.bar')).to.deep.eq({
      pathSegments: ['foo', 'bar'],
      castsAndModifiers: [],
    });

    expect(parseNestedJsonKeySyntax('abc-def.ijk-lmn')).to.deep.eq({
      pathSegments: ['abc-def', 'ijk-lmn'],
      castsAndModifiers: [],
    });

    expect(parseNestedJsonKeySyntax('"foo"."bar"')).to.deep.eq({
      pathSegments: ['foo', 'bar'],
      castsAndModifiers: [],
    });

    expect(parseNestedJsonKeySyntax('[0]')).to.deep.eq({
      pathSegments: [0],
      castsAndModifiers: [],
    });
  });

  it('parses casts and modifiers', () => {
    expect(parseNestedJsonKeySyntax('[0]:unquote::text:unquote::text')).to.deep.eq({
      pathSegments: [0],
      castsAndModifiers: [Unquote, 'text', Unquote, 'text'],
    });
  });
});
