import { parseFiniteNumber } from '@sequelize/utils';
import { expect } from 'chai';

describe('parseFiniteNumber', () => {
  it('should return null when input is not a valid number syntax', () => {
    expect(parseFiniteNumber('not a number')).to.be.null;
    // "Number" would have returned 0 instead
    expect(parseFiniteNumber('')).to.be.null;
    expect(parseFiniteNumber('-')).to.be.null;
    expect(parseFiniteNumber(' -1')).to.be.null;
  });

  it('should return null when input is an infinite number', () => {
    expect(parseFiniteNumber('Infinity')).to.be.null;
  });

  it('should return a number when input is a valid number string', () => {
    expect(parseFiniteNumber('123')).to.equal(123);
    expect(parseFiniteNumber('-123')).to.equal(-123);
  });

  it('should return a number when input is a valid number in scientific notation', () => {
    expect(parseFiniteNumber('5e1')).to.equal(50);
    expect(parseFiniteNumber('-5e1')).to.equal(-50);
  });

  it('should return a number when input is a valid decimal number', () => {
    expect(parseFiniteNumber('123.456')).to.equal(123.456);
    expect(parseFiniteNumber('-123.456')).to.equal(-123.456);
  });

  it('should return null when input is a BigInt outside of the Safe Integer range', () => {
    expect(parseFiniteNumber(BigInt(Number.MAX_SAFE_INTEGER) + 1n)).to.be.null;
  });

  it('should return a number when input is a valid BigInt within the Safe Integer range', () => {
    expect(parseFiniteNumber(123n)).to.equal(123);
    expect(parseFiniteNumber(-123n)).to.equal(-123);
  });
});

describe('parseFiniteNumber.orThrow', () => {
  it('throws an error when the input is not parseable as a finite number', () => {
    expect(() => parseFiniteNumber.orThrow('not a number')).to.throw();
  });

  it('returns the parsed number when the input is parseable as a finite number', () => {
    expect(parseFiniteNumber.orThrow('123')).to.equal(123);
  });
});
