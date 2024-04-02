import { isError, upcast } from '@sequelize/utils';
import { expect } from 'chai';
import { expectTypeOf } from 'expect-type';

describe('isError', () => {
  it('returns true for Error', () => {
    expect(isError(new Error('test'))).to.be.true;
  });

  it('returns true for Error subclasses', () => {
    expect(isError(new TypeError('test'))).to.be.true;
  });

  it('returns false for non-Error', () => {
    expect(isError({})).to.be.false;
  });

  it('narrows the TypeScript type', () => {
    const value = upcast<Error | null>(null);
    if (isError(value)) {
      expectTypeOf(value).toEqualTypeOf<Error>();
    } else {
      expectTypeOf(value).toEqualTypeOf<null>();
    }
  });
});
