import { isString, upcast } from '@sequelize/utils';
import { expect } from 'chai';
import { expectTypeOf } from 'expect-type';

describe('isString', () => {
  it('returns true for string', () => {
    expect(isString('string')).to.be.true;
  });

  it('returns false for non-string', () => {
    expect(isString(42)).to.be.false;
    expect(
      isString({
        [Symbol.toPrimitive]() {
          return 'test';
        },
      }),
    ).to.be.false;
  });

  it('narrows the TypeScript type', () => {
    const value = upcast<string | null>(null);
    if (isString(value)) {
      expectTypeOf(value).toEqualTypeOf<string>();
    } else {
      expectTypeOf(value).toEqualTypeOf<null>();
    }
  });
});
