var config         = require("./config/config")
  , Sequelize      = require("../index")
  , sequelize      = new Sequelize(config.database, config.username, config.password, { logging: false })
  , Helpers        = new (require("./config/helpers"))(sequelize)
  , QueryGenerator = require("../lib/connectors/mysql/query-generator")
  , util          = require("util")

describe('QueryGenerator', function() {
  beforeEach(function() { Helpers.sync() })
  afterEach(function() { Helpers.drop() })

  var suites = {
    'hashToWhereConditions': [
      {
        arguments: [{ id: [1,2,3] }],
        expectation: "`id` IN (1,2,3)"
      }
    ],
    'selectQuery': [
      {
        arguments: ['foo', { attributes: [['count(*)', 'count']] }],
        expectation: 'SELECT count(*) as `count` FROM `foo`;'
      }
    ]
  }

  Sequelize.Utils._.each(suites, function(tests, suiteTitle) {
    describe(suiteTitle, function() {
      tests.forEach(function(test) {
        var title = 'correctly returns ' + test.expectation + ' for ' + test.arguments
        it(title, function() {
          var conditions = QueryGenerator[suiteTitle].apply(null, test.arguments)
          expect(conditions).toEqual(test.expectation)
        })
      })
    })
  })

  // //describe('addIndexQuery', function() {
  // //  it("only returns the basics if only necessary parameters are passed", function() {
  // //    expect(
  // //      QueryGenerator.addIndexQuery('User', ['username', 'isAdmin'])
  // //    ).toEqual(
  // //      'CREATE INDEX user_username_is_admin ON User username, isAdmin'
  // //    )
  // //  })
  // //})
})
