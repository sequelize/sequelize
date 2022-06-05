'use strict';

/* // Commented out until we compile test/*.ts for /dev to use
const sequelize = require('../../../test/support').createSequelizeInstance();

(async () => {
  await sequelize.authenticate();
  await sequelize.close();
})();
*/

/* This can be replaced with the above, once Once the typescript files are sorted out in the test environment */

const fs = require('fs');
const path = require('path');
const {env} = process; // used in eval()

// Setup `Config` variable from test/config/config.ts
const file = path.resolve(__dirname, '../test/config/config.ts');
let source = fs.readFileSync(file, { encoding: 'utf8', flag: 'r' });
source = source.toString().split('\n').slice(5);
source.unshift('Config = {')
source = source.join('\n');
let Config;
eval(source); // <-- EVIL, however necessary


(async ()=>{
  const { Sequelize } = require('@sequelize/core');
  const defaults  = require('lodash/defaults');
  const options = { dialect: process.env.DIALECT };
  const config = Config[options.dialect];
  console.log(`Testing Sequelize connection to ${options.dialect}`);

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

})();
