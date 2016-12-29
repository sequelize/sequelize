'use strict';

/* jshint -W030 */
var chai = require('chai')
, expect = chai.expect
, sinon = require('sinon')
, Support = require(__dirname + '/support')
, Sequelize = Support.Sequelize
, dialect = Support.getTestDialect()
, current = Support.sequelize
, Promise = Sequelize.Promise;

describe('Transaction', function() {

  before(function () {
    this.stub = sinon.stub(current, 'query').returns(Promise.resolve({}));

    this.stubConnection = sinon.stub(current.connectionManager, 'getConnection')
    .returns(Promise.resolve({ uuid: 'ssfdjd-434fd-43dfg23-2d', close : function() { }}));
  });

  beforeEach(function () {
    this.stub.reset();
    this.stubConnection.reset();
  });

  after(function () {
    this.stub.restore();
    this.stubConnection.restore();
  });

  it('should run auto commit query only when needed', function() {
    var expectations = {
      all: [
        'START TRANSACTION;'
      ],
      sqlite: [
        'BEGIN DEFERRED TRANSACTION;'
      ],
      mssql: [
        'BEGIN TRANSACTION;'
      ],
      oracle: [
        'BEGIN TRANSACTION;'
      ]
    };
    return current.transaction(() => {
      expect(this.stub.args.map(arg => arg[0])).to.deep.equal(expectations[dialect] || expectations.all);
      return Promise.resolve();
    });
  });
});
