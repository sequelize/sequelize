module.exports = {
  username: 'meg', //"root",
  password: 'meg', //null,
  database: 'test', //'sequelize_test',
  host: '127.0.0.1',
  rand: function() {
    return parseInt(Math.random() * 999)
  }
}

