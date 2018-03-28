'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require(__dirname + '/../support'),
  current = Support.sequelize,
  sinon = require('sinon'),
  DataTypes = require(__dirname + '/../../../lib/data-types'),
  Promise = require('bluebird');

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('method findOne', () => {
    before(function() {
      this.oldFindAll = current.Model.findAll;
    });
    after(function() {
      current.Model.findAll = this.oldFindAll;
    });

    beforeEach(function() {
      this.stub = current.Model.findAll = sinon.stub().returns(Promise.resolve());
    });

    describe('should not add limit when querying on a primary key', () => {
      it('with id primary key', function() {
        const Model = current.define('model');

        return Model.findOne({ where: { id: 42 }}).bind(this).then(function() {
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

        return Model.findOne({ where: { uid: 42 }}).bind(this).then(function() {
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

        return Model.findOne({ where: { id: new Buffer('foo') }}).bind(this).then(function() {
          expect(this.stub.getCall(0).args[0]).to.be.an('object').not.to.have.property('limit');
        });
      });
    });

    it('should add limit when using { $ gt on the primary key', function() {
      const Model = current.define('model');

      return Model.findOne({ where: { id: { $gt: 42 }}}).bind(this).then(function() {
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

        return Model.findOne({ where: { unique: 42 }}).bind(this).then(function() {
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

        return Model.findOne({ where: { unique: new Buffer('foo') }}).bind(this).then(function() {
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

      return Model.findOne({ where: { unique1: 42}}).bind(this).then(function() {
        expect(this.stub.getCall(0).args[0]).to.be.an('object').to.have.property('limit');
      });
    });
  });
});
