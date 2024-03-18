import type { AnyRecord } from '@sequelize/utils';
import { isPlainObject, pojo, upcast } from '@sequelize/utils';
import { expect } from 'chai';
import { expectTypeOf } from 'expect-type';

describe('isPlainObject', () => {
  it('returns true for plain object (Object prototype or null prototype)', () => {
    expect(isPlainObject({})).to.be.true;
    expect(isPlainObject(pojo())).to.be.true;
  });

  it('returns false for non-plain object', () => {
    expect(isPlainObject(42)).to.be.false;
    expect(isPlainObject('42')).to.be.false;
    expect(isPlainObject(() => {})).to.be.false;
    expect(isPlainObject(new Date())).to.be.false;
    expect(isPlainObject([])).to.be.false;
  });

  it('narrows the TypeScript type', () => {
    const value = upcast<AnyRecord | null>(null);
    if (isPlainObject(value)) {
      expectTypeOf(value).toEqualTypeOf<AnyRecord>();
    } else {
      expectTypeOf(value).toEqualTypeOf<null>();
    }
  });
});
