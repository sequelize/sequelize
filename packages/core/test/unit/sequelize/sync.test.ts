import { DataTypes } from '@sequelize/core';
import { expect } from 'chai';
import sinon from 'sinon';
import { createSequelizeInstance, getTestDialectTeaser, sequelize } from '../../support';

const dialect = sequelize.dialect;

describe('Sequelize#sync', () => {
  if (!dialect.supports.schemas) {
    return;
  }

  let localSequelize: ReturnType<typeof createSequelizeInstance> | undefined;

  afterEach(async () => {
    if (localSequelize) {
      await localSequelize.close();
    }

    sinon.restore();
  });

  it(`drops tables in the schema passed to sync when force is true #18423 ${getTestDialectTeaser('')}`, async () => {
    localSequelize = createSequelizeInstance();

    const User = localSequelize.define('BulkSyncDropUser', {
      id: { type: DataTypes.INTEGER, primaryKey: true },
    });
    const Task = localSequelize.define('BulkSyncDropTask', {
      id: { type: DataTypes.INTEGER, primaryKey: true },
      userId: { type: DataTypes.INTEGER },
    });
    Task.belongsTo(User);

    // Default queryRaw resolves to [rows, metadata]. An empty row list keeps any remaining
    // cyclic-drop path from calling removeConstraint with undefined names.
    const stub = sinon.stub(localSequelize, 'queryRaw').resolves([[], 0]);

    await localSequelize.sync({ force: true, schema: 'tenant' });

    const dropQueries = stub
      .getCalls()
      .map(call => String(call.args[0]))
      .filter(query => query.includes('DROP TABLE'));

    expect(dropQueries.length).to.be.greaterThan(0);

    const quotedUser = localSequelize.queryGenerator.quoteTable({
      tableName: User.table.tableName,
      schema: 'tenant',
    });
    const quotedTask = localSequelize.queryGenerator.quoteTable({
      tableName: Task.table.tableName,
      schema: 'tenant',
    });
    const defaultUser = localSequelize.queryGenerator.quoteTable(User.table);
    const defaultTask = localSequelize.queryGenerator.quoteTable(Task.table);

    for (const dropQuery of dropQueries) {
      expect(dropQuery).to.not.include(`DROP TABLE IF EXISTS ${defaultUser}`);
      expect(dropQuery).to.not.include(`DROP TABLE IF EXISTS ${defaultTask}`);
    }

    expect(dropQueries.some(query => query.includes(quotedUser))).to.be.true;
    expect(dropQueries.some(query => query.includes(quotedTask))).to.be.true;
  });
});

describe('Sequelize#drop', () => {
  if (!dialect.supports.schemas) {
    return;
  }

  let localSequelize: ReturnType<typeof createSequelizeInstance> | undefined;

  afterEach(async () => {
    if (localSequelize) {
      await localSequelize.close();
    }

    sinon.restore();
  });

  it(`drops tables in the schema option rather than the default schema #18423 ${getTestDialectTeaser('')}`, async () => {
    localSequelize = createSequelizeInstance();

    const User = localSequelize.define('BulkDropSchemaUser', {
      id: { type: DataTypes.INTEGER, primaryKey: true },
    });

    const stub = sinon.stub(localSequelize, 'queryRaw').resolves([[], 0]);

    await localSequelize.drop({
      schema: 'tenant',
      cascade: dialect.supports.dropTable.cascade || undefined,
    });

    const dropQueries = stub
      .getCalls()
      .map(call => String(call.args[0]))
      .filter(query => query.includes('DROP TABLE'));

    expect(dropQueries.length).to.be.greaterThan(0);

    const quotedUser = localSequelize.queryGenerator.quoteTable({
      tableName: User.table.tableName,
      schema: 'tenant',
    });
    const defaultUser = localSequelize.queryGenerator.quoteTable(User.table);

    for (const dropQuery of dropQueries) {
      expect(dropQuery).to.include(quotedUser);
      expect(dropQuery).to.not.include(`DROP TABLE IF EXISTS ${defaultUser}`);
    }
  });
});
