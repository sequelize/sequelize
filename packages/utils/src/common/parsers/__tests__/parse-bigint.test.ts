import { parseBigInt } from '@sequelize/utils';
import { expect } from 'chai';

describe('parseBigInt', () => {
  it('should return null when input is not a valid number syntax', () => {
    expect(parseBigInt('not a number')).to.be.null;
    // "BigInt" would have returned 0 instead
    expect(parseBigInt('')).to.be.null;
    expect(parseBigInt('-')).to.be.null;
    expect(parseBigInt(' -1')).to.be.null;
  });

  it('should return null when input is an unsafe integer', () => {
    expect(parseBigInt(Number.MAX_SAFE_INTEGER + 1)).to.be.null;
    expect(parseBigInt(Number.MIN_SAFE_INTEGER - 1)).to.be.null;
  });

  it('should return bigint when input is a safe integer', () => {
    expect(parseBigInt(10)).to.deep.equal(10n);
    expect(parseBigInt(-10)).to.deep.equal(-10n);
    expect(parseBigInt('9007199254740992')).to.deep.equal(9_007_199_254_740_992n);
    expect(parseBigInt('-9007199254740992')).to.deep.equal(-9_007_199_254_740_992n);
  });

  it('should return null when input is a non-integer number', () => {
    expect(parseBigInt(10.5)).to.be.null;
    expect(parseBigInt(Infinity)).to.be.null;
    expect(parseBigInt(-Infinity)).to.be.null;
    expect(parseBigInt(NaN)).to.be.null;
  });

  it('should return null when input is a non-integer string', () => {
    expect(parseBigInt('10.5')).to.be.null;
  });

  it('should return bigint when input is a string representation of an integer', () => {
    expect(parseBigInt('10')).to.deep.equal(BigInt(10));
  });

  it('should return bigint when input is a string representation of a negative integer', () => {
    expect(parseBigInt('-10')).to.deep.equal(BigInt(-10));
  });
});

describe('parseBigInt.orThrow', () => {
  it('should throw an error if the input cannot be a bigint', () => {
    expect(() => parseBigInt.orThrow(Number.MAX_SAFE_INTEGER + 1)).to.throw();
  });

  it('should return bigint if the input can be a bigint', () => {
    expect(parseBigInt.orThrow(10)).to.deep.equal(10n);
  });
});
