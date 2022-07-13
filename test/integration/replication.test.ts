import { DataTypes } from '@sequelize/core';
import { expect } from 'chai';
import sinon from 'sinon';
import {
  clearDatabase,
  sequelize,
  beforeEach2,
  getConnectionOptionsWithoutPool,
  getSequelizeInstance,
  getTestDialect,
  getTestDialectTeaser,
} from './support';

const dialect = getTestDialect();
describe(getTestDialectTeaser('Replication'), () => {
  beforeEach(async () => {
    await clearDatabase(sequelize);
  });

  if (['sqlite', 'ibmi'].includes(dialect)) {
    return;
  }

  describe('connection objects', () => {
    const deps = beforeEach2(async () => {
      const sandbox = sinon.createSandbox();
      const sequelizeInstance = getSequelizeInstance('', '', '', {
        replication: {
          write: getConnectionOptionsWithoutPool(),
          read: [getConnectionOptionsWithoutPool()],
        },
      });

      expect(sequelizeInstance.connectionManager.pool.write).to.be.ok;
      expect(sequelizeInstance.connectionManager.pool.read).to.be.ok;

      const User = sequelizeInstance.define('User', {
        firstName: {
          type: DataTypes.STRING,
          field: 'first_name',
        },
      });

      await User.sync({ force: true });
      const readSpy = sandbox.spy(sequelizeInstance.connectionManager.pool.read!, 'acquire');
      const writeSpy = sandbox.spy(sequelizeInstance.connectionManager.pool.write, 'acquire');

      return {
        User,
        sequelizeInstance,
        sandbox,
        readSpy,
        writeSpy,
      };
    });

    afterEach(() => {
      deps.sandbox.restore();
    });

    function expectReadCalls() {
      expect(deps.readSpy.callCount).least(1);
      expect(deps.writeSpy.notCalled).eql(true);
    }

    function expectWriteCalls() {
      expect(deps.writeSpy.callCount).least(1);
      expect(deps.readSpy.notCalled).eql(true);
    }

    it('should be able to make a write', async () => {
      await deps.User.create({
        firstName: Math.random().toString(),
      });

      expectWriteCalls();
    });

    it('should be able to make a read', async () => {
      await deps.User.findAll();
      expectReadCalls();
    });

    it('should run read-only transactions on the replica', async () => {
      await deps.sequelizeInstance.transaction({ readOnly: true }, async transaction => {
        return deps.User.findAll({ transaction });
      });

      expectReadCalls();
    });

    it('should run non-read-only transactions on the primary', async () => {
      await deps.sequelizeInstance.transaction(async transaction => {
        return deps.User.findAll({ transaction });
      });

      expectWriteCalls();
    });
  });
});
