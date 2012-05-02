module.exports = {
  rand: function() {
    return parseInt(Math.random() * 999)
  },

  //make maxIdleTime small so that tests exit promptly
  mysql: {
    username: "root",
    password: process.env[ "SEQUELIZE_MYSQL_PASSWORD" ],
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
    password: process.env[ "SEQUELIZE_POSTGRES_PASSWORD" ],
    port: 5432
  }
}

