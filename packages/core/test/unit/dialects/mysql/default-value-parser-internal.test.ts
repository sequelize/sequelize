import { parseDefaultValue } from '@sequelize/core/_non-semver-use-at-your-own-risk_/dialects/mysql/default-value-parser-internal.js';
import { expect } from 'chai';

describe('[MySQL Specific] parseDefaultValue', () => {
  it('should return null for null default value', () => {
    expect(parseDefaultValue(null, 'INT', '')).to.be.null;
  });

  it('should return undefined for auto incremented value', () => {
    expect(parseDefaultValue(null, 'INT', 'AUTO_INCREMENT')).to.be.undefined;
  });

  it('should return undefined for default generated value', () => {
    expect(parseDefaultValue('now()', 'DATE', 'DEFAULT_GENERATED')).to.be.undefined;
  });

  for (const type of ['INT', 'TINYINT', 'SMALLINT', 'MEDIUMINT', 'BIGINT', 'FLOAT', 'DOUBLE']) {
    it(`should return a number for ${type}`, () => {
      expect(parseDefaultValue('1', type, '')).to.equal(1);
    });
  }

  it('should return the raw value for decimal values', () => {
    expect(parseDefaultValue('1.2', 'DECIMAL', '')).to.equal('1.2');
  });

  it('should return the raw value for non-number types', () => {
    expect(parseDefaultValue('hello', 'VARCHAR', '')).to.equal('hello');
  });
});