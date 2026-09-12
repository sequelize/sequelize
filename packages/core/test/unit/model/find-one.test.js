'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../../support');

const current = Support.sequelize;
const sinon = require('sinon');
const { DataTypes, Model, Op } = require('@sequelize/core');

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('method findOne', () => {
    before(function () {
      this.oldFindAll = Model.findAll;
    });

    after(function () {
      Model.findAll = this.oldFindAll;
    });

    beforeEach(function () {
      this.stub = Model.findAll = sinon.stub().resolves();
    });

    it('should add limit when using { $ gt on the primary key', async function () {
      const Model = current.define('model');

      await Model.findOne({ where: { id: { [Op.gt]: 42 } } });
      expect(this.stub.getCall(0).args[0]).to.be.an('object').to.have.property('limit');
    });

    it('should add limit when using multi-column unique key', async function () {
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

      await Model.findOne({ where: { unique1: 42 } });
      expect(this.stub.getCall(0).args[0]).to.be.an('object').to.have.property('limit');
    });

    it('should call internal findAll() method if findOne() is overridden', async () => {
      const MyModel = current.define('MyModel', {
        unique1: {
          type: DataTypes.INTEGER,
          unique: 'unique',
        },
        unique2: {
          type: DataTypes.INTEGER,
          unique: 'unique',
        },
      });
      MyModel.findAll = sinon.stub();

      await MyModel.findOne();
      MyModel.findAll.should.not.have.been.called;
      Model.findAll.should.have.been.called;
    });
  });
});
