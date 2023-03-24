'use strict';

const chai = require('chai');
const expect = chai.expect;
const config = require('../../../config/config.js').oracle;
const Support = require('../../support');
const dialect = Support.getTestDialect();
const Sequelize = Support.Sequelize;

if (dialect === 'oracle') {
  describe('[Oracle Specific] Connection Manager', () => {
    it('connect string authentication using connection Descriptor', async () => {
      const connDesc = `(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=${config.host})(PORT=${config.port}))(CONNECT_DATA=(SERVICE_NAME=${config.database})))`;
      const sequelize = new Sequelize({ username: config.username, password: config.password, dialect: 'oracle', dialectOptions: { connectString: connDesc } });
      await expect(sequelize.authenticate()).not.to.be.rejected;
    });
  });
}
