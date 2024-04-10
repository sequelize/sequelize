'use strict';

import type { AbstractDialect, DialectName } from '@sequelize/core';
import {
  ConnectionRefusedError,
  HostNotReachableError,
  InvalidConnectionError,
  Sequelize,
} from '@sequelize/core';
import { OPEN_READONLY, OPEN_READWRITE, SqliteDialect } from '@sequelize/sqlite3';
import { expect } from 'chai';
import type { Class } from 'type-fest';
import type { DialectConfigs } from '../config/config';
import { CONFIG } from '../config/config';
import {
  destroySequelizeAfterTest,
  getSqliteDatabasePath,
  getTestDialect,
  setResetMode,
  unlinkIfExists,
} from './support';

const dialectName = getTestDialect();

describe('Configuration', () => {
  setResetMode('none');

  // See https://github.com/sequelize/sequelize/issues/17240
  it.skip(`throw HostNotReachableError when we don't have the correct server details`, async () => {
    const badHostConfigs: DialectConfigs = {
      mssql: {
        ...CONFIG.mssql,
        server: 'fhewiougjhewio.kiwi',
        connectTimeout: 100,
      },
      ibmi: {
        ...CONFIG.ibmi,
        dataSourceName: 'WRONG',
      },
      mysql: {
        ...CONFIG.mysql,
        port: 19_999,
      },
      mariadb: {
        ...CONFIG.mariadb,
        port: 19_999,
      },
      postgres: {
        ...CONFIG.postgres,
        port: 19_999,
      },
      snowflake: {
        ...CONFIG.snowflake,
        account: 'WRONG',
      },
      db2: {
        ...CONFIG.db2,
        port: 19_999,
      },
      sqlite3: {
        ...CONFIG.sqlite3,
        storage: '/path/to/no/where/land',
        mode: OPEN_READONLY,
      },
    };

    const errorByDialect: Record<DialectName, Class<Error>> = {
      mssql: ConnectionRefusedError,
      ibmi: ConnectionRefusedError,
      mysql: ConnectionRefusedError,
      mariadb: ConnectionRefusedError,
      postgres: ConnectionRefusedError,
      snowflake: HostNotReachableError,
      db2: ConnectionRefusedError,
      sqlite3: InvalidConnectionError,
    };

    const seq = new Sequelize<AbstractDialect>(badHostConfigs[dialectName]);
    destroySequelizeAfterTest(seq);

    await expect(seq.query('select 1 as hello')).to.be.rejectedWith(errorByDialect[dialectName]);
  });

  // See https://github.com/sequelize/sequelize/issues/17240
  it.skip('throws ConnectionRefusedError when we have the wrong credentials', async () => {
    // The following dialects do not have credentials
    if (dialectName === 'sqlite3') {
      return;
    }

    const config: Omit<DialectConfigs, 'sqlite3'> = {
      mssql: {
        ...CONFIG.mssql,
        authentication: {
          ...CONFIG.mssql.authentication,
          options: {
            ...CONFIG.mssql.authentication!.options,
            password: 'wrongpassword',
          },
        },
      },
      mysql: {
        ...CONFIG.mysql,
        password: 'wrongpassword',
      },
      mariadb: {
        ...CONFIG.mariadb,
        password: 'wrongpassword',
      },
      postgres: {
        ...CONFIG.postgres,
        password: 'wrongpassword',
      },
      snowflake: {
        ...CONFIG.snowflake,
        password: 'wrongpassword',
      },
      db2: {
        ...CONFIG.db2,
        password: 'wrongpassword',
      },
      ibmi: {
        ...CONFIG.ibmi,
        password: 'wrongpassword',
      },
    };

    const seq = new Sequelize<AbstractDialect>(config[dialectName]);

    destroySequelizeAfterTest(seq);

    const query =
      dialectName === 'ibmi' ? 'select 1 as hello from SYSIBM.SYSDUMMY1' : 'select 1 as hello';

    await expect(seq.query(query)).to.be.rejectedWith(ConnectionRefusedError);
  });

  it('[sqlite] respects READONLY / READWRITE connection modes', async () => {
    if (dialectName !== 'sqlite3') {
      return;
    }

    const dbPath = getSqliteDatabasePath('rw-options-test.sqlite');

    await unlinkIfExists(dbPath);

    const sequelizeReadOnly0 = new Sequelize({
      dialect: SqliteDialect,
      storage: dbPath,
      mode: OPEN_READONLY,
    });
    destroySequelizeAfterTest(sequelizeReadOnly0);

    const sequelizeReadWrite0 = new Sequelize({
      dialect: SqliteDialect,
      storage: dbPath,
      mode: OPEN_READWRITE,
    });
    destroySequelizeAfterTest(sequelizeReadWrite0);

    expect(sequelizeReadOnly0.options.replication.write.mode).to.equal(OPEN_READONLY);
    expect(sequelizeReadWrite0.options.replication.write.mode).to.equal(OPEN_READWRITE);

    const createTableFoo = 'CREATE TABLE foo (faz TEXT);';
    await Promise.all([
      sequelizeReadOnly0
        .query(createTableFoo)
        .should.be.rejectedWith(Error, 'SQLITE_CANTOPEN: unable to open database file'),
      sequelizeReadWrite0
        .query(createTableFoo)
        .should.be.rejectedWith(Error, 'SQLITE_CANTOPEN: unable to open database file'),
    ]);

    // By default, sqlite creates a connection that's READWRITE | CREATE
    // So this query will create a DB file
    const sequelize = new Sequelize({
      dialect: SqliteDialect,
      storage: dbPath,
    });

    destroySequelizeAfterTest(sequelize);
    await sequelize.query(createTableFoo);
    // await testAccess(roPath);
    const sequelizeReadOnly = new Sequelize({
      dialect: SqliteDialect,
      storage: dbPath,
      mode: OPEN_READONLY,
    });
    destroySequelizeAfterTest(sequelizeReadOnly);

    const sequelizeReadWrite = new Sequelize({
      dialect: SqliteDialect,
      storage: dbPath,
      mode: OPEN_READWRITE,
    });
    destroySequelizeAfterTest(sequelizeReadWrite);

    const createTableBar = 'CREATE TABLE bar (baz TEXT);';
    await Promise.all([
      sequelizeReadOnly
        .query(createTableBar)
        .should.be.rejectedWith(Error, 'SQLITE_READONLY: attempt to write a readonly database'),
      sequelizeReadWrite.query(createTableBar),
    ]);
  });
});
