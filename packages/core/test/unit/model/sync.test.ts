import { DataTypes } from '@sequelize/core';
import { expect } from 'chai';
import sinon from 'sinon';
import { sequelize } from '../../support';

const dialect = sequelize.dialect;

describe('Model#sync', () => {
  if (!dialect.supports.schemas) {
    return;
  }

  it('drops the table in the schema passed to sync', async () => {
    const User = sequelize.define('SyncDropUser', {
      id: { type: DataTypes.INTEGER, primaryKey: true },
    });

    const stub = sinon.stub(sequelize, 'queryRaw').resolves([[], 0]);
    try {
      await User.sync({ force: true, schema: 'tenant' });
    } finally {
      stub.restore();
    }

    const dropQuery = stub
      .getCalls()
      .map(call => String(call.args[0]))
      .find(query => query.includes('DROP TABLE'));

    expect(dropQuery).to.include(
      sequelize.queryGenerator.quoteTable({ tableName: User.table.tableName, schema: 'tenant' }),
    );
  });

  it('does not move a model that explicitly declares the default schema', async () => {
    const defaultSchema = dialect.getDefaultSchema();
    const User = sequelize.define('SyncExplicitDefaultSchemaUser', {}, { schema: defaultSchema });

    const stub = sinon.stub(sequelize, 'queryRaw').resolves([[], 0]);
    try {
      await User.sync({ schema: 'tenant' });
    } finally {
      stub.restore();
    }

    const createQuery = stub
      .getCalls()
      .map(call => String(call.args[0]))
      .find(query => query.includes('CREATE TABLE'));

    expect(createQuery).to.include(
      sequelize.queryGenerator.quoteTable({
        tableName: User.table.tableName,
        schema: defaultSchema,
      }),
    );
  });

  it('rejects a sync schema when the model already declares another one', async () => {
    const User = sequelize.define('SyncSchemaUser', {}, { schema: 'other' });

    const stub = sinon.stub(sequelize, 'queryRaw').resolves([[], 0]);
    try {
      await expect(User.sync({ schema: 'tenant' })).to.be.rejectedWith(
        /already specifies schema other/,
      );
    } finally {
      stub.restore();
    }

    expect(stub.callCount).to.eq(0);
  });
});
