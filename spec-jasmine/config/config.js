module.exports = {
  rand: function() {
    return parseInt(Math.random() * 999)
  },

  mysql: {
    username: "root",
    password: null,
    database: 'sequelize_test',
    host: '127.0.0.1',
    port: 3306
  },

  sqlite: {
  },

  postgres: {
    database: 'sequelize_test',
    port: 5432
  }
}

