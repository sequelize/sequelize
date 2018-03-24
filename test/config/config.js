'use strict';

const fs = require('fs');
let mssqlConfig;
try {
  mssqlConfig = JSON.parse(fs.readFileSync(__dirname + '/mssql.json', 'utf8'));
} catch (e) {
  // ignore
}

module.exports = {
  username: process.env.SEQ_USER || 'root',
  password: process.env.SEQ_PW   || null,
  database: process.env.SEQ_DB   || 'sequelize_test',
  host: process.env.SEQ_HOST || '127.0.0.1',
  pool: {
    max: process.env.SEQ_POOL_MAX  || 5,
    idle: process.env.SEQ_POOL_IDLE || 30000
  },

  rand() {
    return parseInt(Math.random() * 999, 10);
  },

  mssql: mssqlConfig || {
    database: process.env.SEQ_MSSQL_DB   || process.env.SEQ_DB   || 'sequelize_test',
    username: process.env.SEQ_MSSQL_USER || process.env.SEQ_USER || 'sequelize',
    password: process.env.SEQ_MSSQL_PW   || process.env.SEQ_PW   || 'nEGkLma26gXVHFUAHJxcmsrK',
    host: process.env.SEQ_MSSQL_HOST || process.env.SEQ_HOST || '127.0.0.1',
    port: process.env.SEQ_MSSQL_PORT || process.env.SEQ_PORT || 1433,
    dialectOptions: {
      // big insert queries need a while
      requestTimeout: 60000
    },
    pool: {
      max: process.env.SEQ_MSSQL_POOL_MAX  || process.env.SEQ_POOL_MAX  || 5,
      idle: process.env.SEQ_MSSQL_POOL_IDLE || process.env.SEQ_POOL_IDLE || 3000
    }
  },

  //make idle time small so that tests exit promptly
  mysql: {
    database: process.env.SEQ_MYSQL_DB   || process.env.SEQ_DB   || 'sequelize_test',
    username: process.env.SEQ_MYSQL_USER || process.env.SEQ_USER || 'root',
    password: process.env.SEQ_MYSQL_PW   || process.env.SEQ_PW   || null,
    host: process.env.MYSQL_PORT_3306_TCP_ADDR || process.env.SEQ_MYSQL_HOST || process.env.SEQ_HOST || '127.0.0.1',
    port: process.env.MYSQL_PORT_3306_TCP_PORT || process.env.SEQ_MYSQL_PORT || process.env.SEQ_PORT || 3306,
    pool: {
      max: process.env.SEQ_MYSQL_POOL_MAX  || process.env.SEQ_POOL_MAX  || 5,
      idle: process.env.SEQ_MYSQL_POOL_IDLE || process.env.SEQ_POOL_IDLE || 3000
    }
  },

  sqlite: {
  },

  postgres: {
    database: process.env.SEQ_PG_DB   || process.env.SEQ_DB    || 'sequelize_test',
    username: process.env.SEQ_PG_USER || process.env.SEQ_USER  || 'postgres',
    password: process.env.SEQ_PG_PW   || process.env.SEQ_PW    || 'postgres',
    host: process.env.POSTGRES_PORT_5432_TCP_ADDR || process.env.SEQ_PG_HOST || process.env.SEQ_HOST  || '127.0.0.1',
    port: process.env.POSTGRES_PORT_5432_TCP_PORT || process.env.SEQ_PG_PORT || process.env.SEQ_PORT  || 5432,
    pool: {
      max: process.env.SEQ_PG_POOL_MAX  || process.env.SEQ_POOL_MAX  || 5,
      idle: process.env.SEQ_PG_POOL_IDLE || process.env.SEQ_POOL_IDLE || 3000
    }
  }
};
