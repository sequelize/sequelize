module.exports = {
  username: "meg",
  password: "meg",
  database: 'test',
  host: '127.0.0.1',
  rand: function() {
    return parseInt(Math.random() * 999)
  }
}
