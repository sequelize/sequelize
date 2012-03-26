var config         = require("../config/config")
  , Sequelize      = require("../../index")
  , sequelize      = new Sequelize(config.database, config.username, config.password, { pool: config.pool, logging: false })
  , Helpers        = new (require("../config/helpers"))(sequelize)
  , QueryGenerator = require("../../lib/dialects/mysql/query-generator")
  , util          = require("util")

describe('QueryGenerator', function() {
  beforeEach(function() { Helpers.sync() })
  afterEach(function() { Helpers.drop() })

  var suites = {
    createTableQuery: [
      {
        arguments: ['myTable', {title: 'VARCHAR(255)', name: 'VARCHAR(255)'}],
        expectation: "CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255)) ENGINE=InnoDB;"
      },
      {
        arguments: ['myTable', {title: 'VARCHAR(255)', name: 'VARCHAR(255)'}, {engine: 'MyISAM'}],
        expectation: "CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255)) ENGINE=MyISAM;"
      },
      {
        arguments: ['myTable', {title: 'VARCHAR(255)', name: 'VARCHAR(255)'}, {charset: 'latin1'}],
        expectation: "CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255)) ENGINE=InnoDB DEFAULT CHARSET=latin1;"
      }
    ],

    dropTableQuery: [
      {
        arguments: ['myTable'],
        expectation: "DROP TABLE IF EXISTS `myTable`;"
      }
    ],

    selectQuery: [
      {
        arguments: ['myTable'],
        expectation: "SELECT * FROM `myTable`;"
      }, {
        arguments: ['myTable', {attributes: ['id', 'name']}],
        expectation: "SELECT `id`, `name` FROM `myTable`;"
      }, {
        arguments: ['myTable', {where: {id: 2}}],
        expectation: "SELECT * FROM `myTable` WHERE `id`=2;"
      }, {
        arguments: ['myTable', {where: {name: 'foo'}}],
        expectation: "SELECT * FROM `myTable` WHERE `name`='foo';"
      }, {
        arguments: ['myTable', {where: {name: "foo';DROP TABLE myTable;"}}],
        expectation: "SELECT * FROM `myTable` WHERE `name`='foo\\';DROP TABLE myTable;';"
      }, {
        arguments: ['myTable', {where: 2}],
        expectation: "SELECT * FROM `myTable` WHERE `id`=2;"
      }, {
        arguments: ['foo', { attributes: [['count(*)', 'count']] }],
        expectation: 'SELECT count(*) as `count` FROM `foo`;'
      }, {
        arguments: ['myTable', {where: "foo='bar'"}],
        expectation: "SELECT * FROM `myTable` WHERE foo='bar';"
      }, {
        arguments: ['myTable', {order: "id DESC"}],
        expectation: "SELECT * FROM `myTable` ORDER BY id DESC;"
      }, {
        arguments: ['myTable', {group: "name"}],
        expectation: "SELECT * FROM `myTable` GROUP BY `name`;"
      }, {
        arguments: ['myTable', {limit: 10}],
        expectation: "SELECT * FROM `myTable` LIMIT 10;"
      }, {
        arguments: ['myTable', {limit: 10, offset: 2}],
        expectation: "SELECT * FROM `myTable` LIMIT 2, 10;"
      }, {
        title: 'ignores offset if no limit was passed',
        arguments: ['myTable', {offset: 2}],
        expectation: "SELECT * FROM `myTable`;"
      }
    ],

    insertQuery: [
      {
        arguments: ['myTable', {name: 'foo'}],
        expectation: "INSERT INTO `myTable` (`name`) VALUES ('foo');"
      }, {
        arguments: ['myTable', {name: "foo';DROP TABLE myTable;"}],
        expectation: "INSERT INTO `myTable` (`name`) VALUES ('foo\\';DROP TABLE myTable;');"
      }, {
        arguments: ['myTable', {name: 'foo', birthday: new Date(2011, 2, 27, 10, 1, 55)}],
        expectation: "INSERT INTO `myTable` (`name`,`birthday`) VALUES ('foo','2011-03-27 10:01:55');"
      }, {
        arguments: ['myTable', {name: 'foo', foo: 1}],
        expectation: "INSERT INTO `myTable` (`name`,`foo`) VALUES ('foo',1);"
      }
    ],

    updateQuery: [
      {
        arguments: ['myTable', {name: 'foo', birthday: new Date(2011, 2, 27, 10, 1, 55)}, {id: 2}],
        expectation: "UPDATE `myTable` SET `name`='foo',`birthday`='2011-03-27 10:01:55' WHERE `id`=2"
      }, {
        arguments: ['myTable', {name: 'foo', birthday: new Date(2011, 2, 27, 10, 1, 55)}, 2],
        expectation: "UPDATE `myTable` SET `name`='foo',`birthday`='2011-03-27 10:01:55' WHERE `id`=2"
      }, {
        arguments: ['myTable', {bar: 2}, {name: 'foo'}],
        expectation: "UPDATE `myTable` SET `bar`=2 WHERE `name`='foo'"
      }, {
        arguments: ['myTable', {name: "foo';DROP TABLE myTable;"}, {name: 'foo'}],
        expectation: "UPDATE `myTable` SET `name`='foo\\';DROP TABLE myTable;' WHERE `name`='foo'"
      }
    ],

    deleteQuery: [
      {
        arguments: ['myTable', {name: 'foo'}],
        expectation: "DELETE FROM `myTable` WHERE `name`='foo' LIMIT 1"
      }, {
        arguments: ['myTable', 1],
        expectation: "DELETE FROM `myTable` WHERE `id`=1 LIMIT 1"
      }, {
        arguments: ['myTable', 1, {limit: 10}],
        expectation: "DELETE FROM `myTable` WHERE `id`=1 LIMIT 10"
      }, {
        arguments: ['myTable', {name: "foo';DROP TABLE myTable;"}, {limit: 10}],
        expectation: "DELETE FROM `myTable` WHERE `name`='foo\\';DROP TABLE myTable;' LIMIT 10"
      }
    ],

    addIndexQuery: [
      {
        arguments: ['User', ['username', 'isAdmin']],
        expectation: 'CREATE INDEX user_username_is_admin ON User (username, isAdmin)'
      }, {
        arguments: [
          'User', [
            { attribute: 'username', length: 10, order: 'ASC'},
            'isAdmin'
          ]
        ],
        expectation: "CREATE INDEX user_username_is_admin ON User (username(10) ASC, isAdmin)"
      }, {
        arguments: [
          'User', ['username', 'isAdmin'], { parser: 'foo', indicesType: 'FULLTEXT', indexName: 'bar'}
        ],
        expectation: "CREATE FULLTEXT INDEX bar ON User (username, isAdmin) WITH PARSER foo"
      }
    ],

    showIndexQuery: [
      {
        arguments: ['User'],
        expectation: 'SHOW INDEX FROM User'
      }, {
        arguments: ['User', { database: 'sequelize' }],
        expectation: "SHOW INDEX FROM User FROM sequelize"
      }
    ],

    removeIndexQuery: [
      {
        arguments: ['User', 'user_foo_bar'],
        expectation: "DROP INDEX user_foo_bar ON User"
      }, {
        arguments: ['User', ['foo', 'bar']],
        expectation: "DROP INDEX user_foo_bar ON User"
      }
    ],

    hashToWhereConditions: [
      {
        arguments: [{ id: [1,2,3] }],
        expectation: "`id` IN (1,2,3)"
      }
    ]
  }

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
})
