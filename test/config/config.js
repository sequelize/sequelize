'use strict';

const { env } = process;

module.exports = {
  mssql: {
    host: env.SEQ_MSSQL_HOST || env.SEQ_HOST || 'localhost',
    username: env.SEQ_MSSQL_USER || env.SEQ_USER || 'SA',
    password: env.SEQ_MSSQL_PW || env.SEQ_PW || 'Password12!',
    port: env.SEQ_MSSQL_PORT || env.SEQ_PORT || 22_019,
    database: env.SEQ_MSSQL_DB || env.SEQ_DB || 'sequelize_test',
    dialectOptions: {
      options: {
        encrypt: false,
        requestTimeout: 25_000,
      },
    },
    pool: {
      max: env.SEQ_MSSQL_POOL_MAX || env.SEQ_POOL_MAX || 5,
      idle: env.SEQ_MSSQL_POOL_IDLE || env.SEQ_POOL_IDLE || 3000,
    },
  },

  mysql: {
    database: env.SEQ_MYSQL_DB || env.SEQ_DB || 'sequelize_test',
    username: env.SEQ_MYSQL_USER || env.SEQ_USER || 'sequelize_test',
    password: env.SEQ_MYSQL_PW || env.SEQ_PW || 'sequelize_test',
    host: env.MYSQL_PORT_3306_TCP_ADDR || env.SEQ_MYSQL_HOST || env.SEQ_HOST || '127.0.0.1',
    port: env.MYSQL_PORT_3306_TCP_PORT || env.SEQ_MYSQL_PORT || env.SEQ_PORT || 20_057,
    pool: {
      max: env.SEQ_MYSQL_POOL_MAX || env.SEQ_POOL_MAX || 5,
      idle: env.SEQ_MYSQL_POOL_IDLE || env.SEQ_POOL_IDLE || 3000,
    },
  },

  snowflake: {
    username: env.SEQ_SNOWFLAKE_USER || env.SEQ_USER || 'root',
    password: env.SEQ_SNOWFLAKE_PW || env.SEQ_PW || null,
    database: env.SEQ_SNOWFLAKE_DB || env.SEQ_DB || 'sequelize_test',
    dialectOptions: {
      account: env.SEQ_SNOWFLAKE_ACCOUNT || env.SEQ_ACCOUNT || 'sequelize_test',
      role: env.SEQ_SNOWFLAKE_ROLE || env.SEQ_ROLE || 'role',
      warehouse: env.SEQ_SNOWFLAKE_WH || env.SEQ_WH || 'warehouse',
      schema: env.SEQ_SNOWFLAKE_SCHEMA || env.SEQ_SCHEMA || '',
    },
  },

  mariadb: {
    database: env.SEQ_MARIADB_DB || env.SEQ_DB || 'sequelize_test',
    username: env.SEQ_MARIADB_USER || env.SEQ_USER || 'sequelize_test',
    password: env.SEQ_MARIADB_PW || env.SEQ_PW || 'sequelize_test',
    host: env.MARIADB_PORT_3306_TCP_ADDR || env.SEQ_MARIADB_HOST || env.SEQ_HOST || '127.0.0.1',
    port: env.MARIADB_PORT_3306_TCP_PORT || env.SEQ_MARIADB_PORT || env.SEQ_PORT || 21_103,
    pool: {
      max: env.SEQ_MARIADB_POOL_MAX || env.SEQ_POOL_MAX || 5,
      idle: env.SEQ_MARIADB_POOL_IDLE || env.SEQ_POOL_IDLE || 3000,
    },
  },

  sqlite: {},

  postgres: {
    database: env.SEQ_PG_DB || env.SEQ_DB || 'sequelize_test',
    username: env.SEQ_PG_USER || env.SEQ_USER || 'sequelize_test',
    password: env.SEQ_PG_PW || env.SEQ_PW || 'sequelize_test',
    host: env.POSTGRES_PORT_5432_TCP_ADDR || env.SEQ_PG_HOST || env.SEQ_HOST || '127.0.0.1',
    port: env.POSTGRES_PORT_5432_TCP_PORT || env.SEQ_PG_PORT || env.SEQ_PORT || 23_010,
    pool: {
      max: env.SEQ_PG_POOL_MAX || env.SEQ_POOL_MAX || 5,
      idle: env.SEQ_PG_POOL_IDLE || env.SEQ_POOL_IDLE || 3000,
    },
    minifyAliases: env.SEQ_PG_MINIFY_ALIASES,
  },

  yugabyte: {
    database: env.SEQ_YB_DB || env.SEQ_DB || 'sequelize_test',
    username: env.SEQ_YB_USER || env.SEQ_USER || 'yugabyte',
    password: env.SEQ_YB_PW || env.SEQ_PW || 'yugabyte',
    host: env.YUGABYTE_PORT_5432_TCP_ADDR || env.SEQ_YB_HOST || env.SEQ_HOST || '127.0.0.1',
    port: env.YUGABYTE_PORT_5432_TCP_PORT || env.SEQ_YB_PORT || env.SEQ_PORT || 25_099,
    pool: {
      max: env.SEQ_YB_POOL_MAX || env.SEQ_POOL_MAX || 5,
      idle: env.SEQ_YB_POOL_IDLE || env.SEQ_POOL_IDLE || 3000,
    },
    minifyAliases: env.SEQ_YB_MINIFY_ALIASES,
  },

  db2: {
    database: process.env.SEQ_DB2_DB || process.env.SEQ_DB   || process.env.IBM_DB_DBNAME || 'testdb',
    username: process.env.SEQ_DB2_USER || process.env.SEQ_USER || process.env.IBM_DB_UID || 'db2inst1',
    password: process.env.SEQ_DB2_PW   || process.env.SEQ_PW   || process.env.IBM_DB_PWD || 'password',
    host: process.env.DB2_PORT_50000_TCP_ADDR || process.env.SEQ_DB2_HOST || process.env.SEQ_HOST || process.env.IBM_DB_HOSTNAME || '127.0.0.1',
    port: process.env.DB2_PORT_50000_TCP_PORT || process.env.SEQ_DB2_PORT || process.env.SEQ_PORT || process.env.IBM_DB_PORT || 50_000,
    pool: {
      max: process.env.SEQ_DB2_POOL_MAX  || process.env.SEQ_POOL_MAX  || 5,
      idle: process.env.SEQ_DB2_POOL_IDLE || process.env.SEQ_POOL_IDLE || 3000,
    },
  },
  ibmi: {
    database: env.SEQ_IBMI_DB || env.SEQ_DB,
    username: process.env.SEQ_IBMI_USER || process.env.SEQ_USER,
    password: process.env.SEQ_IBMI_PW || process.env.SEQ_PW,
    pool: {
      max: env.SEQ_IBMI_POOL_MAX || env.SEQ_POOL_MAX || env.SEQ_POOL_MAX || 5,
      idle: env.SEQ_IBMI_POOL_IDLE || env.SEQ_POOL_IDLE || 3000,
    },
    dialectOptions: {
      odbcConnectionString: env.SEQ_IBMI_CONN_STR,
    },
  },
};
