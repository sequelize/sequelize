export default {
  username: process.env.SEQ_USER || 'root',
  password: process.env.SEQ_PW || null,
  database: process.env.SEQ_DB || 'sequelize_test',
  host: process.env.SEQ_HOST || '127.0.0.1',
  pool: {
    max: process.env.SEQ_POOL_MAX || 5,
    idle: process.env.SEQ_POOL_IDLE || 30000
  },

  rand() {
    return parseInt(Math.random() * 999, 10);
  },

  //make idle time small so that tests exit promptly
  postgres: {
    database: process.env.SEQ_PG_DB || process.env.SEQ_DB || 'sequelize_test',
    username: process.env.SEQ_PG_USER || process.env.SEQ_USER || 'postgres',
    password: process.env.SEQ_PG_PW || process.env.SEQ_PW || 'postgres',
    host: process.env.POSTGRES_PORT_5432_TCP_ADDR || process.env.SEQ_PG_HOST || process.env.SEQ_HOST || '127.0.0.1',
    port: process.env.POSTGRES_PORT_5432_TCP_PORT || process.env.SEQ_PG_PORT || process.env.SEQ_PORT || 5432,
    pool: {
      max: process.env.SEQ_PG_POOL_MAX || process.env.SEQ_POOL_MAX || 5,
      idle: process.env.SEQ_PG_POOL_IDLE || process.env.SEQ_POOL_IDLE || 3000
    }
  }
};
