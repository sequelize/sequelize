import { DataTypes } from '@sequelize/core';
import { expect } from 'chai';
import sinon from 'sinon';
import { createSequelizeInstance, sequelize } from '../../support';

const dialect = sequelize.dialect;

describe('Model#sync', () => {
  it('validates column definitions before force sync can drop a table', async () => {
    const Item = sequelize.define('SyncValidatedItem', {
      id: { type: DataTypes.INTEGER, primaryKey: true },
    });
    const validation = sinon
      .stub(sequelize.queryGenerator, '_validateAttributes')
      .throws(new Error('Unsupported column options'));
    const query = sinon.stub(sequelize, 'queryRaw').resolves([[], 0]);

    try {
      await expect(Item.sync({ force: true, hooks: false })).to.be.rejectedWith(
        'Unsupported column options',
      );
      expect(validation).to.have.been.calledOnce;
      expect(query).not.to.have.been.called;
    } finally {
      validation.restore();
      query.restore();
    }
  });

  it('validates all models and their indexes before bulk force sync can drop tables', async () => {
    const instance = createSequelizeInstance();
    instance.define('FirstSyncItem', { value: DataTypes.INTEGER });
    const IndexedItem = instance.define('IndexedSyncItem', {
      value: { type: DataTypes.INTEGER, unique: true },
    });
    const validation = sinon.stub(instance.queryGenerator, '_validateAttributes');
    validation.onSecondCall().throws(new Error('Unsupported index'));
    const query = sinon.stub(instance, 'queryRaw').resolves([[], 0]);

    try {
      await expect(instance.sync({ force: true, hooks: false })).to.be.rejectedWith(
        'Unsupported index',
      );
      expect(validation).to.have.been.calledTwice;
      expect(validation.secondCall.args[1]).to.deep.equal(IndexedItem.getIndexes());
      expect(query).not.to.have.been.called;
    } finally {
      validation.restore();
      query.restore();
    }
  });

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
