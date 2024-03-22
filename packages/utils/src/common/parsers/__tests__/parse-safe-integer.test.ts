import { parseSafeInteger } from '@sequelize/utils';
import { expect } from 'chai';

describe('parseSafeInteger', () => {
  it('returns null when input is not a valid integer syntax', () => {
    expect(parseSafeInteger('not an integer')).to.be.null;
    expect(parseSafeInteger('')).to.be.null;
    expect(parseSafeInteger('-')).to.be.null;
    expect(parseSafeInteger(' -1')).to.be.null;
  });

  it('returns null when input is an unsafe integer', () => {
    expect(parseSafeInteger('9007199254740992')).to.be.null;
    expect(parseSafeInteger('-9007199254740992')).to.be.null;

    expect(parseSafeInteger(9_007_199_254_740_992n)).to.be.null;
    expect(parseSafeInteger(-9_007_199_254_740_992n)).to.be.null;
  });

  it('returns a number when input is a valid integer string', () => {
    expect(parseSafeInteger('123')).to.equal(123);
    expect(parseSafeInteger('-123')).to.equal(-123);
  });

  it('returns a number when input is a safe bigint', () => {
    expect(parseSafeInteger(123n)).to.equal(123);
    expect(parseSafeInteger(-123n)).to.equal(-123);
  });

  it('returns null when input is a non-integer number', () => {
    expect(parseSafeInteger('123.456')).to.be.null;
  });

  it('returns a number if the input contains the scientific notation in base 10', () => {
    expect(parseSafeInteger('1e3')).to.equal(1e3);
    expect(parseSafeInteger('1e3', 10)).to.equal(1e3);
  });

  it('returns null if the input contains the scientific notation in base other than 10', () => {
    // note: for radix 15 and above, the letter "e" is a valid digit so this would be a valid number,
    // but not one written in the scientific notation.
    expect(parseSafeInteger('1e3', 8)).to.equal(null);
  });

  it('returns null if the input contains a numeric separator', () => {
    // opt-in support could be added in the future, as well as localized separators
    expect(parseSafeInteger('1_000')).to.be.null;
  });

  it('returns a number when input is a valid base 2 integer', () => {
    expect(parseSafeInteger('1010', 2)).to.equal(0b1010);
  });

  it('returns null when input is a valid base 2 integer with invalid characters', () => {
    expect(parseSafeInteger('10102', 2)).to.be.null;
  });

  it('returns a number when input is a valid base 8 integer', () => {
    expect(parseSafeInteger('0755', 8)).to.equal(0o0755);
  });

  it('returns null when input is a valid base 8 integer with invalid characters', () => {
    expect(parseSafeInteger('0758', 8)).to.be.null;
  });

  it('returns a number when input is a valid base 16 integer', () => {
    expect(parseSafeInteger('ffffff', 16)).to.equal(0xff_ff_ff);
  });

  it('returns null if the number includes a prefix', () => {
    // could be supported one day using the "auto" radix (which would support 0x, 0b, 0o prefixes, and base 10 without prefix)
    expect(parseSafeInteger('0xffffff', 16)).to.be.null;
    expect(parseSafeInteger('0xffffff')).to.be.null;
  });

  it('returns null when input is a valid base 16 integer with invalid characters', () => {
    expect(parseSafeInteger('fffg', 16)).to.be.null;
  });

  it('is case insensitive', () => {
    expect(parseSafeInteger('Ff', 16)).to.equal(0xff);
  });

  it('returns a number when input is a valid base 36 integer', () => {
    expect(parseSafeInteger('z', 36)).to.equal(35);
  });

  it('returns null when input is a valid base 36 integer with invalid characters', () => {
    expect(parseSafeInteger('z(', 36)).to.be.null;
  });

  it('throws when radix is less than 2 or more than 36', () => {
    expect(() => parseSafeInteger('123', 1)).to.throw();
    expect(() => parseSafeInteger('123', 37)).to.throw();
  });
});

describe('parseSafeInteger.orThrow', () => {
  it('throws an error when the input is not parseable as a safe integer', () => {
    expect(() => parseSafeInteger.orThrow('not an integer')).to.throw();
  });

  it('returns the parsed number when the input is parseable as a safe integer', () => {
    expect(parseSafeInteger.orThrow('123')).to.equal(123);
  });
});
