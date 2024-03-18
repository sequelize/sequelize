import type { InferAttributes, InferCreationAttributes } from '@sequelize/core';
import { DataTypes, Model } from '@sequelize/core';
import { Attribute, PrimaryKey, Table, Version } from '@sequelize/core/decorators-legacy';
import { expect } from 'chai';
import sinon from 'sinon';
import { beforeAll2, expectsql, sequelize } from '../../support';

describe('ModelRepository#destroy', () => {
  const vars = beforeAll2(() => {
    @Table({
      noPrimaryKey: true,
    })
    class NoPk extends Model<InferAttributes<NoPk>, InferCreationAttributes<NoPk>> {}

    class SimpleId extends Model<InferAttributes<SimpleId>, InferCreationAttributes<SimpleId>> {
      declare id: number;
    }

    class CompositePk extends Model<
      InferAttributes<CompositePk>,
      InferCreationAttributes<CompositePk>
    > {
      @PrimaryKey
      @Attribute(DataTypes.INTEGER)
      declare id1: number;

      @PrimaryKey
      @Attribute(DataTypes.INTEGER)
      declare id2: number;
    }

    class VersionedSimpleId extends Model<
      InferAttributes<VersionedSimpleId>,
      InferCreationAttributes<VersionedSimpleId>
    > {
      declare id: number;

      @Version
      declare version: number;
    }

    sequelize.addModels([SimpleId, CompositePk, VersionedSimpleId, NoPk]);

    return { SimpleId, CompositePk, VersionedSimpleId, NoPk };
  });

  afterEach(() => {
    sinon.restore();
    vars.SimpleId.hooks.removeAllListeners();
  });

  it('throw an error if the model has no primary key', async () => {
    const { NoPk } = vars;
    const repository = NoPk.modelRepository;

    const instance = NoPk.build();

    await expect(repository._UNSTABLE_destroy(instance)).to.be.rejectedWith(
      'does not have a primary key attribute definition',
    );
  });

  it(`throws an error if the model's PK is not loaded`, async () => {
    const { SimpleId } = vars;
    const repository = SimpleId.modelRepository;

    const instance = SimpleId.build();

    await expect(repository._UNSTABLE_destroy(instance)).to.be.rejectedWith(
      'missing the value of its primary key',
    );
  });

  it('creates an optimized query for single-entity deletions', async () => {
    const stub = sinon.stub(sequelize, 'queryRaw');

    const { SimpleId } = vars;
    const repository = SimpleId.modelRepository;

    const instance = SimpleId.build({ id: 1 });

    await repository._UNSTABLE_destroy(instance);

    expect(stub.callCount).to.eq(1);
    const firstCall = stub.getCall(0);
    expectsql(firstCall.args[0], {
      default: `DELETE FROM [SimpleIds] WHERE [id] = 1`,
      mssql: `DELETE FROM [SimpleIds] WHERE [id] = 1; SELECT @@ROWCOUNT AS AFFECTEDROWS;`,
    });
  });

  it('creates an optimized query for non-composite PKs with no version', async () => {
    const stub = sinon.stub(sequelize, 'queryRaw');

    const { SimpleId } = vars;
    const repository = SimpleId.modelRepository;

    const instance1 = SimpleId.build({ id: 1 });
    const instance2 = SimpleId.build({ id: 2 });

    await repository._UNSTABLE_destroy([instance1, instance2]);

    expect(stub.callCount).to.eq(1);
    const firstCall = stub.getCall(0);
    expectsql(firstCall.args[0], {
      default: `DELETE FROM [SimpleIds] WHERE [id] IN (1, 2)`,
      mssql: `DELETE FROM [SimpleIds] WHERE [id] IN (1, 2); SELECT @@ROWCOUNT AS AFFECTEDROWS;`,
    });
  });

  it('creates a deoptimized query for composite PKs', async () => {
    const stub = sinon.stub(sequelize, 'queryRaw');

    const { CompositePk } = vars;
    const repository = CompositePk.modelRepository;

    const instance1 = CompositePk.build({ id1: 1, id2: 2 });
    const instance2 = CompositePk.build({ id1: 3, id2: 4 });

    await repository._UNSTABLE_destroy([instance1, instance2]);

    expect(stub.callCount).to.eq(1);
    const firstCall = stub.getCall(0);
    expectsql(firstCall.args[0], {
      default: `DELETE FROM [CompositePks] WHERE ([id1] = 1 AND [id2] = 2) OR ([id1] = 3 AND [id2] = 4)`,
      mssql: `DELETE FROM [CompositePks] WHERE ([id1] = 1 AND [id2] = 2) OR ([id1] = 3 AND [id2] = 4); SELECT @@ROWCOUNT AS AFFECTEDROWS;`,
    });
  });

  it('creates a deoptimized query if the model is versioned', async () => {
    const stub = sinon.stub(sequelize, 'queryRaw');

    const { VersionedSimpleId } = vars;
    const repository = VersionedSimpleId.modelRepository;

    const instance1 = VersionedSimpleId.build({ id: 1, version: 2 });
    const instance2 = VersionedSimpleId.build({ id: 3, version: 4 });

    await repository._UNSTABLE_destroy([instance1, instance2]);

    expect(stub.callCount).to.eq(1);
    const firstCall = stub.getCall(0);
    expectsql(firstCall.args[0], {
      default: `DELETE FROM [VersionedSimpleIds] WHERE ([id] = 1 AND [version] = 2) OR ([id] = 3 AND [version] = 4)`,
      mssql: `DELETE FROM [VersionedSimpleIds] WHERE ([id] = 1 AND [version] = 2) OR ([id] = 3 AND [version] = 4); SELECT @@ROWCOUNT AS AFFECTEDROWS;`,
    });
  });

  it('supports beforeDestroyMany/afterDestroyMany hooks', async () => {
    sinon.stub(sequelize, 'queryRaw');

    const { SimpleId } = vars;
    const repository = SimpleId.modelRepository;

    const instance1 = SimpleId.build({ id: 1 });
    const instance2 = SimpleId.build({ id: 2 });

    const beforeDestroyManySpy = sinon.spy();
    const afterDestroyManySpy = sinon.spy();

    SimpleId.hooks.addListener('beforeDestroyMany', beforeDestroyManySpy);
    SimpleId.hooks.addListener('afterDestroyMany', afterDestroyManySpy);

    await repository._UNSTABLE_destroy([instance1, instance2]);

    expect(beforeDestroyManySpy.callCount).to.eq(1);
    expect(beforeDestroyManySpy.getCall(0).args).to.deep.eq([
      [instance1, instance2],
      { manualOnDelete: 'paranoid' },
    ]);

    expect(afterDestroyManySpy.callCount).to.eq(1);
    expect(afterDestroyManySpy.getCall(0).args).to.deep.eq([
      [instance1, instance2],
      { manualOnDelete: 'paranoid' },
      undefined, // returned from queryRaw stub
    ]);
  });

  it('skips beforeDestroyMany/afterDestroyMany hooks if noHooks is passed', async () => {
    sinon.stub(sequelize, 'queryRaw');

    const { SimpleId } = vars;
    const repository = SimpleId.modelRepository;

    const instance1 = SimpleId.build({ id: 1 });
    const instance2 = SimpleId.build({ id: 2 });

    const beforeDestroyManySpy = sinon.spy();
    const afterDestroyManySpy = sinon.spy();

    SimpleId.hooks.addListener('beforeDestroyMany', beforeDestroyManySpy);
    SimpleId.hooks.addListener('afterDestroyMany', afterDestroyManySpy);

    await repository._UNSTABLE_destroy([instance1, instance2], { noHooks: true });

    expect(beforeDestroyManySpy.callCount).to.eq(0);
    expect(afterDestroyManySpy.callCount).to.eq(0);
  });

  it('allows modifying the list of instances in beforeDestroyMany', async () => {
    const stub = sinon.stub(sequelize, 'queryRaw');
    const { SimpleId } = vars;

    const repository = SimpleId.modelRepository;

    const instance1 = SimpleId.build({ id: 1 });
    const instance2 = SimpleId.build({ id: 2 });
    const instance3 = SimpleId.build({ id: 3 });

    SimpleId.hooks.addListener('beforeDestroyMany', instances => {
      instances.push(instance3);
    });

    await repository._UNSTABLE_destroy([instance1, instance2]);

    expect(stub.callCount).to.eq(1);
    const firstCall = stub.getCall(0);
    expectsql(firstCall.args[0], {
      default: `DELETE FROM [SimpleIds] WHERE [id] IN (1, 2, 3)`,
      mssql: `DELETE FROM [SimpleIds] WHERE [id] IN (1, 2, 3); SELECT @@ROWCOUNT AS AFFECTEDROWS;`,
    });
  });

  it('aborts if beforeDestroyMany removes all instances', async () => {
    const stub = sinon.stub(sequelize, 'queryRaw');
    const { SimpleId } = vars;

    const repository = SimpleId.modelRepository;

    const instance1 = SimpleId.build({ id: 1 });

    SimpleId.hooks.addListener('beforeDestroyMany', instances => {
      // remove all instances
      instances.splice(0, instances.length);
    });

    await repository._UNSTABLE_destroy([instance1]);

    expect(stub.callCount).to.eq(0);
  });
});
