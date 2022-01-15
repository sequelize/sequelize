'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../support');

const Sequelize = Support.Sequelize;
const Op = Sequelize.Op;
const current = Support.sequelize;
const sinon = require('sinon');
const DataTypes = require('../../../lib/data-types');

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
  });
});
