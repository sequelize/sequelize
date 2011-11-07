var config    = require("./config/config")
  , Sequelize = require("../index")
  , sequelize = new Sequelize(config.database, config.username, config.password, { logging: false })
  , Helpers   = new (require("./config/helpers"))(sequelize)
  , QueryGenerator = require("../lib/query-generator")

describe('QueryGenerator', function() {
  beforeEach(function() { Helpers.sync() })
  afterEach(function() { Helpers.drop() })

  describe('hashToWhereConditions', function() {
    it("should correctly transform array into IN", function() {
      expect(
        QueryGenerator.hashToWhereConditions({ id: [1,2,3] })
      ).toEqual(
        "`id` IN (1,2,3)"
      )
    })
  })
})
