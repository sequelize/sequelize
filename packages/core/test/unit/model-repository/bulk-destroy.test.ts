import type { InferAttributes, InferCreationAttributes } from '@sequelize/core';
import { Model } from '@sequelize/core';
import { expect } from 'chai';
import sinon from 'sinon';
import { beforeAll2, expectsql, sequelize } from '../../support';

describe('ModelRepository#_UNSTABLE_bulkDestroy', () => {
  const vars = beforeAll2(() => {
    class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
      declare id: number;
    }

    sequelize.addModels([User]);

    return { User };
  });

  afterEach(() => {
    vars.User.hooks.removeAllListeners();
    sinon.restore();
  });

  it('throw an error if the "where" option is not specified', async () => {
    const { User } = vars;
    const repository = User.modelRepository;

    // @ts-expect-error -- testing that not specifying "where" leads to an error
    await expect(repository._UNSTABLE_bulkDestroy({})).to.be.rejectedWith(
      'requires explicitly specifying a "where"',
    );
  });

  it('creates a single DELETE query', async () => {
    const stub = sinon.stub(sequelize, 'queryRaw');

    const { User } = vars;
    const repository = User.modelRepository;

    await repository._UNSTABLE_bulkDestroy({ where: { id: 5 } });

    const firstCall = stub.getCall(0);
    expectsql(firstCall.args[0], {
      default: `DELETE FROM [Users] WHERE [id] = 5`,
      mssql: `DELETE FROM [Users] WHERE [id] = 5; SELECT @@ROWCOUNT AS AFFECTEDROWS;`,
    });
  });

  it('supports _UNSTABLE_beforeBulkDestroy/_UNSTABLE_afterBulkDestroy hooks', async () => {
    sinon.stub(sequelize, 'queryRaw');

    const { User } = vars;
    const repository = User.modelRepository;

    const beforeDestroySpy = sinon.spy();
    const afterDestroySpy = sinon.spy();

    User.hooks.addListener('_UNSTABLE_beforeBulkDestroy', beforeDestroySpy);
    User.hooks.addListener('_UNSTABLE_afterBulkDestroy', afterDestroySpy);

    await repository._UNSTABLE_bulkDestroy({ where: { id: 5 } });

    expect(beforeDestroySpy.callCount).to.eq(1);
    expect(beforeDestroySpy.getCall(0).args).to.deep.eq([
      { manualOnDelete: 'paranoid', where: { id: 5 } },
    ]);

    expect(afterDestroySpy.callCount).to.eq(1);
    expect(afterDestroySpy.getCall(0).args).to.deep.eq([
      { manualOnDelete: 'paranoid', where: { id: 5 } },
      undefined, // returned from queryRaw stub
    ]);
  });

  it('allows modifying the options in _UNSTABLE_beforeBulkDestroy', async () => {
    const stub = sinon.stub(sequelize, 'queryRaw');

    const { User } = vars;
    const repository = User.modelRepository;

    User.hooks.addListener('_UNSTABLE_beforeBulkDestroy', options => {
      options.where = { id: 6 };
    });

    await repository._UNSTABLE_bulkDestroy({ where: { id: 5 } });
    const firstCall = stub.getCall(0);
    expectsql(firstCall.args[0], {
      default: `DELETE FROM [Users] WHERE [id] = 6`,
      mssql: `DELETE FROM [Users] WHERE [id] = 6; SELECT @@ROWCOUNT AS AFFECTEDROWS;`,
    });
  });
});
