'use strict';

const Support = require('../../support');

const current = Support.sequelize;
const sinon = require('sinon');
const { DataTypes, Sequelize } = require('@sequelize/core');
const { expect } = require('chai');

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('method findByPk', () => {
    beforeEach(function () {
      this.stub = sinon.stub(Sequelize.Model, 'findAll').resolves();
    });
    afterEach(() => {
      sinon.restore();
    });

    it('should call internal findOne() method if findOne() is overridden', async () => {
      const Model = current.define('model', {
        unique1: {
          type: DataTypes.INTEGER,
          unique: 'unique',
        },
        unique2: {
          type: DataTypes.INTEGER,
          unique: 'unique',
        },
      });
      Model.findOne = sinon.stub();
      sinon.spy(Sequelize.Model, 'findOne');

      await Model.findByPk(1);
      Model.findOne.should.not.have.been.called;
      Sequelize.Model.findOne.should.have.been.called;
    });

    it('should use composite primary key when querying table has one', async () => {
      const Model = current.define('model', {
        pk1: {
          type: DataTypes.INTEGER,
          primaryKey: true,
        },
        pk2: {
          type: DataTypes.INTEGER,
          primaryKey: true,
        },
      });

      sinon.stub(Model, 'findOne');
      const findOneSpy = sinon.spy(Sequelize.Model, 'findOne');

      await Model.findByPk({ pk1: 1, pk2: 2 });
      findOneSpy.should.have.been.calledWithMatch({
        where: { pk1: 1, pk2: 2 },
      });
    });

    it('should throw error if composite primary key args not match key', async () => {
      const Model = current.define('model', {
        pk1: {
          type: DataTypes.INTEGER,
          primaryKey: true,
        },
        pk2: {
          type: DataTypes.INTEGER,
          primaryKey: true,
        },
      });

      expect(Model.findByPk({ pk1: 1 })).to.eventually.be.rejectedWith(TypeError);
    });

    it('should throw error if wrong type passed and model has composite primary key', async () => {
      const Model = current.define('model', {
        pk1: {
          type: DataTypes.INTEGER,
          primaryKey: true,
        },
        pk2: {
          type: DataTypes.INTEGER,
          primaryKey: true,
        },
      });

      expect(Model.findByPk(1)).to.eventually.be.rejectedWith(TypeError);
    });
  });
});
