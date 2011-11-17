var config    = require("./config/config")
  , Sequelize = require("../index")
  , sequelize = new Sequelize(config.database, config.username, config.password, { logging: false })
  , Helpers   = new (require("./config/helpers"))(sequelize)
  , Migrator  = require("../lib/migrator")

describe('Migrator', function() {
  describe('getLastMigrationId', function() {
    it("should correctly transform array into IN", function() {
      new Migrator({ path: __dirname + '/assets/migrations'}).migrate()
    })
  })
})
