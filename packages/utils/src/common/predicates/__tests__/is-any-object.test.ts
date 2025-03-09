import { isAnyObject, upcast } from '@sequelize/utils';
import { expect } from 'chai';
import { expectTypeOf } from 'expect-type';

describe('isAnyObject', () => {
  it('returns true for plain objects', () => {
    expect(isAnyObject({})).to.be.true;
  });

  it('returns true for functions', () => {
    expect(isAnyObject(() => {})).to.be.true;
  });

  it('returns true for non-plain objects', () => {
    expect(isAnyObject(new Date())).to.be.true;
    expect(isAnyObject([1, 2, 3])).to.be.true;
  });

  it('returns false for primitives', () => {
    expect(isAnyObject(null)).to.be.false;
    expect(isAnyObject(42)).to.be.false;
    expect(isAnyObject('string')).to.be.false;
    expect(isAnyObject(true)).to.be.false;
    expect(isAnyObject(undefined)).to.be.false;
    expect(isAnyObject(Symbol('symbol'))).to.be.false;
    expect(isAnyObject(123n)).to.be.false;
  });

  it('narrows the TypeScript type', () => {
    const value = upcast<Date | null>(null);
    if (isAnyObject(value)) {
      expectTypeOf(value).toEqualTypeOf<Date>();
    } else {
      expectTypeOf(value).toEqualTypeOf<null>();
    }
  });
});
