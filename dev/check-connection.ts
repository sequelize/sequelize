import { createSequelizeInstance } from '../test/support';

const sequelize = createSequelizeInstance();

(async () => {
  await sequelize.authenticate();
  await sequelize.close();
})();
