import { parseDefaultValue } from '@sequelize/core/_non-semver-use-at-your-own-risk_/dialects/postgres/default-value-parser-internal.js';
import { expect } from 'chai';

import { literal } from '@sequelize/core';
import * as Support from '../../../support';

const dialect = Support.getTestDialect();

if (dialect.startsWith('postgres')) {
  describe('[POSTGRES Specific] parseDefaultValue', () => {
    const defaultField = {
      allowNull: false,
      primaryKey: false,
      autoIncrement: false,
      comment: null,
    };

    describe('null value', () => {
      it('should return null when rawDefaultValue is null and allowNull is true', () => {
        expect(parseDefaultValue(null, { ...defaultField, allowNull: true, type: 'STRING' })).to.eq(
          null,
        );
      });

      it('should return undefined when rawDefaultValue is null and allowNull is false', () => {
        expect(parseDefaultValue(null, { ...defaultField, allowNull: false, type: 'STRING' })).to.be
          .undefined;
      });
    });

    describe('for type BOOLEAN', () => {
      const type = 'BOOLEAN';

      it('should return false when rawDefaultValue is false', () => {
        expect(parseDefaultValue('false', { ...defaultField, type })).to.eq(false);
      });

      it('should return true when rawDefaultValue is true', () => {
        expect(parseDefaultValue('true', { ...defaultField, type })).to.eq(true);
      });

      it('should return null when the rawDefaultValue is NULL::BOOLEAN', () => {
        expect(parseDefaultValue('NULL::BOOLEAN', { ...defaultField, type })).to.eq(null);
      });
    });

    describe('for numbers', () => {
      it('should return a number when rawDefaultValue is positive integer', () => {
        expect(parseDefaultValue('123', { ...defaultField, type: 'INTEGER' })).to.eq(123);
      });

      it('should return a number when rawDefaultValue is negative integer', () => {
        expect(parseDefaultValue("'-123'::integer", { ...defaultField, type: 'INTEGER' })).to.eq(
          -123,
        );
      });

      it('should return 0 when rawDefaultValue is 0', () => {
        expect(parseDefaultValue('0', { ...defaultField, type: 'INTEGER' })).to.eq(0);
      });

      it('should return a number when rawDefaultValue a numeric value', () => {
        expect(parseDefaultValue('0.01::numeric', { ...defaultField, type: 'DOUBLE' })).to.eq(0.01);
      });

      it('should return a number when rawDefaultValue a negative numeric value', () => {
        expect(parseDefaultValue("'-0.01'::numeric", { ...defaultField, type: 'DOUBLE' })).to.eq(
          -0.01,
        );
      });
    });

    describe('for decimal numbers', () => {
      it('should return a string representing the decimal number when rawDefaultValue is a decimal number', () => {
        expect(parseDefaultValue('0.01', { ...defaultField, type: 'NUMERIC' })).to.eq('0.01');
      });

      it('should return a string representing the decimal number when rawDefaultValue is a negative decimal number', () => {
        expect(parseDefaultValue("'-0.01'::numeric", { ...defaultField, type: 'NUMERIC' })).to.eq(
          '-0.01',
        );
      });
    });

    describe('for strings', () => {
      it('should return the string when rawDefaultValue is a string', () => {
        expect(parseDefaultValue("'string'", { ...defaultField, type: 'STRING' })).to.eq('string');
      });

      it('should return the string when rawDefaultValue is a string with escaped quotes', () => {
        expect(parseDefaultValue("'string''s'", { ...defaultField, type: 'STRING' })).to.eq(
          "string's",
        );
      });

      it('should remove the type casting when rawDefaultValue is a string with type casting', () => {
        expect(parseDefaultValue("'string'::text", { ...defaultField, type: 'STRING' })).to.eq(
          'string',
        );
      });

      it('should return numeric values as text when rawDefaultValue is a string with type casting', () => {
        expect(parseDefaultValue("'123'::text", { ...defaultField, type: 'STRING' })).to.eq('123');
      });

      it('should return undefined when rawDefaultValue is an invalid string', () => {
        expect(parseDefaultValue("'string", { ...defaultField, type: 'STRING' })).to.be.undefined;
      });
    });

    describe('for function calls', () => {
      it('should return undefined when rawDefaultValue is a function call', () => {
        expect(parseDefaultValue('now()', { ...defaultField, type: 'TIMESTAMP' })).to.eql(
          literal('now()'),
        );
      });
    });

    for (const type of ['JSON', 'JSONB']) {
      describe(`for ${type}`, () => {
        it(`should return the parsed JSON when rawDefaultValue is a ${type}`, () => {
          expect(
            parseDefaultValue(`'{"key": "value"}'::${type.toLowerCase()}`, {
              ...defaultField,
              type,
            }),
          ).to.eql({
            key: 'value',
          });
        });

        it(`should unescape single quotes when rawDefaultValue is a ${type} with escaped quotes`, () => {
          expect(
            parseDefaultValue(`'{"key": "value''s"}'::${type.toLowerCase()}`, {
              ...defaultField,
              type,
            }),
          ).to.eql({
            key: "value's",
          });
        });
      });
    }
  });
}
