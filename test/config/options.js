import path from 'node:path';

export default {
  configFile: path.resolve('config', 'database.json'),
  migrationsPath: path.resolve('db', 'migrate')
};
