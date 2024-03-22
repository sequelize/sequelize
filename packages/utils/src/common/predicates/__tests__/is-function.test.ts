import { isFunction, upcast } from '@sequelize/utils';
import { expect } from 'chai';
import { expectTypeOf } from 'expect-type';

describe('isFunction', () => {
  it('returns true for function', () => {
    expect(isFunction(() => {})).to.be.true;
  });

  it('returns true for class', () => {
    class Test {}

    expect(isFunction(Test)).to.be.true;
  });

  it('returns false for non-function', () => {
    expect(isFunction({})).to.be.false;
  });

  it('narrows the TypeScript type', () => {
    const value = upcast<Function | null>(null);
    if (isFunction(value)) {
      expectTypeOf(value).toEqualTypeOf<Function>();
    } else {
      expectTypeOf(value).toEqualTypeOf<null>();
    }
  });
});
