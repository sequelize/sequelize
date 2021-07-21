'use strict';

const sequelize = require('../../../test/support').createSequelizeInstance();

(async () => {
  await sequelize.authenticate();
  await sequelize.close();
})();
