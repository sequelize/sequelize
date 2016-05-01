'use strict';

module.exports = {
  username: process.env.SEQ_USER || 'root',
  password: process.env.SEQ_PW   || null,
  database: process.env.SEQ_DB   || 'sequelize_test',
  host:     process.env.SEQ_HOST || '127.0.0.1',
  pool:     {
    maxConnections: process.env.SEQ_POOL_MAX  || 5,
    maxIdleTime:    process.env.SEQ_POOL_IDLE || 30000
  },

  rand: function() {
    return parseInt(Math.random() * 999, 10);
  },

  mssql: {
    database: process.env.SEQ_MSSQL_DB   || process.env.SEQ_DB   || (function () {
      var db = 'sequelize-test-' + ~~(Math.random() * 100);
      console.log('Using database: ', db);
      return db;
    }()),
    username: process.env.SEQ_MSSQL_USER || process.env.SEQ_USER || 'sequelize',
    password: process.env.SEQ_MSSQL_PW   || process.env.SEQ_PW   || 'nEGkLma26gXVHFUAHJxcmsrK',
    host:     process.env.SEQ_MSSQL_HOST || process.env.SEQ_HOST || 'mssql.sequelizejs.com',
    port:     process.env.SEQ_MSSQL_PORT || process.env.SEQ_PORT || 11433,
    pool:     {
      maxConnections: process.env.SEQ_MSSQL_POOL_MAX  || process.env.SEQ_POOL_MAX  || 5,
      maxIdleTime:    process.env.SEQ_MSSQL_POOL_IDLE || process.env.SEQ_POOL_IDLE || 3000
    }
  },

  //make maxIdleTime small so that tests exit promptly
  mysql: {
    database: process.env.SEQ_MYSQL_DB   || process.env.SEQ_DB   || 'sequelize_test',
    username: process.env.SEQ_MYSQL_USER || process.env.SEQ_USER || 'root',
    password: process.env.SEQ_MYSQL_PW   || process.env.SEQ_PW   || null,
    host:     process.env.MYSQL_PORT_3306_TCP_ADDR || process.env.SEQ_MYSQL_HOST || process.env.SEQ_HOST || '127.0.0.1',
    port:     process.env.MYSQL_PORT_3306_TCP_PORT || process.env.SEQ_MYSQL_PORT || process.env.SEQ_PORT || 3306,
    pool:     {
      maxConnections: process.env.SEQ_MYSQL_POOL_MAX  || process.env.SEQ_POOL_MAX  || 5,
      maxIdleTime:    process.env.SEQ_MYSQL_POOL_IDLE || process.env.SEQ_POOL_IDLE || 3000
    }
  },

  sqlite: {
  },

  postgres: {
    database: process.env.SEQ_PG_DB   || process.env.SEQ_DB    || 'sequelize_test',
    username: process.env.SEQ_PG_USER || process.env.SEQ_USER  || 'postgres',
    password: process.env.SEQ_PG_PW   || process.env.SEQ_PW    || 'postgres',
    host:     process.env.POSTGRES_PORT_5432_TCP_ADDR || process.env.SEQ_PG_HOST || process.env.SEQ_HOST  || '127.0.0.1',
    port:     process.env.POSTGRES_PORT_5432_TCP_PORT || process.env.SEQ_PG_PORT || process.env.SEQ_PORT  || 5432,
    pool:     {
      maxConnections: process.env.SEQ_PG_POOL_MAX  || process.env.SEQ_POOL_MAX  || 5,
      maxIdleTime:    process.env.SEQ_PG_POOL_IDLE || process.env.SEQ_POOL_IDLE || 3000
    }
  },

  mariadb: {
    database: process.env.SEQ_MYSQL_DB   || process.env.SEQ_DB   || 'sequelize_test',
    username: process.env.SEQ_MYSQL_USER || process.env.SEQ_USER || 'root',
    password: process.env.SEQ_MYSQL_PW   || process.env.SEQ_PW   || null,
    host:     process.env.SEQ_MYSQL_HOST || process.env.SEQ_HOST || '127.0.0.1',
    port:     process.env.SEQ_MYSQL_PORT || process.env.SEQ_PORT || 3306,
    pool:     {
      maxConnections: process.env.SEQ_MYSQL_POOL_MAX  || process.env.SEQ_POOL_MAX  || 5,
      maxIdleTime:    process.env.SEQ_MYSQL_POOL_IDLE || process.env.SEQ_POOL_IDLE || 3000
    }
  },

  oracle: {
    database: process.env.SEQ_ORACLE_DB   || process.env.SEQ_DB   || 'localhost:49161/xe',
    username: process.env.SEQ_ORACLE_USER || process.env.SEQ_USER || 'system',
    password: process.env.SEQ_ORACLE_PW   || process.env.SEQ_PW   || 'oracle',
    pool:     {
      maxConnections: process.env.SEQ_ORACLE_POOL_MAX  || process.env.SEQ_POOL_MAX  || 1,
      maxIdleTime:    process.env.SEQ_ORACLE_POOL_IDLE || process.env.SEQ_POOL_IDLE || 3000
    }
  }
};
