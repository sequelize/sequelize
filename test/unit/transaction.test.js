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

  if (dialect === 'mysql') {
    it('should run auto commit query', function() {
      var self = this;
      return current.transaction(function(t) {
        expect(self.stub.calledTwice).to.be.ok;
        expect(self.stub.args[0][0]).to.be.eql('START TRANSACTION;');
        expect(self.stub.args[1][0]).to.be.eql('SET autocommit = 1;');
        return Promise.resolve({});
      });
    });
  } else {
    it('should not run auto commit query', function() {
      var self = this;
      return current.transaction(function(t) {
        expect(self.stub.calledOnce).to.be.ok;
        expect(self.stub.args[1]).to.be.empty;
        expect(self.stub.args[0].join(' ').indexOf('autocommit')).to.be.eql(-1);
        return Promise.resolve({});
      });
    });
  }
});
