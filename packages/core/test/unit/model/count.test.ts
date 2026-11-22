import { DataTypes, Model } from '@sequelize/core';
import { expect } from 'chai';
import type { SinonStub } from 'sinon';
import sinon from 'sinon';
import { beforeAll2, sequelize } from '../../support';

describe('Model.count', () => {
  const vars = beforeAll2(() => {
    const oldFindAll = Model.findAll;
    const oldAggregate = Model.aggregate;

    Model.findAll = sinon.stub().resolves();

    const User = sequelize.define('User', {
      username: DataTypes.STRING,
      age: DataTypes.INTEGER,
    });
    const Project = sequelize.define('Project', {
      name: DataTypes.STRING,
    });

    User.hasMany(Project);
    Project.belongsTo(User);

    return { oldFindAll, oldAggregate, User, Project };
  });

  after(() => {
    Model.findAll = vars.oldFindAll;
    Model.aggregate = vars.oldAggregate;
  });

  let stub: SinonStub;
  beforeEach(() => {
    stub = sinon.stub().resolves();
    Model.aggregate = stub;
  });

  describe('should pass the same options to model.aggregate as findAndCountAll', () => {
    it('with includes', async () => {
      const queryObject = {
        include: [vars.Project],
      };
      await vars.User.count(queryObject);
      await vars.User.findAndCountAll(queryObject);
      const count = stub.getCall(0).args;
      const findAndCountAll = stub.getCall(1).args;
      expect(count).to.eql(findAndCountAll);
    });

    it('attributes should be stripped in case of findAndCountAll', async () => {
      const queryObject = {
        attributes: ['username'],
      };
      await vars.User.count(queryObject);
      await vars.User.findAndCountAll(queryObject);
      const count = stub.getCall(0).args;
      const findAndCountAll = stub.getCall(1).args;
      expect(count).not.to.eql(findAndCountAll);
      count[2].attributes = undefined;
      expect(count).to.eql(findAndCountAll);
    });
  });
});
