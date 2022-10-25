import type { Sequelize } from '../../sequelize.js';
import type { QueryOptions } from '../../sequelize.js';

export async function withSqliteForeignKeysOff<T>(sequelize: Sequelize, options: QueryOptions, cb: () => Promise<T>): Promise<T> {
  try {
    await sequelize.query('PRAGMA foreign_keys = OFF', options);

    return await cb();
  } finally {
    await sequelize.query('PRAGMA foreign_keys = ON', options);
  }
}
