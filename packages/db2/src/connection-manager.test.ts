import { ConnectionError, ConnectionRefusedError, Sequelize } from '@sequelize/core';
import type { IbmDbModule } from '@sequelize/db2';
import { Db2Dialect } from '@sequelize/db2';
import { expect } from 'chai';

async function connectWithOpenError(openError: Error): Promise<unknown> {
  const ibmDbModule = {
    Database: class FakeDatabase {
      open(_connStr: unknown, callback: (error: Error) => void) {
        callback(openError);
      }
    },
  } as unknown as IbmDbModule;

  const sequelize = new Sequelize({
    dialect: Db2Dialect,
    database: 'testdb',
    hostname: 'localhost',
    ibmDbModule,
  });

  try {
    await sequelize.dialect.connectionManager.connect(sequelize.options.replication.write);
  } catch (error) {
    return error;
  }

  throw new Error('Expected connect() to reject');
}

describe('Db2ConnectionManager#connect', () => {
  it('rejects with a ConnectionRefusedError for SQL30081N errors', async () => {
    const openError = new Error(
      '[IBM][CLI Driver] SQL30081N  A communication error has been detected.',
    );

    const error = await connectWithOpenError(openError);

    expect(error).to.be.instanceOf(ConnectionRefusedError);
    expect((error as ConnectionRefusedError).cause).to.equal(openError);
  });

  it('rejects with a ConnectionError for other errors', async () => {
    const openError = new Error('[IBM][CLI Driver] SQL30082N  Security processing failed.');

    const error = await connectWithOpenError(openError);

    expect(error).to.be.instanceOf(ConnectionError);
    expect(error).not.to.be.instanceOf(ConnectionRefusedError);
    expect((error as ConnectionError).cause).to.equal(openError);
  });
});
