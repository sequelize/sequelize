import { ConnectionError, Sequelize } from '@sequelize/core';
import { MariaDbDialect } from '@sequelize/mariadb';
import { expect } from 'chai';

describe('MariaDbConnectionManager#connect', () => {
  it('throws a ConnectionError when the named time zone is invalid', async () => {
    let createConnectionCalled = false;
    const sequelize = new Sequelize<MariaDbDialect>({
      dialect: MariaDbDialect,
      timezone: 'Invalid/Timezone',
      mariaDbModule: {
        async createConnection() {
          createConnectionCalled = true;
          throw new Error('createConnection should not be called');
        },
      } as any,
    });

    const error = await sequelize.dialect.connectionManager.connect({}).then(
      () => null,
      (error_: unknown) => error_,
    );

    expect(error).to.be.instanceOf(ConnectionError);
    expect((error as ConnectionError).cause).to.have.property(
      'message',
      'Invalid time zone: Invalid/Timezone',
    );
    expect(createConnectionCalled).to.equal(false);
  });
});
