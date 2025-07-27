import { DataTypes, JSON_NULL, sql } from '@sequelize/core';
import { expect } from 'chai';
import sinon from 'sinon';
import { createSequelizeInstance, expectsql, sequelize } from '../../support';

const dialect = sequelize.dialect;

describe('QueryInterface#createTable', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('supports sql.uuidV4 default values', async () => {
    const localSequelize =
      dialect.name === 'postgres'
        ? createSequelizeInstance({
            databaseVersion: '13.0.0',
          })
        : sequelize;

    const stub = sinon.stub(localSequelize, 'queryRaw');

    await localSequelize.queryInterface.createTable('table', {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: sql.uuidV4,
      },
    });

    expect(stub.callCount).to.eq(1);
    const firstCall = stub.getCall(0);
    expectsql(firstCall.args[0], {
      postgres:
        'CREATE TABLE IF NOT EXISTS "table" ("id" UUID DEFAULT gen_random_uuid(), PRIMARY KEY ("id"));',
      'mariadb mysql':
        'CREATE TABLE IF NOT EXISTS `table` (`id` CHAR(36) BINARY, PRIMARY KEY (`id`)) ENGINE=InnoDB;',
      mssql: `IF OBJECT_ID(N'[table]', 'U') IS NULL CREATE TABLE [table] ([id] UNIQUEIDENTIFIER DEFAULT NEWID(), PRIMARY KEY ([id]));`,
      sqlite3: 'CREATE TABLE IF NOT EXISTS `table` (`id` TEXT PRIMARY KEY);',
      snowflake: 'CREATE TABLE IF NOT EXISTS "table" ("id" VARCHAR(36), PRIMARY KEY ("id"));',
      db2: 'CREATE TABLE IF NOT EXISTS "table" ("id" CHAR(36) FOR BIT DATA NOT NULL, PRIMARY KEY ("id"));',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "table" ("id" CHAR(36), PRIMARY KEY ("id")); END`,
    });
  });

  if (dialect.name === 'postgres') {
    // gen_random_uuid was added in postgres 13
    it('supports sql.uuidV4 default values (postgres < 13)', async () => {
      const localSequelize = createSequelizeInstance({
        databaseVersion: '12.0.0',
      });

      const stub = sinon.stub(localSequelize, 'queryRaw');

      await localSequelize.queryInterface.createTable('table', {
        id: {
          type: DataTypes.UUID,
          primaryKey: true,
          defaultValue: sql.uuidV4,
        },
      });

      expect(stub.callCount).to.eq(1);
      const firstCall = stub.getCall(0);
      expectsql(firstCall.args[0], {
        postgres:
          'CREATE TABLE IF NOT EXISTS "table" ("id" UUID DEFAULT uuid_generate_v4(), PRIMARY KEY ("id"));',
      });
    });
  }

  it('supports sql.uuidV1 default values', async () => {
    const stub = sinon.stub(sequelize, 'queryRaw');
    await sequelize.queryInterface.createTable('table', {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: sql.uuidV1,
      },
    });

    expect(stub.callCount).to.eq(1);
    const firstCall = stub.getCall(0);
    expectsql(firstCall.args[0], {
      postgres:
        'CREATE TABLE IF NOT EXISTS "table" ("id" UUID DEFAULT uuid_generate_v1(), PRIMARY KEY ("id"));',
      mysql:
        'CREATE TABLE IF NOT EXISTS `table` (`id` CHAR(36) BINARY DEFAULT (UUID()), PRIMARY KEY (`id`)) ENGINE=InnoDB;',
      mariadb:
        'CREATE TABLE IF NOT EXISTS `table` (`id` CHAR(36) BINARY DEFAULT UUID(), PRIMARY KEY (`id`)) ENGINE=InnoDB;',
      mssql: `IF OBJECT_ID(N'[table]', 'U') IS NULL CREATE TABLE [table] ([id] UNIQUEIDENTIFIER, PRIMARY KEY ([id]));`,
      sqlite3: 'CREATE TABLE IF NOT EXISTS `table` (`id` TEXT PRIMARY KEY);',
      snowflake: 'CREATE TABLE IF NOT EXISTS "table" ("id" VARCHAR(36), PRIMARY KEY ("id"));',
      db2: 'CREATE TABLE IF NOT EXISTS "table" ("id" CHAR(36) FOR BIT DATA NOT NULL, PRIMARY KEY ("id"));',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "table" ("id" CHAR(36), PRIMARY KEY ("id")); END`,
    });
  });

  it('supports JSON_NULL default values', async () => {
    if (!dialect.supports.dataTypes.JSON) {
      return;
    }

    const stub = sinon.stub(sequelize, 'queryRaw');

    await sequelize.queryInterface.createTable('table', {
      json: {
        type: DataTypes.JSON,
        defaultValue: JSON_NULL,
      },
    });

    expect(stub.callCount).to.eq(1);
    const firstCall = stub.getCall(0);
    expectsql(firstCall.args[0], {
      postgres: `CREATE TABLE IF NOT EXISTS "table" ("json" JSON DEFAULT 'null');`,
      'mariadb mysql': 'CREATE TABLE IF NOT EXISTS `table` (`json` JSON) ENGINE=InnoDB;',
      mssql: `IF OBJECT_ID(N'[table]', 'U') IS NULL CREATE TABLE [table] ([json] NVARCHAR(MAX) DEFAULT N'null');`,
      sqlite3: "CREATE TABLE IF NOT EXISTS `table` (`json` TEXT DEFAULT 'null');",
    });
  });
});
