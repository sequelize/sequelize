import { SqliteDialect } from '@sequelize/sqlite3';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const packageRoot = fileURLToPath(new URL('.', import.meta.url));

export default {
  database: {
    dialect: SqliteDialect,
    // One SQLite file per test run, reset between tests via deleteTestDatabase()
    storage: join(packageRoot, 'test-artifacts', 'test.sqlite3'),
  },
};

