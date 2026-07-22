import { expect } from 'chai';
import {
  canBindAsVarChar,
  escapeUserStringLiteral,
  isVarcharSafeString,
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
      '\x1f',
      '\x7f',
      'x'.repeat(8_001),
    ];

    for (const value of safeValues) {
      it(`accepts ${JSON.stringify(value)}`, () => {
        expect(isVarcharSafeString(value)).to.equal(true);
      });
    }

    const unicodeValues = [
      '\u0080',
      '\u00a0',
      'café',
      'e\u0301',
      'مرحبا',
      '中文',
      '😀',
      '\ud800',
      '\udc00',
      'ASCII then é',
    ];

    for (const value of unicodeValues) {
      it(`rejects ${JSON.stringify(value)}`, () => {
        expect(isVarcharSafeString(value)).to.equal(false);
      });
    }
  });

  describe('escapeUserStringLiteral', () => {
    it('uses a non-national literal for ASCII', () => {
      expect(escapeUserStringLiteral('plain')).to.equal("'plain'");
      expect(escapeUserStringLiteral("it's")).to.equal("'it''s'");
      expect(escapeUserStringLiteral("''")).to.equal("''''''");
      expect(escapeUserStringLiteral('a\\b')).to.equal("'a\\b'");
      expect(escapeUserStringLiteral('\0')).to.equal("'\0'");
      expect(escapeUserStringLiteral('\x7f')).to.equal("'\x7f'");
      expect(escapeUserStringLiteral('')).to.equal("''");
    });

    it('uses a national literal for any non-ASCII code unit', () => {
      expect(escapeUserStringLiteral('café')).to.equal("N'café'");
      expect(escapeUserStringLiteral('😀')).to.equal("N'😀'");
      expect(escapeUserStringLiteral('\ud800')).to.equal("N'\ud800'");
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
