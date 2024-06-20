import { inspect } from '@sequelize/utils';
import { expect } from 'chai';

describe('inspect function', () => {
  it('supports primitives', () => {
    expect(inspect(123)).to.equal('123');
    expect(inspect(123n)).to.equal('123n');
    expect(inspect(null)).to.equal('null');
    expect(inspect(undefined)).to.equal('undefined');
    expect(inspect(true)).to.equal('true');
    expect(inspect(false)).to.equal('false');
    expect(inspect(Symbol('test'))).to.equal('Symbol(test)');
    expect(inspect('test')).to.equal('"test"');
  });

  it('returns a function representation when the input is a function', () => {
    const input = function test() {};

    const result = inspect(input);
    expect(result).to.equal('[function test]');
  });

  it('supports anonymous functions', () => {
    const result = inspect(() => {});
    expect(result).to.equal('[function (anonymous)]');
  });

  it('returns an object representation when the input is an object', () => {
    expect(inspect({ key: 'value' })).to.equal('[object Object]');
    expect(inspect(new Date())).to.equal('[object Date]');
  });
});
