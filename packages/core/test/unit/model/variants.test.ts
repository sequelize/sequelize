import { literal } from '@sequelize/core';
import { expect } from 'chai';
import { sequelize } from '../../support';

describe('Model.getInitialModel', () => {
  it('always returns the initial model', () => {
    const User = sequelize.define(
      'User',
      {},
      {
        scopes: {
          scope1: {
            where: literal(''),
          },
        },
      },
    );

    expect(User.withSchema('abc').getInitialModel()).to.eq(User);
    expect(User.withSchema('abc').withScope('scope1').getInitialModel()).to.eq(User);
    expect(User.withScope('scope1').getInitialModel()).to.eq(User);
  });
});
