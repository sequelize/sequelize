import { expect } from 'chai';
import { sql, AssociationPath, Attribute } from '@sequelize/core';
import { parseJsonPathRaw, parseAttributeSyntax } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/attribute-syntax.js';

function testParseJsonPathRaw(code: string, paths: Array<string | number>, unquote: boolean = false): void {
  const out = parseJsonPathRaw(code);

  expect(out[0]).to.deep.eq(paths, `path mismatch for syntax ${code}`);
  expect(out[1]).to.eq(unquote, `unquote detection mismatch for syntax ${code}`);
}

describe('parseJsonPathRaw', () => {
  it('parses simple paths', () => {
    testParseJsonPathRaw('foo', ['foo']);
  });
});

describe('parseAttributeSyntax', () => {
  it('parses simple attributes', () => {
    expect(parseAttributeSyntax('foo')).to.deep.eq(new Attribute('foo'));
  });

  it('parses simple associations', () => {
    expect(parseAttributeSyntax('$bar$')).to.deep.eq(
      new Attribute('bar'),
    );

    expect(parseAttributeSyntax('$foo.bar$')).to.deep.eq(
      new AssociationPath(['foo'], 'bar'),
    );

    expect(parseAttributeSyntax('$foo.zzz.bar$')).to.deep.eq(
      new AssociationPath(['foo', 'zzz'], 'bar'),
    );
  });

  it('throws for unbalanced association syntax', () => {
    // The error points at the erroneous character each time, but we only test the first one
    expect(() => parseAttributeSyntax('foo$')).to.throwWithCause(`Failed to parse syntax of attribute. Parse error at index 3:
foo$
   ^`);

    expect(() => parseAttributeSyntax('$foo')).to.throwWithCause(`Failed to parse syntax of attribute. Parse error at index 0:`);
  });

  it('parses cast syntax', () => {
    expect(parseAttributeSyntax('foo::bar')).to.deep.eq(
      sql.cast(new Attribute('foo'), 'bar'),
    );
  });

  it('parses consecutive casts', () => {
    expect(parseAttributeSyntax('foo::bar::baz')).to.deep.eq(
      sql.cast(sql.cast(new Attribute('foo'), 'bar'), 'baz'),
    );
  });

  it('parses modifier syntax', () => {
    expect(parseAttributeSyntax('foo:unquote')).to.deep.eq(
      sql.unquote(new Attribute('foo')),
    );
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
    expect(() => parseAttributeSyntax('textAttr::json.property')).to.throwWithCause(`Failed to parse syntax of attribute. Parse error at index 14:
textAttr::json.property
              ^`);

    // "json.property" is treated as a modifier (which does not exist and will throw), not a JSON path
    expect(() => parseAttributeSyntax('textAttr:json.property')).to.throwWithCause(`Failed to parse syntax of attribute. Parse error at index 13:
textAttr:json.property
             ^`);
  });

  it('parses JSON paths', () => {
    expect(parseAttributeSyntax('foo.bar')).to.deep.eq(
      sql.jsonPath(new Attribute('foo'), ['bar']),
    );

    expect(parseAttributeSyntax('foo."bar"')).to.deep.eq(
      sql.jsonPath(new Attribute('foo'), ['bar']),
    );

    expect(parseAttributeSyntax('foo."bar\\""')).to.deep.eq(
      sql.jsonPath(new Attribute('foo'), ['bar"']),
    );

    expect(parseAttributeSyntax('foo."bar\\\\"')).to.deep.eq(
      sql.jsonPath(new Attribute('foo'), ['bar\\']),
    );

    expect(parseAttributeSyntax('foo[123]')).to.deep.eq(
      sql.jsonPath(new Attribute('foo'), [123]),
    );

    expect(parseAttributeSyntax('foo."123"')).to.deep.eq(
      sql.jsonPath(new Attribute('foo'), ['123']),
    );

    expect(parseAttributeSyntax('foo.abc[0]."def"[1]')).to.deep.eq(
      sql.jsonPath(new Attribute('foo'), ['abc', 0, 'def', 1]),
    );
  });
});
