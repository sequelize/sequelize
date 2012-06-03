var Sequelize      = require("../../index")
  , sequelize      = new Sequelize(null, null, null, { dialect: 'sqlite' })
  , Helpers        = new (require("../config/helpers"))(sequelize)
  , QueryGenerator = require("../../lib/dialects/sqlite/query-generator")
  , util           = require("util");

describe('QueryGenerator', function() {
  beforeEach(function() { Helpers.sync() })
  afterEach(function() { Helpers.drop() })

  var suites = {
    insertQuery: [
      {
        arguments: ['myTable', { name: 'foo' }],
        expectation: "INSERT INTO `myTable` (`name`) VALUES ('foo');"
      }, {
        arguments: ['myTable', { name: "'bar'" }],
        expectation: "INSERT INTO `myTable` (`name`) VALUES ('''bar''');"
      }
    ],

    updateQuery: [
      {
        arguments: ['myTable', { name: 'foo' }, { id: 2 }],
        expectation: "UPDATE `myTable` SET `name`='foo' WHERE `id`=2"
      }, {
        arguments: ['myTable', { name: "'bar'" }, { id: 2 }],
        expectation: "UPDATE `myTable` SET `name`='''bar''' WHERE `id`=2"
      }
    ]
  };

  Sequelize.Utils._.each(suites, function(tests, suiteTitle) {
    describe(suiteTitle, function() {
      tests.forEach(function(test) {
        var title = test.title || 'correctly returns ' + test.expectation + ' for ' + util.inspect(test.arguments)
        it(title, function() {
          var conditions = QueryGenerator[suiteTitle].apply(null, test.arguments)
          expect(conditions).toEqual(test.expectation)
        })
      })
    })
  })
});
