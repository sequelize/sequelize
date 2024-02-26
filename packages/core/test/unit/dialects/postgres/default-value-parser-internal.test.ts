import { parseDefaultValue } from '@sequelize/core/_non-semver-use-at-your-own-risk_/dialects/postgres/default-value-parser-internal.js';
import { expect } from 'chai';

describe('[POSTGRES Specific] parseDefaultValue', () => {
  describe('for type BOOLEAN', () => {
    const type = 'BOOLEAN';

    it('should return null when rawDefaultValue is null', () => {
      expect(parseDefaultValue(null, type)).to.eq(null);
    });

    it('should return false when rawDefaultValue is false', () => {
      expect(parseDefaultValue('false', type)).to.eq(false);
    });

    it('should return true when rawDefaultValue is true', () => {
      expect(parseDefaultValue('true', type)).to.eq(true);
    });

    it('should return null when the rawDefaultValue is NULL::BOOLEAN', () => {
      expect(parseDefaultValue('NULL::BOOLEAN', type)).to.eq(null);
    });
  });

  describe('for numbers', () => {
    it('should return a number when rawDefaultValue is positive integer', () => {
      expect(parseDefaultValue('123', 'INTEGER')).to.eq(123);
    });

    it('should return a number when rawDefaultValue is negative integer', () => {
      expect(parseDefaultValue("'-123'::integer", 'INTEGER')).to.eq(-123);
    });

    it('should return 0 when rawDefaultValue is 0', () => {
      expect(parseDefaultValue('0', 'INTEGER')).to.eq(0);
    });

    it('should return a number when rawDefaultValue a numeric value', () => {
      expect(parseDefaultValue('0.01::numeric', 'DECIMAL')).to.eq(0.01);
    });

    it('should return a number when rawDefaultValue a negative numeric value', () => {
      expect(parseDefaultValue("'-0.01'::numeric", 'DECIMAL')).to.eq(-0.01);
    });
  });

  describe('for strings', () => {
    it('should return the string when rawDefaultValue is a string', () => {
      expect(parseDefaultValue("'string'", 'STRING')).to.eq('string');
    });

    it('should return the string when rawDefaultValue is a string with escaped quotes', () => {
      expect(parseDefaultValue("'string''s'", 'STRING')).to.eq("string's");
    });

    it('should remove the type casting when rawDefaultValue is a string with type casting', () => {
      expect(parseDefaultValue("'string'::text", 'STRING')).to.eq('string');
    });

    it('should return numeric values as text when rawDefaultValue is a string with type casting', () => {
      expect(parseDefaultValue("'123'::text", 'STRING')).to.eq('123');
    });

    it('should return undefined when rawDefaultValue is an invalid string', () => {
      expect(parseDefaultValue("'string", 'STRING')).to.be.undefined;
    });
  });

  describe('for function calls', ()=>{
    it('should return undefined when rawDefaultValue is a function call', () => {
      expect(parseDefaultValue('now()', 'TIMESTAMP')).to.be.undefined;
    });
  });
});