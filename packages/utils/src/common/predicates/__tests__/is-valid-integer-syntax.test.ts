import { isValidIntegerSyntax } from '@sequelize/utils';
import { expect } from 'chai';

describe('isValidIntegerSyntax', () => {
  it('returns true when input is a valid integer syntax', () => {
    expect(isValidIntegerSyntax('123')).to.be.true;
  });

  it('returns false when input is not a valid integer syntax', () => {
    expect(isValidIntegerSyntax('not an integer')).to.be.false;
    expect(isValidIntegerSyntax('')).to.be.false;
    expect(isValidIntegerSyntax('-')).to.be.false;
    expect(isValidIntegerSyntax(' 1')).to.be.false;
  });

  it('returns false when input is a valid integer syntax with scientific notation', () => {
    expect(isValidIntegerSyntax('1e2')).to.be.false;
  });

  it('returns false when input is a valid integer syntax with numeric separators', () => {
    expect(isValidIntegerSyntax('1_000')).to.be.false;
  });

  it('supports radixes', () => {
    expect(isValidIntegerSyntax('1010', 2)).to.be.true;
    expect(isValidIntegerSyntax('10102', 2)).to.be.false;

    expect(isValidIntegerSyntax('z', 36)).to.be.true;
    expect(isValidIntegerSyntax('z(', 36)).to.be.false;
  });

  it('is case insensitive', () => {
    expect(isValidIntegerSyntax('Ff', 16)).to.be.true;
  });

  it('throws if the radix is below 2 or above 36', () => {
    expect(() => isValidIntegerSyntax('123', 1)).to.throw();
    expect(() => isValidIntegerSyntax('123', 37)).to.throw();
  });
});
