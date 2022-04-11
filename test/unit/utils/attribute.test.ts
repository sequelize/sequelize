import { parseAttributeSyntax } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/attribute.js';
import { expect } from 'chai';

describe('parseAttributeSyntax', () => {
  it('parses ::casting syntax', () => {
    expect(parseAttributeSyntax('attr::integer')).to.deep.equal({
      type: 'cast',
      to: 'integer',
      attribute: {
        type: 'attribute',
        value: 'attr',
      },
    });
  });

  it('parses json.path syntax', () => {
    expect(parseAttributeSyntax('attr.json.path')).to.deep.equal({
      type: 'json',
      path: ['json', 'path'],
      attribute: {
        type: 'attribute',
        value: 'attr',
      },
    });
  });

  it('parses $association.path$ syntax', () => {
    expect(parseAttributeSyntax('$association.nested.attr$')).to.deep.equal({
      type: 'association',
      path: ['association', 'nested'],
      attribute: {
        type: 'attribute',
        value: 'attr',
      },
    });
  });

  it('parses $attribute$ syntax', () => {
    expect(parseAttributeSyntax('$attr$')).to.deep.equal({
      type: 'attribute',
      value: 'attr',
    });
  });

  it('parses a mix of all 3 syntaxes', () => {
    expect(parseAttributeSyntax('$association.nested.attr$.json.path::integer')).to.deep.equal({
      type: 'cast',
      to: 'integer',
      attribute: {
        type: 'json',
        path: ['json', 'path'],
        attribute: {
          type: 'association',
          path: ['association', 'nested'],
          attribute: {
            type: 'attribute',
            value: 'attr',
          },
        },
      },
    });
  });

  it('returns a plain attribute if no syntax matched', () => {
    expect(parseAttributeSyntax('myAttribute')).to.deep.equal({
      type: 'attribute',
      value: 'myAttribute',
    });
  });
});
