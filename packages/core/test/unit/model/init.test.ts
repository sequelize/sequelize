import { expect } from 'chai';
import { Model } from '@sequelize/core';

describe('Uninitialized model', () => {
  class Test extends Model {}

  it('throws when constructed', () => {
    expect(() => Test.build()).to.throw(/has not been initialized/);
  });

  it('throws when .sequelize is accessed', () => {
    expect(() => Test.sequelize).to.throw(/has not been initialized/);
  });
});
