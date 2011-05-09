module.exports = {
    username: 'root'
  , password: null
  , database: 'sequelize_test'
  , host: '127.0.0.1'
  , rand: function() {
      return parseInt(Math.random() * 99999999999999)
    }
}