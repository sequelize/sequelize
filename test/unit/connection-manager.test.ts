import type { Connection, Sequelize } from '@sequelize/core';
import chai from 'chai';
import type { SinonStub } from 'sinon';
import sinon from 'sinon';
import { createSequelizeInstance } from '../support';

const expect = chai.expect;

describe('connection manager', () => {
  describe('_connect', () => {
    let connection: Connection;
    let sequelize: Sequelize;
    let connectStub: SinonStub;

    beforeEach(() => {
      connection = {
        uuid: '',
        queryType: 'write',
      };
      sequelize = createSequelizeInstance();
      connectStub = sinon.stub(sequelize.connectionManager, 'connect').resolves(connection);
    });

    afterEach(() => {
      connectStub.reset();
    });

    it('should let beforeConnect hook modify config', async () => {
      const username = Math.random().toString();
      const password = Math.random().toString();

      sequelize.beforeConnect(config => {
        config.username = username;
        config.password = password;

        return config;
      });

      await sequelize.connectionManager._connect({});

      expect(sequelize.connectionManager.connect).to.have.been.calledWith({
        username,
        password,
      });
    });

    it('should call afterConnect', async () => {
      const spy = sinon.spy();
      sequelize.afterConnect(spy);

      await sequelize.connectionManager._connect({});

      expect(spy.callCount).to.equal(1);
      expect(spy.firstCall.args[0]).to.equal(connection);
      expect(spy.firstCall.args[1]).to.eql({});
    });
  });

  describe('_disconnect', () => {
    let connection: Connection;
    let sequelize: Sequelize;
    let disconnectStub: SinonStub;

    beforeEach(() => {
      connection = {
        uuid: '',
        queryType: 'write',
      };
      sequelize = createSequelizeInstance();

      disconnectStub = sinon.stub(sequelize.connectionManager, 'disconnect');
    });

    afterEach(() => {
      disconnectStub.reset();
    });

    it('should call beforeDisconnect', async () => {
      const spy = sinon.spy();
      sequelize.beforeDisconnect(spy);

      await sequelize.connectionManager._disconnect(connection);
      expect(spy.callCount).to.equal(1);
      expect(spy.firstCall.args[0]).to.equal(connection);
    });

    it('should call afterDisconnect', async () => {
      const spy = sinon.spy();
      sequelize.afterDisconnect(spy);

      await sequelize.connectionManager._disconnect(connection);
      expect(spy.callCount).to.equal(1);
      expect(spy.firstCall.args[0]).to.equal(connection);
    });
  });
});
