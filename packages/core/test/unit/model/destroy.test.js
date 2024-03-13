'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../../support');

const current = Support.sequelize;
const sinon = require('sinon');
const { DataTypes } = require('@sequelize/core');

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('method destroy', () => {
    const User = current.define('User', {
      name: DataTypes.STRING,
      secretValue: DataTypes.INTEGER,
    });

    before(function () {
      this.stubDelete = sinon.stub(current, 'queryRaw').resolves([]);
    });

    beforeEach(function () {
      this.deloptions = { where: { secretValue: '1' } };
      this.cloneOptions = { ...this.deloptions };
      this.stubDelete.resetHistory();
    });

    afterEach(function () {
      delete this.deloptions;
      delete this.cloneOptions;
    });

    after(function () {
      this.stubDelete.restore();
    });

    it('can detect complex objects', async () => {
      const Where = function () {
        this.secretValue = '1';
      };

      await expect(User.destroy({ where: new Where() })).to.be.rejected;
    });
  });
});
