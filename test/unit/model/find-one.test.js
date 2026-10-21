'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../support'),
  Sequelize = Support.Sequelize,
  Op = Sequelize.Op,
  current = Support.sequelize,
  sinon = require('sinon'),
  DataTypes = require('sequelize/lib/data-types');

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('method findOne', () => {
    before(function() {
      this.oldFindAll = Sequelize.Model.findAll;
    });
    after(function() {
      Sequelize.Model.findAll = this.oldFindAll;
    });

    beforeEach(function() {
      this.stub = Sequelize.Model.findAll = sinon.stub().resolves();
    });

    it('should add limit when using { $ gt on the primary key', async function() {
      const Model = current.define('model');

      await Model.findOne({ where: { id: { [Op.gt]: 42 } } });
      expect(this.stub.getCall(0).args[0]).to.be.an('object').to.have.property('limit');
    });

    it('should add limit when using multi-column unique key', async function() {
      const Model = current.define('model', {
        unique1: {
          type: DataTypes.INTEGER,
          unique: 'unique'
        },
        unique2: {
          type: DataTypes.INTEGER,
          unique: 'unique'
        }
      });

      await Model.findOne({ where: { unique1: 42 } });
      expect(this.stub.getCall(0).args[0]).to.be.an('object').to.have.property('limit');
    });
  });
});
