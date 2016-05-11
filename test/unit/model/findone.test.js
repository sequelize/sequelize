'use strict';

/* jshint -W030 */
var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/../support')
  , current = Support.sequelize
  , sinon = require('sinon')
  , DataTypes = require(__dirname + '/../../../lib/data-types')
  , Promise = require('bluebird');

describe(Support.getTestDialectTeaser('Model'), function() {
  describe('method findOne', function () {
    before(function () {
      this.oldFindAll = current.Model.prototype.findAll;
    });
    after(function () {
      current.Model.prototype.findAll = this.oldFindAll;
    });

    beforeEach(function () {
      this.stub = current.Model.prototype.findAll = sinon.stub().returns(Promise.resolve());
    });

    describe('should not add limit when querying on a primary key', function () {
      it('with id primary key', function () {
        var Model = current.define('model');

        return Model.findOne({ where: { id: 42 }}).bind(this).then(function () {
          expect(this.stub.getCall(0).args[0]).to.be.an('object').not.to.have.property('limit');
        });
      });

      it('with custom primary key', function () {
        var Model = current.define('model', {
            uid: {
              type: DataTypes.INTEGER,
              primaryKey: true,
              autoIncrement: true
            }
          });

        return Model.findOne({ where: { uid: 42 }}).bind(this).then(function () {
          expect(this.stub.getCall(0).args[0]).to.be.an('object').not.to.have.property('limit');
        });
      });

      it('with blob primary key', function () {
        var Model = current.define('model', {
          id: {
            type: DataTypes.BLOB,
            primaryKey: true,
            autoIncrement: true
          }
        });

        return Model.findOne({ where: { id: new Buffer('foo') }}).bind(this).then(function () {
          expect(this.stub.getCall(0).args[0]).to.be.an('object').not.to.have.property('limit');
        });
      });
    });

    it('should add limit when using { $ gt on the primary key', function () {
      var Model = current.define('model');

      return Model.findOne({ where: { id: { $gt: 42 }}}).bind(this).then(function () {
        expect(this.stub.getCall(0).args[0]).to.be.an('object').to.have.property('limit');
      });
    });

  });
});
