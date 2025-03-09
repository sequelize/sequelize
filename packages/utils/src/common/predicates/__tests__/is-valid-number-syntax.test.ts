import { isValidNumberSyntax } from '@sequelize/utils';
import { expect } from 'chai';

describe('isValidNumberSyntax', () => {
  it('returns true for valid base 10 numbers', () => {
    expect(isValidNumberSyntax('10')).to.equal(true);
    expect(isValidNumberSyntax('0.1')).to.equal(true);
    expect(isValidNumberSyntax('-10')).to.equal(true);
    expect(isValidNumberSyntax('1e5')).to.equal(true);
    expect(isValidNumberSyntax('-1e5')).to.equal(true);
  });

  it('returns false for invalid base 10 numbers', () => {
    expect(isValidNumberSyntax('abc')).to.equal(false);
    expect(isValidNumberSyntax('10a')).to.equal(false);
    expect(isValidNumberSyntax('1.1.1')).to.equal(false);
    expect(isValidNumberSyntax('1e1e1')).to.equal(false);
    expect(isValidNumberSyntax('')).to.equal(false);
    expect(isValidNumberSyntax('-')).to.equal(false);
    expect(isValidNumberSyntax(' 12')).to.equal(false);
    expect(isValidNumberSyntax('1_2')).to.equal(false);
  });

  it('does not support non-finite numbers', () => {
    expect(isValidNumberSyntax('Infinity')).to.equal(false);
    expect(isValidNumberSyntax('-Infinity')).to.equal(false);
    expect(isValidNumberSyntax('NaN')).to.equal(false);
  });
});
