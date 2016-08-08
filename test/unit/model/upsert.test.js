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
  describe('upsert', function () {
    var Model = current.define('model', {
      accountId: {
        type: DataTypes.STRING,
        primaryKey: true,
        field: 'account_id'
    },
      accountName: {
        type: DataTypes.STRING,
        unique: true,
        field: 'account_name'
      }
    }, { timestamps: false });

    before(function () {

      this.stub = sinon.stub(current.dialect.QueryGenerator, 'upsertQuery', function () {
        return Promise.resolve([]);
      });
      this.stub2 = sinon.stub(current, 'query', function () {
        return Promise.resolve([]);
      });
    });

    beforeEach(function () {
      this.stub.reset();
      this.stub2.reset();
    });

    after(function () {
      this.stub.restore();
      this.stub2.restore();
    });

    describe('validations', function () {
      it('should not filter by unique keys', function () {
        return Model.upsert(
          { accountId: "42", accountName: "21" }
        , { validate: true }).bind(this).then(function () {
          expect(this.stub.getCall(0).args[3]).to.deep.equal(
            { '$or': [ { account_id: '42' } ] }
          );
        });
      });
    });
  });
});
