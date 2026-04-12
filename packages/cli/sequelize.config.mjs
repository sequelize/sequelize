import { SqliteDialect } from '@sequelize/sqlite3';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = fileURLToPath(new URL('.', import.meta.url));

// eslint-disable-next-line import/no-default-export -- config files always use default exports
export default {
  database: {
    dialect: SqliteDialect,
    storage: join(packageRoot, 'test-artifacts', 'test.sqlite3'),
  },
};
