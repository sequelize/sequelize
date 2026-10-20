import { Model as BaseModel, DataTypes, Op } from '@sequelize/core';
import { expect } from 'chai';
import type { SinonStub } from 'sinon';
import sinon from 'sinon';
import { sequelize } from '../../support';

describe('Model.findOne', () => {
  const oldFindAll = BaseModel.findAll;
  after(() => {
    BaseModel.findAll = oldFindAll;
  });

  let stub: SinonStub;
  beforeEach(() => {
    stub = sinon.stub().resolves();
    BaseModel.findAll = stub;
  });

  it('should add limit when using { $ gt on the primary key', async () => {
    const Model = sequelize.define('model');

    await Model.findOne({ where: { id: { [Op.gt]: 42 } } });
    expect(stub.getCall(0).args[0]).to.be.an('object').to.have.property('limit');
  });

  it('should add limit when using multi-column unique key', async () => {
    const Model = sequelize.define('model', {
      unique1: {
        type: DataTypes.INTEGER,
        unique: 'unique',
      },
      unique2: {
        type: DataTypes.INTEGER,
        unique: 'unique',
      },
    });

    await Model.findOne({ where: { unique1: 42 } });
    expect(stub.getCall(0).args[0]).to.be.an('object').to.have.property('limit');
  });
  it('should call internal findAll() method if findOne() is overridden', async () => {
    const Model = sequelize.define('model', {
      unique1: {
        type: DataTypes.INTEGER,
        unique: 'unique',
      },
      unique2: {
        type: DataTypes.INTEGER,
        unique: 'unique',
      },
    });
    Model.findAll = sinon.stub();

    await Model.findOne();
    expect(Model.findAll).not.to.have.been.called;
    expect(BaseModel.findAll).to.have.been.called;
  });
});
