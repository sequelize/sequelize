import { isNullish, upcast } from '@sequelize/utils';
import { expect } from 'chai';
import { expectTypeOf } from 'expect-type';

describe('isNullish', () => {
  it('returns true for null and undefined', () => {
    expect(isNullish(null)).to.be.true;
    expect(isNullish(undefined)).to.be.true;
  });

  it('returns false for non-nullish', () => {
    expect(isNullish(0)).to.be.false;
    expect(isNullish('')).to.be.false;
    expect(isNullish(false)).to.be.false;
    expect(isNullish(NaN)).to.be.false;
  });

  it('narrows the TypeScript type', () => {
    const value = upcast<null | undefined | number>(42);
    if (isNullish(value)) {
      expectTypeOf(value).toEqualTypeOf<null | undefined>();
    } else {
      expectTypeOf(value).toEqualTypeOf<number>();
    }
  });
});
