'use strict';

const chai = require('chai');
const expect = chai.expect;
const Support = require(__dirname + '/support');
const dialect = Support.getTestDialect();
const sinon = require('sinon');
const Sequelize = Support.Sequelize;

describe(Support.getTestDialectTeaser('Pooling'), function() {
  if (dialect === 'sqlite') return;

  beforeEach(() => {
    this.sinon = sinon.sandbox.create();
  });

  afterEach(() => {
    this.sinon.restore();
  });

  it('should reject when unable to acquire connection in given time', () => {
    this.testInstance = new Sequelize('localhost', 'ffd', 'dfdf', {
      dialect,
      databaseVersion: '1.2.3',
      pool: {
        acquire: 1000 //milliseconds
      }
    });

    this.sinon.stub(this.testInstance.connectionManager, '_connect', () => new Sequelize.Promise(() => {}));

    return expect(this.testInstance.authenticate())
      .to.eventually.be.rejectedWith('TimeoutError: ResourceRequest timed out');
  });
});
