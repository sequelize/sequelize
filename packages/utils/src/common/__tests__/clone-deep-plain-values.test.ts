import { cloneDeepPlainValues } from '@sequelize/utils';
import { expect } from 'chai';

describe('cloneDeepPlainValues', () => {
  it('should clone plain values', () => {
    const value = { a: 1, b: 2 };
    const clonedValue = cloneDeepPlainValues(value);
    expect(clonedValue).to.deep.equal(value);
    expect(clonedValue).not.to.equal(value);
  });

  it('should clone arrays', () => {
    const value = [1, 2, 3];
    const clonedValue = cloneDeepPlainValues(value);
    expect(clonedValue).to.deep.equal(value);
    expect(clonedValue).not.to.equal(value);
  });

  it('should clone nested structures', () => {
    const value = { a: { b: { c: 1 } } };
    const clonedValue = cloneDeepPlainValues(value);
    expect(clonedValue).to.deep.equal(value);
    expect(clonedValue).not.to.equal(value);
  });

  it('should transfer unclonable values when flag is set', () => {
    const value = { a: new Map() };
    const clonedValue = cloneDeepPlainValues(value, true);
    expect(clonedValue).to.deep.equal(value);
    expect(clonedValue).not.to.equal(value);
    expect(clonedValue.a).to.equal(value.a);
  });

  it('should throw an error when encountering unclonable values and the transfer flag is not set', () => {
    const value = { a: new Map() };
    expect(() => cloneDeepPlainValues(value)).to.throw();
  });
});
