import { expect } from 'chai';
import type { SinonStub } from 'sinon';
import sinon from 'sinon';
import type { Connection, Sequelize } from '@sequelize/core';
import { createSequelizeInstance } from '../support';

describe('connection manager', () => {
  let connection: Connection;
  let sequelize: Sequelize;

  beforeEach(() => {
    connection = {};
    sequelize = createSequelizeInstance();
  });

  describe('_connect', () => {
    let connectStub: SinonStub;

    beforeEach(() => {
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
      });

      // @ts-expect-error -- internal method, no typings
      await sequelize.connectionManager._connect({});

      expect(sequelize.connectionManager.connect).to.have.been.calledWith({
        username,
        password,
      });
    });

    it('should call afterConnect', async () => {
      const spy = sinon.spy();
      sequelize.afterConnect(spy);

      // @ts-expect-error -- internal method, no typings
      await sequelize.connectionManager._connect({});

      expect(spy.callCount).to.equal(1);
      expect(spy.firstCall.args[0]).to.equal(connection);
      expect(spy.firstCall.args[1]).to.eql({});
    });
  });

  describe('_disconnect', () => {
    let disconnectStub: SinonStub;

    beforeEach(() => {
      disconnectStub = sinon.stub(sequelize.connectionManager, 'disconnect');
    });

    afterEach(() => {
      disconnectStub.reset();
    });

    it('should call beforeDisconnect', async () => {
      const spy = sinon.spy();
      sequelize.beforeDisconnect(spy);

      // @ts-expect-error -- internal method, no typings
      await sequelize.connectionManager._disconnect(connection);
      expect(spy.callCount).to.equal(1);
      expect(spy.firstCall.args[0]).to.equal(connection);
    });

    it('should call afterDisconnect', async () => {
      const spy = sinon.spy();
      sequelize.afterDisconnect(spy);

      // @ts-expect-error -- internal method, no typings
      await sequelize.connectionManager._disconnect(connection);
      expect(spy.callCount).to.equal(1);
      expect(spy.firstCall.args[0]).to.equal(connection);
    });
  });
});
