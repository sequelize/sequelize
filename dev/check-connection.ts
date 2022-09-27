import Support from '../test/support';

const sequelize = Support.createSequelizeInstance();

(async () => {
  await sequelize.authenticate();
  await sequelize.close();

  console.info(`Connected to ${sequelize.dialect.name} ${sequelize.options.databaseVersion} successfully`);
})();
