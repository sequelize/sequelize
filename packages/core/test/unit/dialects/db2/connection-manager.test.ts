import type { Options } from '@sequelize/core';
import { ConnectionError, ConnectionRefusedError, Sequelize } from '@sequelize/core';
import type { IbmDbModule } from '@sequelize/db2';
import { Db2Dialect } from '@sequelize/db2';
import { expect } from 'chai';
import type { SinonFakeTimers } from 'sinon';
import sinon from 'sinon';
import { getTestDialect } from '../../../support';

const dialect = getTestDialect();

describe('[DB2 Specific] Connection Manager', () => {
  if (dialect !== 'db2') {
    return;
  }

  let openError: Error | null;
  let config: Options<Db2Dialect>;
  let instance: Sequelize<Db2Dialect>;
  let clock: SinonFakeTimers | undefined;

  beforeEach(() => {
    openError = null;

    const ibmDbModule = {
      Database: class FakeDatabase {
        connected = false;

        open(_connStr: unknown, callback: (error: Error | null) => void) {
          this.connected = !openError;
          callback(openError);
        }

        close(callback: (error: Error | null) => void) {
          this.connected = false;
          callback(null);
        }
      },
    } as unknown as IbmDbModule;

    config = {
      dialect: Db2Dialect,
      database: 'testdb',
      hostname: 'localhost',
      ibmDbModule,
    };

    instance = new Sequelize<Db2Dialect>(config);
  });

  afterEach(async () => {
    clock?.restore();
    clock = undefined;
    await instance.close();
  });

  it('connect() and disconnect() resolve while fake timers are installed', async () => {
    clock = sinon.useFakeTimers();

    const connection = await instance.dialect.connectionManager.connect(config);
    expect(connection.connected).to.equal(true);

    await instance.dialect.connectionManager.disconnect(connection);
    expect(connection.connected).to.equal(false);
  });

  it('connect() rejects with a ConnectionRefusedError for SQL30081N errors', async () => {
    openError = new Error('[IBM][CLI Driver] SQL30081N  A communication error has been detected.');

    const error = await expect(
      instance.dialect.connectionManager.connect(config),
    ).to.be.rejectedWith(ConnectionRefusedError);
    expect(error.cause).to.equal(openError);
  });

  it('connect() rejects with a ConnectionError for other errors', async () => {
    openError = new Error('[IBM][CLI Driver] SQL30082N  Security processing failed.');

    const error = await expect(
      instance.dialect.connectionManager.connect(config),
    ).to.be.rejectedWith(ConnectionError);
    expect(error).not.to.be.instanceOf(ConnectionRefusedError);
    expect(error.cause).to.equal(openError);
  });
});
