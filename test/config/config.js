module.exports = {
  username: "root",
  password: null,
  database: 'sequelize_test',
  host: '127.0.0.1',
  pool: { maxConnections: 5, maxIdleTime: 30000},

  rand: function() {
    return parseInt(Math.random() * 999, 10)
  },

  //make maxIdleTime small so that tests exit promptly
  mysql: {
    username: "root",
    password: null,
    database: 'sequelize_test',
    host: '127.0.0.1',
    port: 3306,
    pool: { maxConnections: 5, maxIdleTime: 30}
  },

  sqlite: {
  },

  postgres: {
    database: 'sequelize_test',
    username: "postgres",
    port: 5432,
    pool: { maxConnections: 5, maxIdleTime: 3000}
  }
}
