import { DataTypes, Model, Op } from '@sequelize/core';

import { getTestDialectTeaser, sequelize } from '../../support';

import { expect } from 'chai';

import sinon from 'sinon';

describe(getTestDialectTeaser('Model'), () => {
  describe('findByPks', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should return empty array for empty input', async () => {
      const testModel = sequelize.define('model', {
        name: DataTypes.STRING,
      });

      const result = await testModel.findByPks([]);
      expect(result).to.deep.equal([]);
    });

    it('should call internal findAll() even if findAll() is overridden', async () => {
      const testModel = sequelize.define('model', {
        name: DataTypes.STRING,
      });

      testModel.findAll = sinon.stub();
      sinon.stub(Model, 'findAll').resolves([]);

      await testModel.findByPks([1, 2]);
      testModel.findAll.should.not.have.been.called;
      Model.findAll.should.have.been.called;
    });

    it('should use Op.in for single primary key', async () => {
      const testModel = sequelize.define('model', {
        name: DataTypes.STRING,
      });

      const findAllSpy = sinon.stub(Model, 'findAll').resolves([]);

      await testModel.findByPks([1, 2, 3]);
      const callArgs = findAllSpy.getCall(0).args[0];
      expect(callArgs.where).to.deep.equal({ id: { [Op.in]: [1, 2, 3] } });
    });

    it('should handle composite primary keys', async () => {
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

      const findAllSpy = sinon.stub(Model, 'findAll').resolves([]);

      await testModel.findByPks([
        { pk1: 1, pk2: 10 },
        { pk1: 2, pk2: 20 },
      ]);

      expect(findAllSpy.calledOnce).to.equal(true);
    });

    it('should throw if non-array is passed', async () => {
      const testModel = sequelize.define('model', {
        name: DataTypes.STRING,
      });

      // @ts-expect-error -- testing runtime validation
      await expect(testModel.findByPks('not an array')).to.eventually.be.rejectedWith(TypeError);
    });

    it('should throw for composite key when identifier is not an object', async () => {
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

      sinon.stub(Model, 'findAll').resolves([]);

      await expect(testModel.findByPks([1, 2])).to.eventually.be.rejectedWith(TypeError);
    });

    it('should throw for composite key when part of key is missing', async () => {
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

      sinon.stub(Model, 'findAll').resolves([]);

      await expect(
        testModel.findByPks([{ pk1: 1 }]),
      ).to.eventually.be.rejectedWith(TypeError);
    });

    it('should merge with existing where clause', async () => {
      const testModel = sequelize.define('model', {
        name: DataTypes.STRING,
        active: DataTypes.BOOLEAN,
      });

      const findAllSpy = sinon.stub(Model, 'findAll').resolves([]);

      await testModel.findByPks([1, 2], { where: { active: true } });

      expect(findAllSpy.calledOnce).to.equal(true);
    });

    it('should throw if model has no primary key', async () => {
      const testModel = sequelize.define(
        'model',
        {
          name: DataTypes.STRING,
        },
        { noPrimaryKey: true },
      );

      await expect(testModel.findByPks([1])).to.eventually.be.rejectedWith(
        Error,
        'does not have a primary key',
      );
    });
  });
});
