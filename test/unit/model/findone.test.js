'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../support'),
  Sequelize = Support.Sequelize,
  Op = Sequelize.Op,
  current = Support.sequelize,
  sinon = require('sinon'),
  DataTypes = require('../../../lib/data-types');

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

    describe('should not add limit when querying on a primary key', () => {
      it('with id primary key', function() {
        const Model = current.define('model');

        return Model.findOne({ where: { id: 42 } }).then(() => {
          expect(this.stub.getCall(0).args[0]).to.be.an('object').not.to.have.property('limit');
        });
      });

      it('with custom primary key', function() {
        const Model = current.define('model', {
          uid: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
          }
        });

        return Model.findOne({ where: { uid: 42 } }).then(() => {
          expect(this.stub.getCall(0).args[0]).to.be.an('object').not.to.have.property('limit');
        });
      });

      it('with blob primary key', function() {
        const Model = current.define('model', {
          id: {
            type: DataTypes.BLOB,
            primaryKey: true,
            autoIncrement: true
          }
        });

        return Model.findOne({ where: { id: Buffer.from('foo') } }).then(() => {
          expect(this.stub.getCall(0).args[0]).to.be.an('object').not.to.have.property('limit');
        });
      });
    });

    it('should add limit when using { $ gt on the primary key', function() {
      const Model = current.define('model');

      return Model.findOne({ where: { id: { [Op.gt]: 42 } } }).then(() => {
        expect(this.stub.getCall(0).args[0]).to.be.an('object').to.have.property('limit');
      });
    });

    describe('should not add limit when querying on an unique key', () => {
      it('with custom unique key', function() {
        const Model = current.define('model', {
          unique: {
            type: DataTypes.INTEGER,
            unique: true
          }
        });

        return Model.findOne({ where: { unique: 42 } }).then(() => {
          expect(this.stub.getCall(0).args[0]).to.be.an('object').not.to.have.property('limit');
        });
      });

      it('with blob unique key', function() {
        const Model = current.define('model', {
          unique: {
            type: DataTypes.BLOB,
            unique: true
          }
        });

        return Model.findOne({ where: { unique: Buffer.from('foo') } }).then(() => {
          expect(this.stub.getCall(0).args[0]).to.be.an('object').not.to.have.property('limit');
        });
      });
    });

    it('should add limit when using multi-column unique key', function() {
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

      return Model.findOne({ where: { unique1: 42 } }).then(() => {
        expect(this.stub.getCall(0).args[0]).to.be.an('object').to.have.property('limit');
      });
    });
  });
});
