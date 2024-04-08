import type { ConnectionOptions, Options } from '@sequelize/core';
import { Db2Dialect } from '@sequelize/db2';
import { IBMiDialect } from '@sequelize/db2-ibmi';
import { MariaDbDialect } from '@sequelize/mariadb';
import { MsSqlDialect } from '@sequelize/mssql';
import { MySqlDialect } from '@sequelize/mysql';
import { PostgresDialect } from '@sequelize/postgres';
import { SnowflakeDialect } from '@sequelize/snowflake';
import { SqliteDialect } from '@sequelize/sqlite3';
import { parseSafeInteger } from '@sequelize/utils';
import path from 'node:path';

export const SQLITE_DATABASES_DIR = path.join(__dirname, '..', 'sqlite-databases');

export function getSqliteDatabasePath(name: string): string {
  return path.join(SQLITE_DATABASES_DIR, name);
}

const { env } = process;

export interface DialectConfigs {
  mssql: Options<MsSqlDialect>;
  mysql: Options<MySqlDialect>;
  snowflake: Options<SnowflakeDialect>;
  mariadb: Options<MariaDbDialect>;
  sqlite3: Options<SqliteDialect>;
  postgres: Options<PostgresDialect>;
  db2: Options<Db2Dialect>;
  ibmi: Options<IBMiDialect>;
}

export interface DialectConnectionConfigs {
  mssql: ConnectionOptions<MsSqlDialect>;
  mysql: ConnectionOptions<MySqlDialect>;
  snowflake: ConnectionOptions<SnowflakeDialect>;
  mariadb: ConnectionOptions<MariaDbDialect>;
  sqlite3: ConnectionOptions<SqliteDialect>;
  postgres: ConnectionOptions<PostgresDialect>;
  db2: ConnectionOptions<Db2Dialect>;
  ibmi: ConnectionOptions<IBMiDialect>;
}

const seqPort = env.SEQ_PORT ? parseSafeInteger.orThrow(env.SEQ_PORT) : undefined;

export const CONFIG: DialectConfigs = {
  mssql: {
    dialect: MsSqlDialect,
    authentication: {
      type: 'default',
      options: {
        userName: env.SEQ_MSSQL_USER || env.SEQ_USER || 'SA',
        password: env.SEQ_MSSQL_PW || env.SEQ_PW || 'Password12!',
      },
    },
    database: env.SEQ_MSSQL_DB || env.SEQ_DB || 'sequelize_test',
    encrypt: false,
    pool: {
      max: parseSafeInteger.orThrow(env.SEQ_MSSQL_POOL_MAX || env.SEQ_POOL_MAX || 5),
      idle: parseSafeInteger.orThrow(env.SEQ_MSSQL_POOL_IDLE || env.SEQ_POOL_IDLE || 3000),
    },
    port: parseSafeInteger.orThrow(env.SEQ_MSSQL_PORT || seqPort || 22_019),
    requestTimeout: 25_000,
    server: env.SEQ_MSSQL_HOST || env.SEQ_HOST || 'localhost',
  },

  mysql: {
    dialect: MySqlDialect,
    database: env.SEQ_MYSQL_DB || env.SEQ_DB || 'sequelize_test',
    user: env.SEQ_MYSQL_USER || env.SEQ_USER || 'sequelize_test',
    password: env.SEQ_MYSQL_PW || env.SEQ_PW || 'sequelize_test',
    host: env.MYSQL_PORT_3306_TCP_ADDR || env.SEQ_MYSQL_HOST || env.SEQ_HOST || '127.0.0.1',
    port: parseSafeInteger.orThrow(
      env.MYSQL_PORT_3306_TCP_PORT || env.SEQ_MYSQL_PORT || seqPort || 20_057,
    ),
    pool: {
      max: parseSafeInteger.orThrow(env.SEQ_MYSQL_POOL_MAX || env.SEQ_POOL_MAX || 5),
      idle: parseSafeInteger.orThrow(env.SEQ_MYSQL_POOL_IDLE || env.SEQ_POOL_IDLE || 3000),
    },
  },

  snowflake: {
    dialect: SnowflakeDialect,
    username: env.SEQ_SNOWFLAKE_USER || env.SEQ_USER || 'root',
    password: env.SEQ_SNOWFLAKE_PW || env.SEQ_PW || '',
    database: env.SEQ_SNOWFLAKE_DB || env.SEQ_DB || 'sequelize_test',
    account: env.SEQ_SNOWFLAKE_ACCOUNT || env.SEQ_ACCOUNT || 'sequelize_test',
    role: env.SEQ_SNOWFLAKE_ROLE || env.SEQ_ROLE || 'role',
    warehouse: env.SEQ_SNOWFLAKE_WH || env.SEQ_WH || 'warehouse',
    schema: env.SEQ_SNOWFLAKE_SCHEMA || env.SEQ_SCHEMA || '',
  },

  mariadb: {
    dialect: MariaDbDialect,
    database: env.SEQ_MARIADB_DB || env.SEQ_DB || 'sequelize_test',
    user: env.SEQ_MARIADB_USER || env.SEQ_USER || 'sequelize_test',
    password: env.SEQ_MARIADB_PW || env.SEQ_PW || 'sequelize_test',
    host: env.MARIADB_PORT_3306_TCP_ADDR || env.SEQ_MARIADB_HOST || env.SEQ_HOST || '127.0.0.1',
    port: parseSafeInteger.orThrow(
      env.MARIADB_PORT_3306_TCP_PORT || env.SEQ_MARIADB_PORT || seqPort || 21_103,
    ),
    pool: {
      max: Number(env.SEQ_MARIADB_POOL_MAX || env.SEQ_POOL_MAX || 5),
      idle: Number(env.SEQ_MARIADB_POOL_IDLE || env.SEQ_POOL_IDLE || 3000),
    },
  },

  sqlite3: {
    dialect: SqliteDialect,
    storage: getSqliteDatabasePath('default.sqlite'),
  },

  postgres: {
    dialect: PostgresDialect,
    database: env.SEQ_PG_DB || env.SEQ_DB || 'sequelize_test',
    user: env.SEQ_PG_USER || env.SEQ_USER || 'sequelize_test',
    password: env.SEQ_PG_PW || env.SEQ_PW || 'sequelize_test',
    host: env.POSTGRES_PORT_5432_TCP_ADDR || env.SEQ_PG_HOST || env.SEQ_HOST || '127.0.0.1',
    port: parseSafeInteger.orThrow(
      env.POSTGRES_PORT_5432_TCP_PORT || env.SEQ_PG_PORT || seqPort || 23_010,
    ),
    pool: {
      max: Number(env.SEQ_PG_POOL_MAX || env.SEQ_POOL_MAX || 5),
      idle: Number(env.SEQ_PG_POOL_IDLE || env.SEQ_POOL_IDLE || 3000),
    },
    minifyAliases: Boolean(env.SEQ_PG_MINIFY_ALIASES),
  },

  db2: {
    dialect: Db2Dialect,
    database: env.SEQ_DB2_DB || env.SEQ_DB || env.IBM_DB_DBNAME || 'testdb',
    username: env.SEQ_DB2_USER || env.SEQ_USER || env.IBM_DB_UID || 'db2inst1',
    password: env.SEQ_DB2_PW || env.SEQ_PW || env.IBM_DB_PWD || 'password',
    hostname:
      env.DB2_PORT_50000_TCP_ADDR ||
      env.SEQ_DB2_HOST ||
      env.SEQ_HOST ||
      env.IBM_DB_HOSTNAME ||
      '127.0.0.1',
    port: env.DB2_PORT_50000_TCP_PORT || env.SEQ_DB2_PORT || seqPort || env.IBM_DB_PORT || 50_000,
    pool: {
      max: parseSafeInteger.orThrow(env.SEQ_DB2_POOL_MAX || env.SEQ_POOL_MAX || 5),
      idle: parseSafeInteger.orThrow(env.SEQ_DB2_POOL_IDLE || env.SEQ_POOL_IDLE || 3000),
    },
  },

  ibmi: {
    dialect: IBMiDialect,
    dataSourceName: env.SEQ_IBMI_DB || env.SEQ_DB,
    username: env.SEQ_IBMI_USER || env.SEQ_USER,
    password: env.SEQ_IBMI_PW || env.SEQ_PW,
    pool: {
      max: Number(env.SEQ_IBMI_POOL_MAX || env.SEQ_POOL_MAX || env.SEQ_POOL_MAX || 5),
      idle: Number(env.SEQ_IBMI_POOL_IDLE || env.SEQ_POOL_IDLE || 3000),
    },
    odbcConnectionString: env.SEQ_IBMI_CONN_STR,
  },
};
