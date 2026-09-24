import { ConnectionError, Sequelize } from '@sequelize/core';
import { SnowflakeDialect } from '@sequelize/snowflake';
import { expect } from 'chai';
import sinon from 'sinon';
import { getTestDialect } from '../../../support';

const dialect = getTestDialect();

describe('[SNOWFLAKE Specific] Connection Manager', () => {
  if (dialect !== 'snowflake') {
    return;
  }

  function createSequelize(
    options: { timezone?: string; keepDefaultTimezone?: boolean },
    executeError: Error | null = null,
  ) {
    let up = false;
    const connection = {
      connect(callback: (error: Error | null) => void) {
        up = true;
        callback(null);
      },
      execute: sinon.spy(
        ({ complete }: { sqlText: string; complete(error: Error | null): void }) => {
          complete(executeError);
        },
      ),
      isUp: () => up,
      destroy: sinon.spy((callback: (error: Error | null) => void) => {
        up = false;
        callback(null);
      }),
      getId: () => 'fake-connection',
    };
    const createConnection = sinon.fake.returns(connection);

    const sequelize = new Sequelize<SnowflakeDialect>({
      dialect: SnowflakeDialect,
      ...options,
      databaseVersion: '8.0.0',
      snowflakeSdkModule: { createConnection } as any,
    });

    return { sequelize, connection, createConnection };
  }

  it('throws a ConnectionError before connecting if the time zone is not a named time zone', async () => {
    const { sequelize, createConnection } = createSequelize({ timezone: '+01:00' });

    await expect(sequelize.pool.acquire()).to.be.rejectedWith(
      ConnectionError,
      'Snowflake only supports named timezones',
    );
    expect(createConnection).not.to.have.been.called;
  });

  it('throws a ConnectionError and closes the connection if setting the time zone fails', async () => {
    const executeError = new Error('Unknown time zone');
    const { sequelize, connection } = createSequelize(
      { timezone: 'Invalid/Timezone' },
      executeError,
    );

    const error = await sequelize.pool.acquire().then(
      () => null,
      (error_: unknown) => error_,
    );

    expect(error).to.be.instanceOf(ConnectionError);
    expect((error as ConnectionError).cause).to.equal(executeError);
    expect(connection.destroy).to.have.been.calledOnce;
    expect(connection.isUp()).to.equal(false);
  });

  it('sets the session time zone once connected', async () => {
    const { sequelize, connection } = createSequelize({});

    expect(await sequelize.pool.acquire()).to.equal(connection);
    expect(connection.execute).to.have.been.calledOnce;
    // The default '+00:00' is not a named time zone, so it is sent as 'Etc/UTC'
    expect(connection.execute.firstCall.args[0].sqlText).to.equal(
      `ALTER SESSION SET timezone = 'Etc/UTC'`,
    );
    expect(connection.destroy).not.to.have.been.called;
  });

  it('accepts time zone names without a slash', async () => {
    const { sequelize, connection } = createSequelize({ timezone: 'UTC' });

    expect(await sequelize.pool.acquire()).to.equal(connection);
    expect(connection.execute.firstCall.args[0].sqlText).to.equal(
      `ALTER SESSION SET timezone = 'UTC'`,
    );
  });

  it('does not set the session time zone if keepDefaultTimezone is set', async () => {
    const { sequelize, connection } = createSequelize({
      timezone: '+01:00',
      keepDefaultTimezone: true,
    });

    expect(await sequelize.pool.acquire()).to.equal(connection);
    expect(connection.execute).not.to.have.been.called;
  });
});
