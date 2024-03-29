import type { Sequelize } from '@sequelize/core';
import type { PostgresDialect } from '@sequelize/postgres';
import { expect } from 'chai';
import type { SinonStub } from 'sinon';
import sinon from 'sinon';
import { createSequelizeInstance, getTestDialect } from '../support';

const dialectName = getTestDialect();

describe('sequelize.pool', () => {
  let sequelize: Sequelize;
  let connectStub: SinonStub;

  beforeEach(() => {
    const connection = {};
    sequelize = createSequelizeInstance({
      databaseVersion: '1.0.0',
    });
    connectStub = sinon.stub(sequelize.dialect.connectionManager, 'connect').resolves(connection);
  });

  afterEach(() => {
    connectStub.reset();
  });

  describe('connect', () => {
    it('allows the beforeConnect hook to modify the connection configuration', async () => {
      if (dialectName !== 'postgres') {
        return;
      }

      const user = Math.random().toString();
      const password = Math.random().toString();

      const typedSequelize = sequelize as Sequelize<PostgresDialect>;

      typedSequelize.hooks.addListener('beforeConnect', config => {
        config.user = user;
        config.password = password;
      });

      await sequelize.pool.acquire();

      expect(sequelize.dialect.connectionManager.connect).to.have.been.calledWith({
        ...sequelize.options.replication.write,
        password,
        user,
      });
    });

    it('should call afterConnect', async () => {
      const spy = sinon.spy();
      sequelize.hooks.addListener('afterConnect', spy);

      const connection = await sequelize.pool.acquire();

      expect(spy.callCount).to.equal(1);
      expect(spy.firstCall.args[0]).to.equal(connection);
      expect(spy.firstCall.args[1]).to.deep.equal(sequelize.options.replication.write);
    });
  });

  describe('disconnect', () => {
    let disconnectStub: SinonStub;

    beforeEach(() => {
      disconnectStub = sinon.stub(sequelize.dialect.connectionManager, 'disconnect');
    });

    afterEach(() => {
      disconnectStub.reset();
    });

    it('should call beforeDisconnect and afterDisconnect', async () => {
      const connection = await sequelize.pool.acquire();

      const beforeDisconnect = sinon.spy();
      const afterDisconnect = sinon.spy();

      sequelize.hooks.addListener('beforeDisconnect', beforeDisconnect);
      sequelize.hooks.addListener('afterDisconnect', afterDisconnect);

      await sequelize.pool.destroy(connection);

      expect(beforeDisconnect.callCount).to.equal(1);
      expect(beforeDisconnect.firstCall.args[0]).to.equal(connection);

      expect(afterDisconnect.callCount).to.equal(1);
      expect(afterDisconnect.firstCall.args[0]).to.equal(connection);
    });
  });
});
