import { expect } from 'chai';
import sinon from 'sinon';
import { DataTypes } from '@sequelize/core';
import {
  beforeEach2, destroySequelizeAfterTest,
  getConnectionOptionsWithoutPool,
  getSequelizeInstance,
  getTestDialect,
  getTestDialectTeaser, setResetMode,
} from './support';

const dialect = getTestDialect();
describe(getTestDialectTeaser('Replication'), () => {
  if (['sqlite', 'ibmi'].includes(dialect)) {
    return;
  }

  setResetMode('none');

  describe('connection objects', () => {
    const deps = beforeEach2(async () => {
      const sandbox = sinon.createSandbox();
      const sequelize = getSequelizeInstance('', '', '', {
        replication: {
          write: getConnectionOptionsWithoutPool(),
          read: [getConnectionOptionsWithoutPool()],
        },
      });

      destroySequelizeAfterTest(sequelize);

      expect(sequelize.connectionManager.pool.write).to.be.ok;
      expect(sequelize.connectionManager.pool.read).to.be.ok;

      const User = sequelize.define('User', {
        firstName: {
          type: DataTypes.STRING,
          field: 'first_name',
        },
      });

      await User.sync({ force: true });
      const readSpy = sandbox.spy(sequelize.connectionManager.pool.read!, 'acquire');
      const writeSpy = sandbox.spy(sequelize.connectionManager.pool.write, 'acquire');

      return {
        User,
        sequelize,
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
      await deps.sequelize.transaction({ readOnly: true }, async transaction => {
        return deps.User.findAll({ transaction });
      });

      expectReadCalls();
    });

    it('should run non-read-only transactions on the primary', async () => {
      await deps.sequelize.transaction(async transaction => {
        return deps.User.findAll({ transaction });
      });

      expectWriteCalls();
    });
  });
});
