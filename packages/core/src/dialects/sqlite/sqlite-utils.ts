import type { QueryRawOptions, Sequelize } from '../../sequelize.js';

export async function withSqliteForeignKeysOff<T>(
  sequelize: Sequelize,
  options: QueryRawOptions | undefined,
  cb: () => Promise<T>,
): Promise<T> {
  try {
    await sequelize.queryRaw('PRAGMA foreign_keys = OFF', options);

    return await cb();
  } finally {
    await sequelize.queryRaw('PRAGMA foreign_keys = ON', options);
  }
}
