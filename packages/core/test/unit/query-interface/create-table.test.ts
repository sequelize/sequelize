import { DataTypes, JSON_NULL, sql } from '@sequelize/core';
import { expect } from 'chai';
import sinon from 'sinon';
import { createSequelizeInstance, expectsql, sequelize } from '../../support';

const { dialect } = sequelize;

describe('QueryInterface#createTable', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('supports sql.random default values', async () => {
    const stub = sinon.stub(sequelize, 'queryRaw');
    await sequelize.queryInterface.createTable('table', {
      value: {
        type: DataTypes.FLOAT(),
        defaultValue: sql.random,
      },
    });

    expect(stub.callCount).to.eq(1);
    const firstCall = stub.getCall(0);
    expectsql(firstCall.args[0], {
      postgres: 'CREATE TABLE IF NOT EXISTS "table" ("value" REAL DEFAULT RANDOM());',
      'mariadb mysql':
        'CREATE TABLE IF NOT EXISTS `table` (`value` FLOAT DEFAULT (RAND())) ENGINE=InnoDB;',
      mssql: `IF OBJECT_ID(N'[table]', 'U') IS NULL CREATE TABLE [table] ([value] REAL DEFAULT RAND());`,
      sqlite3:
        'CREATE TABLE IF NOT EXISTS `table` (`value` REAL DEFAULT ((RANDOM() + 9223372036854775808.0) / 18446744073709551616.0));',
      snowflake: 'CREATE TABLE IF NOT EXISTS "table" ("value" FLOAT DEFAULT RANDOM());',
      db2: 'CREATE TABLE IF NOT EXISTS "table" ("value" REAL DEFAULT RAND());',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "table" ("value" REAL DEFAULT RAND()); END`,
      oracle: `BEGIN EXECUTE IMMEDIATE 'CREATE TABLE "table" ("value" BINARY_FLOAT DEFAULT DBMS_RANDOM.VALUE())'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF; END;`,
    });
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
      oracle: `BEGIN EXECUTE IMMEDIATE 'CREATE TABLE "table" ("id" VARCHAR2(36),PRIMARY KEY ("id"))'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF; END;`,
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

    it('supports sql.uuidV7 default values (postgres >= 18)', async () => {
      const localSequelize = createSequelizeInstance({
        databaseVersion: '18.0.0',
      });

      const stub = sinon.stub(localSequelize, 'queryRaw');

      await localSequelize.queryInterface.createTable('table', {
        id: {
          type: DataTypes.UUID,
          primaryKey: true,
          defaultValue: sql.uuidV7,
        },
      });

      expect(stub.callCount).to.eq(1);
      const firstCall = stub.getCall(0);
      expectsql(firstCall.args[0], {
        postgres:
          'CREATE TABLE IF NOT EXISTS "table" ("id" UUID DEFAULT uuidv7(), PRIMARY KEY ("id"));',
      });
    });

    it('supports sql.uuidV7 default values (postgres < 18)', async () => {
      const localSequelize = createSequelizeInstance({
        databaseVersion: '17.0.0',
      });

      const stub = sinon.stub(localSequelize, 'queryRaw');

      await localSequelize.queryInterface.createTable('table', {
        id: {
          type: DataTypes.UUID,
          primaryKey: true,
          defaultValue: sql.uuidV7,
        },
      });

      expect(stub.callCount).to.eq(1);
      const firstCall = stub.getCall(0);
      expectsql(firstCall.args[0], {
        postgres: 'CREATE TABLE IF NOT EXISTS "table" ("id" UUID, PRIMARY KEY ("id"));',
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
      'mariadb mysql':
        'CREATE TABLE IF NOT EXISTS `table` (`id` CHAR(36) BINARY DEFAULT (UUID()), PRIMARY KEY (`id`)) ENGINE=InnoDB;',
      mssql: `IF OBJECT_ID(N'[table]', 'U') IS NULL CREATE TABLE [table] ([id] UNIQUEIDENTIFIER, PRIMARY KEY ([id]));`,
      sqlite3: 'CREATE TABLE IF NOT EXISTS `table` (`id` TEXT PRIMARY KEY);',
      snowflake: 'CREATE TABLE IF NOT EXISTS "table" ("id" VARCHAR(36), PRIMARY KEY ("id"));',
      db2: 'CREATE TABLE IF NOT EXISTS "table" ("id" CHAR(36) FOR BIT DATA NOT NULL, PRIMARY KEY ("id"));',
      ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42710' BEGIN END; CREATE TABLE "table" ("id" CHAR(36), PRIMARY KEY ("id")); END`,
      oracle: `BEGIN EXECUTE IMMEDIATE 'CREATE TABLE "table" ("id" VARCHAR2(36),PRIMARY KEY ("id"))'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF; END;`,
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
      mariadb: "CREATE TABLE IF NOT EXISTS `table` (`json` JSON DEFAULT ('null')) ENGINE=InnoDB;",
      mysql:
        "CREATE TABLE IF NOT EXISTS `table` (`json` JSON DEFAULT (CAST('null' AS JSON))) ENGINE=InnoDB;",
      mssql: `IF OBJECT_ID(N'[table]', 'U') IS NULL CREATE TABLE [table] ([json] NVARCHAR(MAX) DEFAULT N'null');`,
      sqlite3: "CREATE TABLE IF NOT EXISTS `table` (`json` TEXT DEFAULT 'null');",
      // oracle uses BLOB with CHECK constraint and JSON_NULL isn't allowed.
      oracle: `BEGIN EXECUTE IMMEDIATE 'CREATE TABLE "table" ("json" BLOB CHECK ("json" IS JSON))'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF; END;`,
    });
  });

  it('rejects the removed "schema" option', async () => {
    await expect(
      sequelize.queryInterface.createTable(
        'tasks',
        { id: DataTypes.INTEGER },
        // @ts-expect-error -- "schema" has been removed from the option bag on purpose
        { schema: 'tenant' },
      ),
    ).to.be.rejectedWith(TypeError, 'The "schema" option has been removed');
  });

  if (dialect.supports.schemas) {
    it("moves references to the default schema into the table's schema", async () => {
      const stub = sinon.stub(sequelize, 'queryRaw');
      await sequelize.queryInterface.createTable(
        { tableName: 'tasks', schema: 'tenant' },
        {
          userId: { type: DataTypes.INTEGER, references: { table: 'users', key: 'id' } },
          auditorId: {
            type: DataTypes.INTEGER,
            references: { table: { tableName: 'auditors' }, key: 'id' },
          },
          // associations resolve their reference through the model definition, which always
          // spells out the default schema. Such references must still follow the table.
          memberId: {
            type: DataTypes.INTEGER,
            references: {
              table: { tableName: 'members', schema: dialect.getDefaultSchema() },
              key: 'id',
            },
          },
          ownerId: {
            type: DataTypes.INTEGER,
            references: { table: { tableName: 'owners', schema: 'shared' }, key: 'id' },
          },
        },
      );

      expect(stub.callCount).to.eq(1);
      const { queryGenerator } = sequelize;
      const query = stub.getCall(0).args[0];
      for (const tableName of ['users', 'auditors', 'members']) {
        expect(query).to.include(
          `REFERENCES ${queryGenerator.quoteTable({ tableName, schema: 'tenant' })}`,
        );
      }

      expect(query).to.include(
        `REFERENCES ${queryGenerator.quoteTable({ tableName: 'owners', schema: 'shared' })}`,
      );
    });
  }
});
