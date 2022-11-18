'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../../support');

const current = Support.sequelize;
const sinon = require('sinon');
const { DataTypes } = require('@sequelize/core');

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('findAndCountAll', () => {
    describe('should handle promise rejection', () => {
      before(function () {
        this.stub = sinon.stub();

        process.on('unhandledRejection', this.stub);

        this.User = current.define('User', {
          username: DataTypes.STRING,
          age: DataTypes.INTEGER,
        });

        this.findAll = sinon.stub(this.User, 'findAll').rejects(new Error());

        this.count = sinon.stub(this.User, 'count').rejects(new Error());
      });

      after(function () {
        this.findAll.resetBehavior();
        this.count.resetBehavior();
      });

      it('with errors in count and findAll both', async function () {
        try {
          await this.User.findAndCountAll({});
          throw new Error();
        } catch {
          expect(this.stub.callCount).to.eql(0);
        }
      });
    });
  });
});
