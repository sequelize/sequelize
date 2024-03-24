import { parseDefaultValue } from '@sequelize/core/_non-semver-use-at-your-own-risk_/dialects/mysql/default-value-parser-internal.js';
import { expect } from 'chai';

import { literal } from '@sequelize/core';
import * as Support from '../../../support';

const dialect = Support.getTestDialect();

if (dialect.startsWith('mysql')) {
  const defaultField = {
    type: 'STRING',
    allowNull: false,
    primaryKey: false,
    autoIncrement: false,
    comment: null,
  };

  describe('[MySQL Specific] parseDefaultValue', () => {
    it('should return null for null default value', () => {
      expect(parseDefaultValue(null, { ...defaultField, type: 'INT' }, '')).to.be.null;
    });

    it('should return undefined for auto incremented value', () => {
      expect(parseDefaultValue(null, { ...defaultField, type: 'INT', autoIncrement: true }, '')).to
        .be.undefined;
    });

    it('should return undefined for default generated value', () => {
      expect(
        parseDefaultValue('now()', { ...defaultField, type: 'DATE' }, 'default_generated'),
      ).to.eql(literal('now()'));
    });

    for (const type of ['INT', 'TINYINT', 'SMALLINT', 'MEDIUMINT', 'BIGINT', 'FLOAT', 'DOUBLE']) {
      it(`should return a number for ${type}`, () => {
        expect(parseDefaultValue('1', { ...defaultField, type }, '')).to.equal(1);
      });
    }

    it('should return the raw value for decimal values', () => {
      expect(parseDefaultValue('1.2', { ...defaultField, type: 'DECIMAL' }, '')).to.equal('1.2');
    });

    it('should return the raw value for non-number types', () => {
      expect(parseDefaultValue('hello', { ...defaultField, type: 'VARCHAR' }, '')).to.equal(
        'hello',
      );
    });
  });
}
