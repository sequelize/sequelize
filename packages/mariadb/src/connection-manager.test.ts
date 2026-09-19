import type { Options } from '@sequelize/core';
import { Sequelize } from '@sequelize/core';
import type {
  MariaDbConnection,
  MariaDbConnectionOptions,
  MariaDbModule,
} from '@sequelize/mariadb';
import { MariaDbDialect } from '@sequelize/mariadb';
import { expect } from 'chai';
import type { ConnectionConfig } from 'mariadb';
import { EventEmitter } from 'node:events';
import sinon from 'sinon';

const JANUARY = new Date('2024-01-15T12:00:00Z');
const JULY = new Date('2024-07-15T12:00:00Z');

function createFakeMariaDb() {
  const configs: ConnectionConfig[] = [];

  const mariaDbModule = {
    async createConnection(config: ConnectionConfig) {
      configs.push(config);

      return Object.assign(new EventEmitter(), {
        serverVersion: () => '11.6.2-MariaDB',
        isValid: () => true,
      });
    },
  } as unknown as MariaDbModule;

  return { mariaDbModule, configs };
}

describe('MariaDbConnectionManager', () => {
  let clock: sinon.SinonFakeTimers | undefined;

  afterEach(() => {
    clock?.restore();
    clock = undefined;
  });

  function setup(options: Omit<Options<MariaDbDialect>, 'dialect'>) {
    const fake = createFakeMariaDb();
    const sequelize = new Sequelize({
      dialect: MariaDbDialect,
      mariaDbModule: fake.mariaDbModule,
      ...options,
    });
    const { connectionManager } = sequelize.dialect;

    return {
      ...fake,
      connectionManager,
      connect: async (config: MariaDbConnectionOptions = {}) => connectionManager.connect(config),
    };
  }

  it('sets a named session time zone, falling back to the current offset if the server does not know it', async () => {
    clock = sinon.useFakeTimers({ now: JANUARY, toFake: ['Date'] });
    const { connect, configs } = setup({ timezone: 'Europe/Amsterdam' });

    await connect();

    expect(configs[0].initSql).to.equal(
      `SET time_zone = IF(CONVERT_TZ('2000-01-01 00:00:00', '+00:00', 'Europe/Amsterdam') IS NULL, '+01:00', 'Europe/Amsterdam')`,
    );
    expect(configs[0]).not.to.have.property('timezone');
  });

  it('uses the offset that applies when the connection is opened as the fallback', async () => {
    clock = sinon.useFakeTimers({ now: JULY, toFake: ['Date'] });
    const { connect, configs } = setup({ timezone: 'Europe/Amsterdam' });

    await connect({ initSql: `SET @a = 1` });

    expect(configs[0].initSql).to.deep.equal([
      `SET @a = 1`,
      `SET time_zone = IF(CONVERT_TZ('2000-01-01 00:00:00', '+00:00', 'Europe/Amsterdam') IS NULL, '+02:00', 'Europe/Amsterdam')`,
    ]);
  });

  it('sets an offset session time zone directly', async () => {
    const { connect, configs } = setup({ timezone: '-04:00' });

    await connect();

    expect(configs[0].initSql).to.equal(`SET time_zone = '-04:00'`);
    expect(configs[0]).not.to.have.property('timezone');
  });

  it('does not set the session time zone if keepDefaultTimezone is true', async () => {
    const { connect, configs } = setup({
      timezone: 'Europe/Amsterdam',
      keepDefaultTimezone: true,
    });

    await connect();

    expect(configs[0]).not.to.have.property('initSql');
    expect(configs[0]).not.to.have.property('timezone');
  });

  it('invalidates connections opened with a named time zone once its offset changes', async () => {
    clock = sinon.useFakeTimers({ now: JANUARY, toFake: ['Date'] });
    const named = setup({ timezone: 'Europe/Amsterdam' });
    const offset = setup({ timezone: '+01:00' });
    const kept = setup({ timezone: 'Europe/Amsterdam', keepDefaultTimezone: true });

    const namedConnection: MariaDbConnection = await named.connect();
    const offsetConnection: MariaDbConnection = await offset.connect();
    const keptConnection: MariaDbConnection = await kept.connect();

    expect(named.connectionManager.validate(namedConnection)).to.equal(true);

    clock.setSystemTime(JULY);

    expect(named.connectionManager.validate(namedConnection)).to.equal(false);
    expect(offset.connectionManager.validate(offsetConnection)).to.equal(true);
    expect(kept.connectionManager.validate(keptConnection)).to.equal(true);

    const newConnection: MariaDbConnection = await named.connect();
    expect(named.connectionManager.validate(newConnection)).to.equal(true);
  });
});
