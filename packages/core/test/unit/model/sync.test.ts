import { DataTypes } from '@sequelize/core';
import { expect } from 'chai';
import sinon from 'sinon';
import { getTestDialectTeaser, sequelize } from '../../support';

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

  it(`drops the table in the schema passed to Model.drop ${getTestDialectTeaser('')}`, async () => {
    const User = sequelize.define('ModelDropSchemaUser', {
      id: { type: DataTypes.INTEGER, primaryKey: true },
    });

    const stub = sinon.stub(sequelize, 'queryRaw').resolves([]);
    try {
      await User.drop({ schema: 'tenant' });
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
    expect(dropQuery).to.not.include(
      `DROP TABLE IF EXISTS ${sequelize.queryGenerator.quoteTable(User.table)}`,
    );
  });

  it('rejects a sync schema when the model already declares another one', async () => {
    const User = sequelize.define('SyncSchemaUser', {}, { schema: 'other' });

    const stub = sinon.stub(sequelize, 'queryRaw').resolves([[], 0]);
    try {
      await expect(User.sync({ schema: 'tenant' })).to.be.rejectedWith(
        /The "schema" option can only be used on models that do not already specify a schema, or that are using the default schema\. Model SyncSchemaUser already specifies schema other/,
      );
    } finally {
      stub.restore();
    }

    expect(stub.callCount).to.eq(0);
  });

  it('rejects a drop schema when the model already declares another one', async () => {
    const User = sequelize.define('DropSchemaUser', {}, { schema: 'other' });

    const stub = sinon.stub(sequelize, 'queryRaw').resolves([]);
    try {
      await expect(User.drop({ schema: 'tenant' })).to.be.rejectedWith(
        /The "schema" option can only be used on models that do not already specify a schema, or that are using the default schema\. Model DropSchemaUser already specifies schema other/,
      );
    } finally {
      stub.restore();
    }

    expect(stub.callCount).to.eq(0);
  });
});
