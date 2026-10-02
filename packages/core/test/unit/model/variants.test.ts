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

describe('Model.withSchema / Model.withScope registry', () => {
  it('does not replace the initial model in sequelize.models', () => {
    const User = sequelize.define('User', {}, { scopes: { scope1: { where: literal('') } } });

    User.withSchema('abc');
    User.withScope('scope1');

    expect(sequelize.models.get('User')).to.eq(User);
  });
});
