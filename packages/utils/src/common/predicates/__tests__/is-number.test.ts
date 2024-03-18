import { isNumber, upcast } from '@sequelize/utils';
import { expect } from 'chai';
import { expectTypeOf } from 'expect-type';

describe('isNumber', () => {
  it('returns true for number', () => {
    expect(isNumber(42)).to.be.true;
  });

  it('returns false for non-number', () => {
    expect(isNumber('42')).to.be.false;
    expect(isNumber(42n)).to.be.false;
  });

  it('narrows the TypeScript type', () => {
    const value = upcast<number | null>(null);
    if (isNumber(value)) {
      expectTypeOf(value).toEqualTypeOf<number>();
    } else {
      expectTypeOf(value).toEqualTypeOf<null>();
    }
  });
});
