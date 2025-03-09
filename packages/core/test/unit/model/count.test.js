'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../../support');

const current = Support.sequelize;
const sinon = require('sinon');
const { DataTypes, Model } = require('@sequelize/core');

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('method count', () => {
    before(function () {
      this.oldFindAll = Model.findAll;
      this.oldAggregate = Model.aggregate;

      Model.findAll = sinon.stub().resolves();

      this.User = current.define('User', {
        username: DataTypes.STRING,
        age: DataTypes.INTEGER,
      });
      this.Project = current.define('Project', {
        name: DataTypes.STRING,
      });

      this.User.hasMany(this.Project);
      this.Project.belongsTo(this.User);
    });

    after(function () {
      Model.findAll = this.oldFindAll;
      Model.aggregate = this.oldAggregate;
    });

    beforeEach(function () {
      this.stub = Model.aggregate = sinon.stub().resolves();
    });

    describe('should pass the same options to model.aggregate as findAndCountAll', () => {
      it('with includes', async function () {
        const queryObject = {
          include: [this.Project],
        };
        await this.User.count(queryObject);
        await this.User.findAndCountAll(queryObject);
        const count = this.stub.getCall(0).args;
        const findAndCountAll = this.stub.getCall(1).args;
        expect(count).to.eql(findAndCountAll);
      });

      it('attributes should be stripped in case of findAndCountAll', async function () {
        const queryObject = {
          attributes: ['username'],
        };
        await this.User.count(queryObject);
        await this.User.findAndCountAll(queryObject);
        const count = this.stub.getCall(0).args;
        const findAndCountAll = this.stub.getCall(1).args;
        expect(count).not.to.eql(findAndCountAll);
        count[2].attributes = undefined;
        expect(count).to.eql(findAndCountAll);
      });
    });
  });
});
