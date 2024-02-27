import { parseDefaultValue } from '@sequelize/core/_non-semver-use-at-your-own-risk_/dialects/sqlite/default-value-parser-internal.js';
import { expect } from 'chai';

import { literal } from '@sequelize/core';
import * as Support from '../../../support';

const dialect = Support.getTestDialect();

if (dialect.startsWith('sqlite')) {
  const defaultField = {
    type: 'STRING',
    allowNull: false,
    primaryKey: false,
    autoIncrement: false,
    comment: null,
  };

  describe('[Sqlite Specific] parseDefaultValue', () => {
    it('should return undefined for null default value', () => {
      expect(parseDefaultValue(null, { ...defaultField, type: 'INTEGER' })).to.be.undefined;
    });

    it('should return null for NULL value', () => {
      expect(parseDefaultValue('NULL', { ...defaultField, type: 'INTEGER' })).to.eq(null);
    });

    for (const type of ['INTEGER', 'REAL']) {
      it(`should return a number for ${type}`, () => {
        expect(parseDefaultValue('1', { ...defaultField, type }, '')).to.equal(1);
      });
    }

    it('should remove quotes from string', () => {
      expect(parseDefaultValue("'test'", { ...defaultField, type: 'STRING' })).to.equal('test');
    });

    it('should unescape quotes in string', () => {
      expect(parseDefaultValue("'te''st'", { ...defaultField, type: 'STRING' })).to.equal("te'st");
    });

    it('should return literal for other types', () => {
      expect(parseDefaultValue('CURRENT_TIMESTAMP', { ...defaultField, type: 'DATE' })).to.eql(
        literal('CURRENT_TIMESTAMP'),
      );
    });
  });
}
