import { isIterable, upcast } from '@sequelize/utils';
import { expect } from 'chai';
import { expectTypeOf } from 'expect-type';

describe('isIterable', () => {
  it('returns true for iterables', () => {
    expect(isIterable([])).to.be.true;
    expect(isIterable('string')).to.be.true;
    expect(isIterable(new Map())).to.be.true;
    expect(isIterable(new Set())).to.be.true;
  });

  it('returns false for non-iterables', () => {
    expect(isIterable(42)).to.be.false;
  });

  it('narrows the TypeScript type', () => {
    const value = upcast<Iterable<string> | null>(null);
    if (isIterable(value)) {
      expectTypeOf(value).toEqualTypeOf<Iterable<string>>();
    } else {
      expectTypeOf(value).toEqualTypeOf<null>();
    }
  });
});
