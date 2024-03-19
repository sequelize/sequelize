import { isBigInt, upcast } from '@sequelize/utils';
import { expect } from 'chai';
import { expectTypeOf } from 'expect-type';

describe('isBigInt', () => {
  it('returns true for bigint', () => {
    expect(isBigInt(123n)).to.be.true;
  });

  it('returns false for non-bigint', () => {
    expect(isBigInt(42)).to.be.false;
    expect(isBigInt('42')).to.be.false;
    expect(
      isBigInt({
        [Symbol.toPrimitive]() {
          return 42n;
        },
      }),
    ).to.be.false;
  });

  it('narrows the TypeScript type', () => {
    const value = upcast<bigint | null>(null);
    if (isBigInt(value)) {
      expectTypeOf(value).toEqualTypeOf<bigint>();
    } else {
      expectTypeOf(value).toEqualTypeOf<null>();
    }
  });
});
