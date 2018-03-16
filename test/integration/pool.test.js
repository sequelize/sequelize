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

    this.sinon.stub(this.testInstance.connectionManager, '_connect')
      .returns(new Sequelize.Promise(() => {}));

    return expect(this.testInstance.authenticate())
      .to.eventually.be.rejectedWith('ResourceRequest timed out');
  });
  
  it('should not result in unhandled promise rejection when unable to acquire connection', () => {
    this.testInstance = new Sequelize('localhost', 'ffd', 'dfdf', {
      dialect,
      databaseVersion: '1.2.3',
      pool: {
        acquire: 1000,
        max: 1
      }
    });

    this.sinon.stub(this.testInstance.connectionManager, '_connect')
      .returns(new Sequelize.Promise(() => {}));

    return expect(this.testInstance.transaction()
      .then(() => this.testInstance.transaction()))
      .to.eventually.be.rejectedWith('ResourceRequest timed out');
  });
});
