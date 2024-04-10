import type { AbstractDialect, ConnectionOptions, Options } from '@sequelize/core';
import { DataTypes } from '@sequelize/core';
import type { SqliteDialect } from '@sequelize/sqlite3';
import { expect } from 'chai';
import pick from 'lodash/pick';
import sinon from 'sinon';
import { CONFIG } from '../config/config';
import {
  sequelize as baseSequelize,
  beforeEach2,
  createSequelizeInstance,
  destroySequelizeAfterTest,
  getSqliteDatabasePath,
  getTestDialect,
  getTestDialectTeaser,
  setResetMode,
} from './support';

const dialectName = getTestDialect();
describe(getTestDialectTeaser('Replication'), () => {
  if (dialectName === 'ibmi') {
    return;
  }

  setResetMode('none');

  describe('connection objects', () => {
    const deps = beforeEach2(async () => {
      function getConnectionOptions(): ConnectionOptions<AbstractDialect> {
        const out = pick(
          CONFIG[getTestDialect()],
          baseSequelize.dialect.getSupportedConnectionOptions(),
        );

        if (dialectName === 'sqlite3') {
          (out as Options<SqliteDialect>).storage = getSqliteDatabasePath('replication.db');
        }

        return out;
      }

      const sandbox = sinon.createSandbox();
      const sequelize = createSequelizeInstance({
        replication: {
          write: getConnectionOptions(),
          read: [getConnectionOptions()],
        },
      });

      destroySequelizeAfterTest(sequelize);

      expect(sequelize.pool.write).to.be.ok;
      expect(sequelize.pool.read).to.be.ok;

      const User = sequelize.define('User', {
        firstName: {
          type: DataTypes.STRING,
          columnName: 'first_name',
        },
      });

      await User.sync({ force: true });
      const readSpy = sandbox.spy(sequelize.pool.read!, 'acquire');
      const writeSpy = sandbox.spy(sequelize.pool.write, 'acquire');

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
