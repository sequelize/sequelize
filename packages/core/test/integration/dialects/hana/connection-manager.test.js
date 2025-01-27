'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../../support');
const dialect = Support.getTestDialect();

if (dialect === 'hana') {
  describe('[HANA Specific] Connection Manager', async () => {
    it('should acquire a valid connection with connection ID', async () => {
      const sequelize = Support.createSingleTestSequelizeInstance();
      const pool = sequelize.pool;

      const connection = await pool.acquire();
      expect(sequelize.dialect.connectionManager.validate(connection)).to.be.ok;
      expect(connection.id).to.be.ok;
      pool.release(connection);
    });
  });
}
