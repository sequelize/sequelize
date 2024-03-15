import { freezeDeep, freezeDescendants } from '@sequelize/utils';
import { expect } from 'chai';

describe('freezeDeep', () => {
  it('should freeze a plain object', () => {
    const obj = { a: 1, b: 2 };
    const result = freezeDeep(obj);
    expect(Object.isFrozen(result)).to.equal(true);
  });

  it('should freeze nested objects', () => {
    const obj = { a: 1, b: { c: 3 } };
    const result = freezeDeep(obj);
    expect(Object.isFrozen(result.b)).to.equal(true);
  });

  it('should not freeze non-plain objects', () => {
    const obj = { a: 1, b: new Date() };
    const result = freezeDeep(obj);
    expect(Object.isFrozen(result.b)).to.equal(false);
  });
});

describe('freezeDescendants', () => {
  it('should freeze descendants of an object', () => {
    const obj = { a: 1, b: { c: 3 } };
    const result = freezeDescendants(obj);
    expect(Object.isFrozen(result)).to.equal(false);
    expect(Object.isFrozen(result.b)).to.equal(true);
  });

  it('should not freeze non-plain object descendants', () => {
    const obj = { a: new Date() };
    const result = freezeDescendants(obj);
    expect(Object.isFrozen(result.a)).to.equal(false);
  });
});
