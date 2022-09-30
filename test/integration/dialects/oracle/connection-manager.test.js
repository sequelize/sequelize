'use strict';

const config = require('../../../config/config.js').oracle;
const Support = require('../../../support');
const dialect = Support.getTestDialect();

if (dialect === 'oracle') {
  describe('[Oracle Specific] Connection Manager', () => {
    it('connect string authentication using connection Descriptor', async () => {
      const connDesc = `(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=${config.host})(PORT=${config.port}))(CONNECT_DATA=(SERVICE_NAME=${config.database})))`;
      const sequelize = await Support.getSequelizeInstance(config.database, config.username, config.password, { dialectOptions: { connectString: connDesc } });
      await sequelize.authenticate().should.be.ok;
    });
  });
}