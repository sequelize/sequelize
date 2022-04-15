import type { Sequelize } from '@sequelize/core';
import { literal } from '@sequelize/core';
// eslint-disable-next-line import/order -- due to mismatching require with import (require is necessary until support is migrated to TS)
import { expect } from 'chai';

const Support = require('../support');

const current: Sequelize = Support.sequelize;

describe(Support.getTestDialectTeaser('Model.getInitialModel'), () => {
  const User = current.define('user', {}, {
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
