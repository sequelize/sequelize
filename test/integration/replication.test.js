'use strict';

/* jshint -W030 */
/* jshint -W110 */
var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/support')
  , DataTypes = require(__dirname + '/../../lib/data-types')
  , dialect = Support.getTestDialect()
  , sinon = require('sinon');

describe(Support.getTestDialectTeaser('Replication'), function() {
  if (dialect === 'sqlite') return;

  var sandbox;
  var readSpy, writeSpy;

  beforeEach(function () {
    var self = this;

    sandbox = sinon.sandbox.create();

    this.sequelize = Support.getSequelizeInstance(null, null, null, {
      replication: {
        write: Support.getConnectionOptions(),
        read: [Support.getConnectionOptions()]
      }
    });

    expect(this.sequelize.connectionManager.pool.write).to.be.ok;
    expect(this.sequelize.connectionManager.pool.read).to.be.ok;

    this.User = this.sequelize.define('User', {
      firstName: {
        type: DataTypes.STRING,
        field: 'first_name'
      }
    });

    return this.User.sync({force: true})
    .then(function () {
      readSpy = sandbox.spy(self.sequelize.connectionManager.pool.read, 'acquire');
      writeSpy = sandbox.spy(self.sequelize.connectionManager.pool.write, 'acquire');
    });
  });

  afterEach(function () {
    sandbox.restore();
  });

  function expectReadCalls() {
    chai.expect(readSpy.callCount).least(1);
    chai.expect(writeSpy.notCalled).eql(true);
  }

  function expectWriteCalls() {
    chai.expect(writeSpy.callCount).least(1);
    chai.expect(readSpy.notCalled).eql(true);
  }

  it('should be able to make a write', function () {
    return this.User.create({
      firstName: Math.random().toString()
    })
    .then(expectWriteCalls);
  });

  it('should be able to make a read', function () {
    return this.User.findAll()
    .then(expectReadCalls);
  });

  it('should run read-only transactions on the replica', function () {
    var self = this;
    return this.sequelize.transaction({readOnly: true}, function (transaction) {
      return self.User.findAll({transaction: transaction});
    })
    .then(expectReadCalls);
  });

  it('should run non-read-only transactions on the primary', function () {
    var self = this;
    return self.sequelize.transaction(function (transaction) {
      return self.User.findAll({transaction: transaction});
    })
    .then(expectWriteCalls);
  });
});
