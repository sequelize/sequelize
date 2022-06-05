'use strict';
// const sequelize = require('../../../test/support').createSequelizeInstance();

// (async () => {
//   await sequelize.authenticate();
//   await sequelize.close();
// })();

(async ()=>{
  const { Sequelize } = require('@sequelize/core');
  const Config = await import('../../../test/config/config.js').then(({ Config }) => Config);
  const defaults  = require('lodash/defaults');
  const options = { dialect: 'mysql' };
  const config = Config[options.dialect];

  const sequelizeOptions = defaults(options, {
    host: options.host || config.host,
    logging: process.env.SEQ_LOG ? console.debug : false,
    dialect: options.dialect,
    port: options.port || process.env.SEQ_PORT || config.port,
    pool: config.pool,
    dialectOptions: options.dialectOptions || config.dialectOptions || {},
    minifyAliases: options.minifyAliases || config.minifyAliases,
  });

  if (config.storage || config.storage === '') {
    sequelizeOptions.storage = config.storage;
  }

  const sequelize = new Sequelize(
    config.database,
    config.username,
    config.password,
    sequelizeOptions
  )

  await sequelize.authenticate();
  await sequelize.close();
})()