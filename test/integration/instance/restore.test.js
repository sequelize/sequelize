'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../support');
const { DataTypes } = require('@sequelize/core');
const sinon = require('sinon');

const current = Support.sequelize;

describe(Support.getTestDialectTeaser('Instance'), () => {
  before(function () {
    this.clock = sinon.useFakeTimers();
  });

  afterEach(function () {
    this.clock.reset();
  });

  after(function () {
    this.clock.restore();
  });

  describe('restore', () => {
    it('is disallowed if no primary key is present', async function () {
      const User = this.sequelize.define('User', {
        name: { type: DataTypes.STRING },
      }, { noPrimaryKey: true, paranoid: true });
      await User.sync({ force: true });

      const instance = await User.create({});
      await expect(instance.restore()).to.be.rejectedWith('but the model does not have a primary key attribute definition.');
    });
  });
});
