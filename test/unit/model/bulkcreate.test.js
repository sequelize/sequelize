'use strict';

/* jshint -W030, -W110 */
var chai = require('chai')
  , expect = chai.expect
  , sinon = require('sinon')
  , Support   = require(__dirname + '/../support')
  , DataTypes = require('../../../lib/data-types')
  , current   = Support.sequelize
  , Promise = current.Promise;

describe(Support.getTestDialectTeaser('Model'), function() {
  describe('bulkCreate', function () {
    var Model = current.define('model', {
      accountId: {
        type: DataTypes.INTEGER(11).UNSIGNED,
        allowNull: false,
        field: 'account_id'
      }
    }, { timestamps: false });

    before(function () {

      this.stub = sinon.stub(current.getQueryInterface(), 'bulkInsert', function () {
        return Promise.resolve([]);
      });
    });

    beforeEach(function () {
      this.stub.reset();
    });

    after(function () {
      this.stub.restore();
    });

    describe('validations', function () {
      it('should not fail for renamed fields', function () {
        return Model.bulkCreate([
          { accountId: 42 }
        ], { validate: true }).bind(this).then(function () {
          expect(this.stub.getCall(0).args[1]).to.deep.equal([
            { account_id: 42, id: null }
          ]);
        });
      });
    });
  });
});
