'use strict';

var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/../../support')
  , sinon = require('sinon')
  , Config = require(__dirname + '/../../../config/config')
  , ConnectionManager = require(__dirname + '/../../../../lib/dialects/abstract/connection-manager')
  , Pooling = require('generic-pool');

chai.config.includeStack = true;

var baseConf = Config[Support.getTestDialect()];

describe('Connction Manager', function() {

  var sandbox;

  beforeEach(function(){
    sandbox = sinon.sandbox.create();
  });

  afterEach(function(){
    sandbox.restore();
  });

  it('should initialize a single pool without replication', function() {
    var options = {
      pool: {}
    };
    var sequelize = Support.getSequelizeInstance(baseConf.database, baseConf.username, baseConf.password, options);
    var connectionManager = new ConnectionManager(Support.getTestDialect(), sequelize);

    var poolSpy = sinon.spy(Pooling, "Pool");
    connectionManager.initPools();
    expect(poolSpy.calledOnce).to.be.true;
  });

});
