'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../../support');
const dialect = Support.getTestDialect();

if (dialect === 'hana') {
  describe('[HANA Specific] Connection Manager', async () => {
    console.log('HANA dummy test');
    expect(true).to.be.ok;

    const sequelize = Support.createSingleTestSequelizeInstance({
      keepDefaultTimezone: true,
      pool: { min: 1, max: 1, handleDisconnects: true, idle: 5000 }
    });
    const pool = sequelize.pool;
    const cm = sequelize.dialect.connectionManager;

    await sequelize.sync();

    const connection = await pool.acquire();
    expect(cm.validate(connection)).to.be.ok;
    pool.release(connection);
  });
}
