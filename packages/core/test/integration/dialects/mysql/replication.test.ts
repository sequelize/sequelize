import type { AbstractDialect, ConnectionOptions } from '@sequelize/core';
import { DataTypes } from '@sequelize/core';
import { expect } from 'chai';
import pick from 'lodash/pick';
import sinon from 'sinon';
import { CONFIG } from '../../../config/config';
import {
  sequelize as baseSequelize,
  beforeEach2,
  createSequelizeInstance,
  destroySequelizeAfterTest,
  getTestDialect,
  getTestDialectTeaser,
  setResetMode,
} from '../../support';

const dialectName = getTestDialect();

if (dialectName === 'mysql') {
  describe(getTestDialectTeaser('Replication (useMaster)'), () => {
    setResetMode('none');

    const deps = beforeEach2(async () => {
      function getConnectionOptions(): ConnectionOptions<AbstractDialect> {
        return pick(CONFIG[dialectName], baseSequelize.dialect.getSupportedConnectionOptions());
      }

      const sandbox = sinon.createSandbox();
      const sequelize = createSequelizeInstance({
        replication: {
          write: getConnectionOptions(),
          read: [getConnectionOptions()],
        },
      });

      destroySequelizeAfterTest(sequelize);

      const poolAcquireSpy = sandbox.spy(sequelize.pool, 'acquire');

      const User = sequelize.define(
        'User',
        {
          firstName: {
            type: DataTypes.STRING,
          },
        },
        { timestamps: false },
      );

      await User.sync({ force: true });
      poolAcquireSpy.resetHistory();

      return {
        User,
        sequelize,
        sandbox,
        poolAcquireSpy,
      };
    });

    afterEach(() => {
      deps.sandbox.restore();
    });

    it('uses the master connection when requested and populates the auto-increment primary key', async () => {
      const instance = await deps.User.create(
        { firstName: `KozyOps` },
        // @ts-expect-error -- Mysql dialect supports useMaster
        { useMaster: true },
      );

      expect(instance.get('id')).to.be.a('number');
    });
  });
}
