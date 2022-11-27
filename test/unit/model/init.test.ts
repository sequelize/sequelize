import { Model } from '@sequelize/core';
import { expect } from 'chai';

describe('Uninitialized model', () => {
  class Test extends Model {}

  it('throws when constructed', () => {
    expect(() => new Test()).to.throw(/has not been initialized/);
  });

  it('throws when .sequelize is accessed', () => {
    expect(() => Test.sequelize).to.throw(/has not been initialized/);
  });

  it('does not throw if the method does not need Sequelize', () => {
    expect(() => Test.beforeCreate(() => {})).not.to.throw();
  });
});
