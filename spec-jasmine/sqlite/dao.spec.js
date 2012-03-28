// var config    = require("./config/config")
//   , Sequelize = require("../index")
//   , User      = null
//   , sequelize = new Sequelize(config.database, config.username, config.password, {
//       logging: false,
//       dialect: dialect
//     })
//   , Helpers   = new (require("./config/helpers"))(sequelize)

// describe('DAO', function() {
//   var setup = function() {
//     Helpers.async(function(done) {
//       User = sequelize.define('User', { username: Sequelize.STRING })
//       User.sync({ force: true }).success(done)
//     })
//   }

//   beforeEach(function() { Helpers.dropAllTables(); setup() })
//   afterEach(function() { Helpers.dropAllTables() })

//   describe('findAll', function() {
//     it("can handle dates correctly", function() {

//     })
//   })
// })
