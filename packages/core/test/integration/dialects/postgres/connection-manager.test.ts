import type { NormalizedOptions } from '@sequelize/core';
import { DataTypes, QueryTypes } from '@sequelize/core';
import type { PostgresDialect } from '@sequelize/postgres';
import { expect } from 'chai';
import {
  createSingleTestSequelizeInstance,
  sequelize as defaultSequelize,
  getTestDialect,
} from '../../support';

const dialect = getTestDialect();

describe('[POSTGRES] Sequelize', () => {
  if (!dialect.startsWith('postgres')) {
    return;
  }

  async function checkTimezoneParsing(baseOptions: NormalizedOptions<PostgresDialect>) {
    const options = { ...baseOptions, timezone: 'Asia/Kolkata' };
    const tzSequelize = createSingleTestSequelizeInstance(options);

    const tzTable = tzSequelize.define('tz_table', { foo: DataTypes.STRING });
    await tzTable.sync({ force: true });
    const row = await tzTable.create({ foo: 'test' });
    expect(row).to.be.not.null;
  }

  it('should correctly parse the timezone while fetching hstore oids', async () => {
    await checkTimezoneParsing(defaultSequelize.options as NormalizedOptions<PostgresDialect>);
  });

  it('should set client_min_messages to warning by default', async () => {
    const result = await defaultSequelize.query<{ client_min_messages: string }>(
      'SHOW client_min_messages',
      { type: QueryTypes.SELECT },
    );
    expect(result[0].client_min_messages).to.equal('warning');
  });

  it('should allow overriding client_min_messages', async () => {
    const sequelize = createSingleTestSequelizeInstance<PostgresDialect>({
      clientMinMessages: 'ERROR',
    });
    const result = await sequelize.query<{ client_min_messages: string }>(
      'SHOW client_min_messages',
      { type: QueryTypes.SELECT },
    );
    expect(result[0].client_min_messages).to.equal('error');
  });

  it('should not set client_min_messages if clientMinMessages is false', async () => {
    const sequelize = createSingleTestSequelizeInstance<PostgresDialect>({
      clientMinMessages: false,
    });
    const result = await sequelize.query<{ client_min_messages: string }>(
      'SHOW client_min_messages',
      { type: QueryTypes.SELECT },
    );
    // `notice` is Postgres's default
    expect(result[0].client_min_messages).to.equal('notice');
  });

  it('should time out the query request when the query runs beyond the configured query_timeout', async () => {
    const sequelize = createSingleTestSequelizeInstance<PostgresDialect>({
      query_timeout: 100,
    });

    await expect(sequelize.query('select pg_sleep(2)')).to.be.rejectedWith('Query read timeout');
  });

  it('should allow overriding session variables through the `options` param', async () => {
    const sequelize = createSingleTestSequelizeInstance<PostgresDialect>({
      options: '-csearch_path=abc',
    });
    const result = await sequelize.query<{ search_path: string }>('SHOW search_path', {
      type: QueryTypes.SELECT,
    });
    expect(result[0].search_path).to.equal('abc');
  });
});
