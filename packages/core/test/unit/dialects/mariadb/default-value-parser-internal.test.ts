import { parseDefaultValue } from '@sequelize/core/_non-semver-use-at-your-own-risk_/dialects/mariadb/default-value-parser-internal.js';
import { expect } from 'chai';

import { literal } from '@sequelize/core';
import * as Support from '../../../support';

const dialect = Support.getTestDialect();

if (dialect.startsWith('mariadb')) {
  const defaultField = {
    type: 'STRING',
    allowNull: false,
    primaryKey: false,
    autoIncrement: false,
    comment: null,
  };

  describe('[MariaDB Specific] parseDefaultValue', () => {
    it('should return undefined when the field is autoIncrement', () => {
      expect(parseDefaultValue('1', { ...defaultField, autoIncrement: true })).to.be.undefined;
    });

    it('should return undefined when the rawDefaultValue is null', () => {
      expect(parseDefaultValue(null, defaultField)).to.be.undefined;
    });

    it('should return null when the rawDefaultValue is NULL', () => {
      expect(parseDefaultValue('NULL', defaultField)).to.be.null;
    });

    for (const type of [
      'INT(32)',
      'TINYINT(1)',
      'SMALLINT(1)',
      'MEDIUMINT(1)',
      'BIGINT(1)',
      'FLOAT',
      'DOUBLE',
    ]) {
      it(`should return a number when the rawDefaultValue is a number for type ${type}`, () => {
        expect(parseDefaultValue('123', { ...defaultField, type })).to.eq(123);
      });
    }

    it('should return a string when the number is a decimal', () => {
      expect(parseDefaultValue('123.45', { ...defaultField, type: 'DECIMAL(5,2)' })).to.eq(
        '123.45',
      );
    });

    describe('string values', () => {
      it('should return a string when the rawDefaultValue is a string', () => {
        expect(parseDefaultValue("'string'", defaultField)).to.eq('string');
      });

      it('should return a string when the rawDefaultValue is a string with escaped quotes', () => {
        expect(parseDefaultValue("'string''s'", defaultField)).to.eq("string's");
      });

      it('should return a string when the rawDefaultValue is a string with escaped backslashes', () => {
        expect(parseDefaultValue("'string\\\\s'", defaultField)).to.eq('string\\s');
      });

      it('should return the value as is when the rawDefaultValue is a number', () => {
        expect(parseDefaultValue('123', defaultField)).to.eq('123');
      });
    });

    describe('it should return a literal when the rawDefaultValue is a literal', () => {
      expect(parseDefaultValue('CURRENT_TIMESTAMP', { ...defaultField, type: 'TIMESTAMP' })).to.eql(
        literal('CURRENT_TIMESTAMP'),
      );
    });
  });
}
