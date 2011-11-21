var config    = require("./config/config")
  , Sequelize = require("../index")
  , sequelize = new Sequelize(config.database, config.username, config.password, { logging: false })
  , Helpers   = new (require("./config/helpers"))(sequelize)
  , QueryGenerator = require("../lib/connectors/mysql/query-generator")

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

  describe('selectQuery', function() {
    it("should correctly convert arrays into aliases", function() {
      expect(
        QueryGenerator.selectQuery('foo', { attributes: [['count(*)', 'count']] })
      ).toEqual(
        'SELECT count(*) as `count` FROM `foo`;'
      )
    })
  })
})
