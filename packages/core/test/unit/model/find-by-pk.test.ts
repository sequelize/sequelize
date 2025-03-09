import { DataTypes, Model } from '@sequelize/core';

import { getTestDialectTeaser, sequelize } from '../../support';

import { expect } from 'chai';

import sinon from 'sinon';

describe(getTestDialectTeaser('Model'), () => {
  describe('findByPk', () => {
    beforeEach(() => {
      sinon.stub(Model, 'findAll').resolves();
    });

    afterEach(() => {
      sinon.restore();
    });

    it('should call internal findOne() method if findOne() is overridden', async () => {
      const testModel = sequelize.define('model', {
        unique1: {
          type: DataTypes.INTEGER,
          unique: 'unique',
        },
        unique2: {
          type: DataTypes.INTEGER,
          unique: 'unique',
        },
      });
      testModel.findOne = sinon.stub();

      sinon.spy(Model, 'findOne');

      await testModel.findByPk(1);
      testModel.findOne.should.not.have.been.called;
      Model.findOne.should.have.been.called;
    });

    it('should use composite primary key when querying table has one', async () => {
      const testModel = sequelize.define('model', {
        pk1: {
          type: DataTypes.INTEGER,
          primaryKey: true,
        },
        pk2: {
          type: DataTypes.INTEGER,
          primaryKey: true,
        },
      });

      const findOneSpy = sinon.spy(Model, 'findOne');
      await testModel.findByPk({ pk1: 1, pk2: 2 });
      findOneSpy.should.have.been.calledWithMatch({
        where: { pk1: 1, pk2: 2 },
      });
    });

    it('should throw error if composite primary key args not match key', async () => {
      const testModel = sequelize.define('model', {
        pk1: {
          type: DataTypes.INTEGER,
          primaryKey: true,
        },
        pk2: {
          type: DataTypes.INTEGER,
          primaryKey: true,
        },
      });

      await expect(testModel.findByPk({ pk1: 1 })).to.eventually.be.rejectedWith(TypeError);
    });

    it('should throw error if wrong type passed and model has composite primary key', async () => {
      const testModel = sequelize.define('model', {
        pk1: {
          type: DataTypes.INTEGER,
          primaryKey: true,
        },
        pk2: {
          type: DataTypes.INTEGER,
          primaryKey: true,
        },
      });

      await expect(testModel.findByPk(1)).to.eventually.be.rejectedWith(TypeError);
    });
  });
});
