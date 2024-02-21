import { createSequelizeInstance } from '../packages/core/test/support';

const sequelize = createSequelizeInstance();

(async () => {
  await sequelize.authenticate();
  await sequelize.close();

  console.info(
    `Connected to ${sequelize.dialect.name} ${sequelize.getDatabaseVersion()} successfully`,
  );
})();
