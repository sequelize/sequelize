import { Op } from '@sequelize/core';
import { expect } from 'chai';
import {
  canBindAsVarChar,
  escapeUserStringLiteral,
  isVarcharSafeString,
  quoteMsSqlStringLiteral,
  withDialectStringLiterals,
} from './string-encoding';

describe('MSSQL string encoding', () => {
  describe('isVarcharSafeString', () => {
    const safeValues = [
      '',
      'plain ASCII 123 !@#$%^&*()',
      "quote's",
      '\\',
      ' leading and trailing ',
      '\0',
      '\t',
      '\n',
      '\u001F',
      '\u007F',
      'x'.repeat(8001),
    ];

    for (const value of safeValues) {
      it(`accepts ${JSON.stringify(value)}`, () => {
        expect(isVarcharSafeString(value)).to.equal(true);
      });
    }

    const unicodeValues = [
      '\u0080',
      '\u00A0',
      'café',
      'e\u0301',
      'مرحبا',
      '中文',
      '😀',
      '\uD800',
      '\uDC00',
      'ASCII then é',
    ];

    for (const value of unicodeValues) {
      it(`rejects ${JSON.stringify(value)}`, () => {
        expect(isVarcharSafeString(value)).to.equal(false);
      });
    }
  });

  describe('quoteMsSqlStringLiteral', () => {
    it('shares apostrophe escaping for national and non-national forms', () => {
      expect(quoteMsSqlStringLiteral("it's", false)).to.equal("'it''s'");
      expect(quoteMsSqlStringLiteral("it's", true)).to.equal("N'it''s'");
      expect(quoteMsSqlStringLiteral('plain', true)).to.equal("N'plain'");
      expect(quoteMsSqlStringLiteral('plain', false)).to.equal("'plain'");
    });
  });

  describe('escapeUserStringLiteral', () => {
    it('uses a non-national literal for ASCII', () => {
      expect(escapeUserStringLiteral('plain')).to.equal("'plain'");
      expect(escapeUserStringLiteral("it's")).to.equal("'it''s'");
      expect(escapeUserStringLiteral("''")).to.equal("''''''");
      expect(escapeUserStringLiteral('a\\b')).to.equal("'a\\b'");
      expect(escapeUserStringLiteral('\0')).to.equal("'\0'");
      expect(escapeUserStringLiteral('\u007F')).to.equal("'\u007F'");
      expect(escapeUserStringLiteral('')).to.equal("''");
    });

    it('uses a national literal for any non-ASCII code unit', () => {
      expect(escapeUserStringLiteral('café')).to.equal("N'café'");
      expect(escapeUserStringLiteral('😀')).to.equal("N'😀'");
      expect(escapeUserStringLiteral('\uD800')).to.equal("N'\uD800'");
    });
  });

  describe('withDialectStringLiterals', () => {
    const dialect = {
      escapeString(value: string) {
        return quoteMsSqlStringLiteral(value, true);
      },
    };

    it('rewrites leaf strings without mutating the input', () => {
      const input = { role: ['admin', 'user'], age: { gte: 10 } };
      const output = withDialectStringLiterals(input, dialect as any) as any;

      expect(input.role[0]).to.equal('admin');
      expect(output.role[0].val[0]).to.equal("N'admin'");
      expect(output.role[1].val[0]).to.equal("N'user'");
      expect(output.age.gte).to.equal(10);
    });

    it('preserves Op.col identifier targets', () => {
      const input = { authorId: { [Op.col]: 'users.id' } };
      const output = withDialectStringLiterals(input, dialect as any) as any;

      expect(output.authorId[Op.col]).to.equal('users.id');
    });
  });

  describe('canBindAsVarChar', () => {
    it('requires a mapped code page', () => {
      expect(canBindAsVarChar({ codepage: 'CP1252' })).to.equal(true);
      expect(canBindAsVarChar({ codepage: 'CP932' })).to.equal(true);
      expect(canBindAsVarChar({ codepage: 'utf-8' })).to.equal(true);
      expect(canBindAsVarChar({})).to.equal(false);
      expect(canBindAsVarChar(undefined)).to.equal(false);
      expect(canBindAsVarChar(null)).to.equal(false);
    });
  });
});
