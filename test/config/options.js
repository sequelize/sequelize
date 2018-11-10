'use strict';

const path = require('path');

module.exports = {
  configFile: path.resolve('config', 'database.json'),
  migrationsPath: path.resolve('db', 'migrate')
};
