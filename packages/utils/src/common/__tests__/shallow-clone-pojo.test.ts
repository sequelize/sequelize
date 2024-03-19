import { shallowClonePojo } from '@sequelize/utils';
import { expect } from 'chai';

describe('shallowClonePojo', () => {
  it('returns a shallow copy of the provided object', () => {
    const obj = { a: 1, b: 2 };
    const clonedObj = shallowClonePojo(obj);
    expect(clonedObj).to.deep.equal(obj);
    expect(clonedObj).to.not.equal(obj);
  });

  it('does not copy nested objects', () => {
    const obj = { a: 1, b: { c: 3 } };
    const clonedObj = shallowClonePojo(obj);
    expect(clonedObj.b).to.equal(obj.b);
  });

  it('throws an error when provided a non-plain object', () => {
    const nonPlainObject = new Date();
    expect(() => shallowClonePojo(nonPlainObject)).to.throw();
  });
});
