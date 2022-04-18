import { literal } from '@sequelize/core';
import { expect } from 'chai';
import { sequelize, getTestDialectTeaser } from '../../support';

describe(getTestDialectTeaser('Model.getInitialModel'), () => {
  const User = sequelize.define('user', {}, {
    scopes: {
      scope1: {
        where: literal(''),
      },
    },
  });

  it('always returns the initial model', () => {
    expect(User.withSchema('abc').getInitialModel()).to.eq(User);
    expect(User.withSchema('abc').withScope('scope1').getInitialModel()).to.eq(User);
    expect(User.withScope('scope1').getInitialModel()).to.eq(User);
  });
});
