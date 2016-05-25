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
  var sqlIndex = [];

  before(function () {
    this.stub = sinon.stub(current, 'query', function (sql) {
      sqlIndex.push(sql);
      return Promise.resolve({});
    });

    this.stubConnection = sinon.stub(current.connectionManager, 'getConnection', function (options) {
      return Promise.resolve({ uuid: options.uuid, close : function() { }});
    });
  });

  beforeEach(function () {
    sqlIndex = [];
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
        expect(sqlIndex.join(' ').indexOf('SET autocommit = 1;')).to.be.ok;
        return Promise.resolve({});
      });
    });
  } else {
    it('should not run auto commit query', function() {
      var self = this;
      return current.transaction(function(t) {
        expect(self.stub.calledOnce).to.be.ok;
        expect(sqlIndex.join(' ').indexOf('SET autocommit = 1;')).to.be.eql(-1);
        return Promise.resolve({});
      });
    });
  }
});
