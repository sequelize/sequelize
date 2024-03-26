import type { AbstractDialect } from './dialects/abstract/index.js';
import type { DialectName } from './sequelize.js';

export function importDialect(dialect: DialectName): typeof AbstractDialect {
  // Requiring the dialect in a switch-case to keep the
  // require calls static. (Browserify fix)
  switch (dialect) {
    case 'mariadb':
      // eslint-disable-next-line import/no-extraneous-dependencies -- legacy function, will be removed. User needs to install the dependency themselves
      return require('@sequelize/mariadb').MariaDbDialect;
    case 'mssql':
      return require('./dialects/mssql').MsSqlDialect;
    case 'mysql':
      // eslint-disable-next-line import/no-extraneous-dependencies -- legacy function, will be removed. User needs to install the dependency themselves
      return require('@sequelize/mysql').MySqlDialect;
    case 'postgres':
      // eslint-disable-next-line import/no-extraneous-dependencies -- legacy function, will be removed. User needs to install the dependency themselves
      return require('@sequelize/postgres').PostgresDialect;
    case 'sqlite':
      // eslint-disable-next-line import/no-extraneous-dependencies -- legacy function, will be removed. User needs to install the dependency themselves
      return require('@sequelize/sqlite').SqliteDialect;
    case 'ibmi':
      return require('./dialects/ibmi').IBMiDialect;
    case 'db2':
      // eslint-disable-next-line import/no-extraneous-dependencies -- legacy function, will be removed. User needs to install the dependency themselves
      return require('@sequelize/db2').Db2Dialect;
    case 'snowflake':
      return require('./dialects/snowflake').SnowflakeDialect;
    default:
      throw new Error(
        `The dialect ${dialect} is not natively supported. Native dialects: mariadb, mssql, mysql, postgres, sqlite, ibmi, db2 and snowflake.`,
      );
  }
}
