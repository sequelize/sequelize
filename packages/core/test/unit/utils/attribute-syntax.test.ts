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
    expect(parseAttributeSyntax('bar$')).to.deep.eq(
      new Attribute('bar'),
    );

    expect(parseAttributeSyntax('$foo.bar$')).to.deep.eq(
      new AssociationPath(['foo'], 'bar'),
    );

    expect(parseAttributeSyntax('$foo.zzz.bar$')).to.deep.eq(
      new AssociationPath(['foo', 'zzz'], 'bar'),
    );
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
});
