'use strict';

const { env } = process;

module.exports = {
  username: env.SEQ_USER || 'root',
  password: env.SEQ_PW || null,
  database: env.SEQ_DB || 'sequelize_test',
  host: env.SEQ_HOST || '127.0.0.1',
  pool: {
    max: env.SEQ_POOL_MAX || 5,
    idle: env.SEQ_POOL_IDLE || 30000
  },

  rand() {
    return parseInt(Math.random() * 999, 10);
  },

  mssql: {
    host: env.SEQ_MSSQL_HOST || env.SEQ_HOST || 'localhost',
    username: env.SEQ_MSSQL_USER || env.SEQ_USER || 'SA',
    password: env.SEQ_MSSQL_PW || env.SEQ_PW || 'Password12!',
    port: env.SEQ_MSSQL_PORT || env.SEQ_PORT || 1433,
    database: env.SEQ_MSSQL_DB || env.SEQ_DB || 'sequelize_test',
    dialectOptions: {
      options: {
        encrypt: false,
        requestTimeout: 25000
      }
    },
    pool: {
      max: env.SEQ_MSSQL_POOL_MAX || env.SEQ_POOL_MAX || 5,
      idle: env.SEQ_MSSQL_POOL_IDLE || env.SEQ_POOL_IDLE || 3000
    }
  },

  //make idle time small so that tests exit promptly
  mysql: {
    database: env.SEQ_MYSQL_DB || env.SEQ_DB || 'sequelize_test',
    username: env.SEQ_MYSQL_USER || env.SEQ_USER || 'root',
    password: env.SEQ_MYSQL_PW || env.SEQ_PW || null,
    host: env.MYSQL_PORT_3306_TCP_ADDR || env.SEQ_MYSQL_HOST || env.SEQ_HOST || '127.0.0.1',
    port: env.MYSQL_PORT_3306_TCP_PORT || env.SEQ_MYSQL_PORT || env.SEQ_PORT || 3306,
    pool: {
      max: env.SEQ_MYSQL_POOL_MAX || env.SEQ_POOL_MAX || 5,
      idle: env.SEQ_MYSQL_POOL_IDLE || env.SEQ_POOL_IDLE || 3000
    }
  },

  mariadb: {
    database: env.SEQ_MARIADB_DB || env.SEQ_DB || 'sequelize_test',
    username: env.SEQ_MARIADB_USER || env.SEQ_USER || 'root',
    password: env.SEQ_MARIADB_PW || env.SEQ_PW || null,
    host: env.MARIADB_PORT_3306_TCP_ADDR || env.SEQ_MARIADB_HOST || env.SEQ_HOST || '127.0.0.1',
    port: env.MARIADB_PORT_3306_TCP_PORT || env.SEQ_MARIADB_PORT || env.SEQ_PORT || 3306,
    pool: {
      max: env.SEQ_MARIADB_POOL_MAX || env.SEQ_POOL_MAX || 5,
      idle: env.SEQ_MARIADB_POOL_IDLE || env.SEQ_POOL_IDLE || 3000
    }
  },

  sqlite: {},

  postgres: {
    database: env.SEQ_PG_DB || env.SEQ_DB || 'sequelize_test',
    username: env.SEQ_PG_USER || env.SEQ_USER || 'postgres',
    password: env.SEQ_PG_PW || env.SEQ_PW || 'postgres',
    host: env.POSTGRES_PORT_5432_TCP_ADDR || env.SEQ_PG_HOST || env.SEQ_HOST || '127.0.0.1',
    port: env.POSTGRES_PORT_5432_TCP_PORT || env.SEQ_PG_PORT || env.SEQ_PORT || 5432,
    pool: {
      max: env.SEQ_PG_POOL_MAX || env.SEQ_POOL_MAX || 5,
      idle: env.SEQ_PG_POOL_IDLE || env.SEQ_POOL_IDLE || 3000
    },
    minifyAliases: env.SEQ_PG_MINIFY_ALIASES
  },
  db2: {
    database: process.env.SEQ_DB2_DB || process.env.SEQ_DB   || process.env.IBM_DB_DBNAME || 'SEQUEL',
    username: process.env.SEQ_DB2_USER || process.env.SEQ_USER || process.env.IBM_DB_UID || 'NEWTON',
    password: process.env.SEQ_DB2_PW   || process.env.SEQ_PW   || process.env.IBM_DB_PWD || 'A2m8test',
    host: process.env.DB2_PORT_50000_TCP_ADDR || process.env.SEQ_DB2_HOST || process.env.SEQ_HOST || process.env.IBM_DB_HOSTNAME || 'dlndevdbctdev01.dev.rocketsoftware.com',
    port: process.env.DB2_PORT_50000_TCP_PORT || process.env.SEQ_DB2_PORT || process.env.SEQ_PORT || process.env.IBM_DB_PORT || 60000,
    dialectOptions: {
      requestTimeout: 60000
    },
    pool: {
      max: process.env.SEQ_DB2_POOL_MAX  || process.env.SEQ_POOL_MAX  || 50,
      idle: process.env.SEQ_DB2_POOL_IDLE || process.env.SEQ_POOL_IDLE || 60000
    }
  }
};
