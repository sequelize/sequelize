'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../support'),
  Sequelize = Support.Sequelize,
  current = Support.sequelize,
  sinon = require('sinon'),
  DataTypes = require('sequelize/lib/data-types');

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('method count', () => {
    before(function() {
      this.oldFindAll = Sequelize.Model.findAll;
      this.oldAggregate = Sequelize.Model.aggregate;

      Sequelize.Model.findAll = sinon.stub().resolves();

      this.User = current.define('User', {
        username: DataTypes.STRING,
        age: DataTypes.INTEGER
      });
      this.Project = current.define('Project', {
        name: DataTypes.STRING
      });

      this.User.hasMany(this.Project);
      this.Project.belongsTo(this.User);
    });

    after(function() {
      Sequelize.Model.findAll = this.oldFindAll;
      Sequelize.Model.aggregate = this.oldAggregate;
    });

    beforeEach(function() {
      this.stub = Sequelize.Model.aggregate = sinon.stub().resolves();
    });

    describe('should pass the same options to model.aggregate as findAndCountAll', () => {
      it('with includes', async function() {
        const queryObject = {
          include: [this.Project]
        };
        await this.User.count(queryObject);
        await this.User.findAndCountAll(queryObject);
        const count = this.stub.getCall(0).args;
        const findAndCountAll = this.stub.getCall(1).args;
        expect(count).to.eql(findAndCountAll);
      });

      it('attributes should be stripped in case of findAndCountAll', async function() {
        const queryObject = {
          attributes: ['username']
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
