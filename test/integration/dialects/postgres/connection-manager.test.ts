import type { Options } from '@sequelize/core';
import { DataTypes, QueryTypes } from '@sequelize/core';
import { expect } from 'chai';
import { createSequelizeInstance, getTestDialect, sequelize as defaultSequelize } from '../../support';

const dialect = getTestDialect();

describe('[POSTGRES] Sequelize', () => {
  if (!dialect.startsWith('postgres')) {
    return;
  }

  async function checkTimezoneParsing(baseOptions: Options) {
    const options = { ...baseOptions, timezone: 'Asia/Kolkata', timestamps: true };
    const tzSequelize = createSequelizeInstance(options);

    const tzTable = tzSequelize.define('tz_table', { foo: DataTypes.STRING });
    await tzTable.sync({ force: true });
    const row = await tzTable.create({ foo: 'test' });
    expect(row).to.be.not.null;
  }

  it('should correctly parse the timezone while fetching hstore oids', async () => {
    await checkTimezoneParsing(defaultSequelize.options);
  });

  it('should set client_min_messages to warning by default', async () => {
    const result = await defaultSequelize.query<{ client_min_messages: string }>('SHOW client_min_messages', { type: QueryTypes.SELECT });
    expect(result[0].client_min_messages).to.equal('warning');
  });

  it('should allow overriding client_min_messages (deprecated in v7)', async () => {
    const sequelize = createSequelizeInstance({ clientMinMessages: 'ERROR' });
    const result = await sequelize.query<{ client_min_messages: string }>('SHOW client_min_messages', { type: QueryTypes.SELECT });
    expect(result[0].client_min_messages).to.equal('error');
  });

  it('should not set client_min_messages if clientMinMessages is false (deprecated in v7)', async () => {
    const sequelize = createSequelizeInstance({ clientMinMessages: false });
    const result = await sequelize.query<{ client_min_messages: string }>('SHOW client_min_messages', { type: QueryTypes.SELECT });
    // `notice` is Postgres's default
    expect(result[0].client_min_messages).to.equal('notice');
  });

  it('should allow overriding client_min_messages', async () => {
    const sequelize = createSequelizeInstance({ dialectOptions: { clientMinMessages: 'ERROR' } });
    const result = await sequelize.query<{ client_min_messages: string }>('SHOW client_min_messages', { type: QueryTypes.SELECT });
    expect(result[0].client_min_messages).to.equal('error');
  });

  it('should not set client_min_messages if clientMinMessages is ignore', async () => {
    const sequelize = createSequelizeInstance({ dialectOptions: { clientMinMessages: 'IGNORE' } });
    const result = await sequelize.query<{ client_min_messages: string }>('SHOW client_min_messages', { type: QueryTypes.SELECT });
    // `notice` is Postgres's default
    expect(result[0].client_min_messages).to.equal('notice');
  });

  it('should time out the query request when the query runs beyond the configured query_timeout', async () => {
    const sequelize = createSequelizeInstance({
      dialectOptions: { query_timeout: 100 },
    });

    await expect(sequelize.query('select pg_sleep(2)')).to.be.rejectedWith('Query read timeout');
  });

  it('should allow overriding session variables through the `options` param', async () => {
    const sequelize = createSequelizeInstance({ dialectOptions: { options: '-csearch_path=abc' } });
    const result = await sequelize.query<{ search_path: string }>('SHOW search_path', { type: QueryTypes.SELECT });
    expect(result[0].search_path).to.equal('abc');
  });
});
