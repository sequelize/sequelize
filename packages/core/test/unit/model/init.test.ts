import { Model } from '@sequelize/core';
import { expect } from 'chai';
import { sequelize } from '../../support';

describe('Uninitialized model', () => {
  class Test extends Model {}

  it('throws when constructed', () => {
    expect(() => Test.build()).to.throw(/has not been initialized/);
  });

  it('throws when .sequelize is accessed', () => {
    expect(() => Test.sequelize).to.throw(/has not been initialized/);
  });
});

describe('Initialized model', () => {
  it('throws if initialized twice', () => {
    class Test extends Model {}

    Test.init({}, { sequelize });

    expect(() => {
      Test.init({}, { sequelize });
    }).to.throw(/already been initialized/);
  });
});
