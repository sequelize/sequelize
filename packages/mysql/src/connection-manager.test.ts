import type { Options } from '@sequelize/core';
import { Sequelize } from '@sequelize/core';
import type { MySql2Module, MySqlConnection } from '@sequelize/mysql';
import { MySqlDialect } from '@sequelize/mysql';
import { expect } from 'chai';
import type { ConnectionOptions } from 'mysql2';
import { EventEmitter } from 'node:events';
import sinon from 'sinon';

const JANUARY = new Date('2024-01-15T12:00:00Z');
const JULY = new Date('2024-07-15T12:00:00Z');

function createFakeMySql2() {
  const queries: string[] = [];
  const configs: ConnectionOptions[] = [];

  const mysql2Module = {
    createConnection(config: ConnectionOptions) {
      configs.push(config);

      const connection = Object.assign(new EventEmitter(), {
        stream: { destroyed: false },
        query(sql: string, callback: (error: Error | null, result: unknown) => void) {
          queries.push(sql);
          callback(null, {});
        },
      });

      setImmediate(() => connection.emit('connect'));

      return connection;
    },
  } as unknown as MySql2Module;

  return { mysql2Module, queries, configs };
}

describe('MySqlConnectionManager', () => {
  let clock: sinon.SinonFakeTimers | undefined;

  afterEach(() => {
    clock?.restore();
    clock = undefined;
  });

  function setup(options: Omit<Options<MySqlDialect>, 'dialect'>) {
    const fake = createFakeMySql2();
    const sequelize = new Sequelize({
      dialect: MySqlDialect,
      mysql2Module: fake.mysql2Module,
      ...options,
    });
    const { connectionManager } = sequelize.dialect;

    return {
      ...fake,
      connectionManager,
      connect: async () => connectionManager.connect({ port: 3306 }),
    };
  }

  it('sets a named session time zone, falling back to the current offset if the server does not know it', async () => {
    clock = sinon.useFakeTimers({ now: JANUARY, toFake: ['Date'] });
    const { connect, queries, configs } = setup({ timezone: 'Europe/Amsterdam' });

    await connect();

    expect(queries).to.deep.equal([
      `SET time_zone = IF(CONVERT_TZ('2000-01-01 00:00:00', '+00:00', 'Europe/Amsterdam') IS NULL, '+01:00', 'Europe/Amsterdam')`,
    ]);
    expect(configs[0]).not.to.have.property('timezone');
  });

  it('uses the offset that applies when the connection is opened as the fallback', async () => {
    clock = sinon.useFakeTimers({ now: JULY, toFake: ['Date'] });
    const { connect, queries } = setup({ timezone: 'Europe/Amsterdam' });

    await connect();

    expect(queries).to.deep.equal([
      `SET time_zone = IF(CONVERT_TZ('2000-01-01 00:00:00', '+00:00', 'Europe/Amsterdam') IS NULL, '+02:00', 'Europe/Amsterdam')`,
    ]);
  });

  it('sets an offset session time zone directly', async () => {
    const { connect, queries, configs } = setup({ timezone: '-04:00' });

    await connect();

    expect(queries).to.deep.equal([`SET time_zone = '-04:00'`]);
    expect(configs[0].timezone).to.equal('-04:00');
  });

  it('does not set the session time zone if keepDefaultTimezone is true', async () => {
    const { connect, queries } = setup({
      timezone: 'Europe/Amsterdam',
      keepDefaultTimezone: true,
    });

    await connect();

    expect(queries).to.deep.equal([]);
  });

  it('invalidates connections opened with a named time zone once its offset changes', async () => {
    clock = sinon.useFakeTimers({ now: JANUARY, toFake: ['Date'] });
    const named = setup({ timezone: 'Europe/Amsterdam' });
    const offset = setup({ timezone: '+01:00' });
    const kept = setup({ timezone: 'Europe/Amsterdam', keepDefaultTimezone: true });

    const namedConnection: MySqlConnection = await named.connect();
    const offsetConnection: MySqlConnection = await offset.connect();
    const keptConnection: MySqlConnection = await kept.connect();

    expect(named.connectionManager.validate(namedConnection)).to.equal(true);

    clock.setSystemTime(JULY);

    expect(named.connectionManager.validate(namedConnection)).to.equal(false);
    expect(offset.connectionManager.validate(offsetConnection)).to.equal(true);
    expect(kept.connectionManager.validate(keptConnection)).to.equal(true);

    const newConnection: MySqlConnection = await named.connect();
    expect(named.connectionManager.validate(newConnection)).to.equal(true);
  });
});
