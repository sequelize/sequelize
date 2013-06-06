var Sequelize      = require("../../index")
  , sequelize      = new Sequelize(null, null, null, { dialect: 'sqlite' })
  , Helpers        = new (require("../config/helpers"))(sequelize)
  , QueryGenerator = require("../../lib/dialects/sqlite/query-generator")
  , util           = require("util");

describe('QueryGenerator', function() {
  beforeEach(function() { Helpers.sync() })
  afterEach(function() { Helpers.drop() })

  var suites = {

    attributesToSQL: [
      {
        arguments: [{id: 'INTEGER'}],
        expectation: {id: 'INTEGER'}
      },
      {
        arguments: [{id: 'INTEGER', foo: 'VARCHAR(255)'}],
        expectation: {id: 'INTEGER', foo: 'VARCHAR(255)'}
      },
      {
        arguments: [{id: {type: 'INTEGER'}}],
        expectation: {id: 'INTEGER'}
      },
      {
        arguments: [{id: {type: 'INTEGER', allowNull: false}}],
        expectation: {id: 'INTEGER NOT NULL'}
      },
      {
        arguments: [{id: {type: 'INTEGER', allowNull: true}}],
        expectation: {id: 'INTEGER'}
      },
      {
        arguments: [{id: {type: 'INTEGER', primaryKey: true, autoIncrement: true}}],
        expectation: {id: 'INTEGER PRIMARY KEY AUTOINCREMENT'}
      },
      {
        arguments: [{id: {type: 'INTEGER', defaultValue: 0}}],
        expectation: {id: 'INTEGER DEFAULT 0'}
      },
      {
        arguments: [{id: {type: 'INTEGER', unique: true}}],
        expectation: {id: 'INTEGER UNIQUE'}
      },
      {
        arguments: [{id: {type: 'INTEGER', references: 'Bar'}}],
        expectation: {id: 'INTEGER REFERENCES `Bar` (`id`)'}
      },
      {
        arguments: [{id: {type: 'INTEGER', references: 'Bar', referencesKey: 'pk'}}],
        expectation: {id: 'INTEGER REFERENCES `Bar` (`pk`)'}
      },
      {
        arguments: [{id: {type: 'INTEGER', references: 'Bar', onDelete: 'CASCADE'}}],
        expectation: {id: 'INTEGER REFERENCES `Bar` (`id`) ON DELETE CASCADE'}
      },
      {
        arguments: [{id: {type: 'INTEGER', references: 'Bar', onUpdate: 'RESTRICT'}}],
        expectation: {id: 'INTEGER REFERENCES `Bar` (`id`) ON UPDATE RESTRICT'}
      },
      {
        arguments: [{id: {type: 'INTEGER', allowNull: false, defaultValue: 1, references: 'Bar', onDelete: 'CASCADE', onUpdate: 'RESTRICT'}}],
        expectation: {id: 'INTEGER NOT NULL DEFAULT 1 REFERENCES `Bar` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT'}
      },
    ],

    createTableQuery: [
      {
        arguments: ['myTable', {title: 'VARCHAR(255)', name: 'VARCHAR(255)'}],
        expectation: "CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255));"
      },
      {
        arguments: ['myTable', {title: 'ENUM("A", "B", "C")', name: 'VARCHAR(255)'}],
        expectation: "CREATE TABLE IF NOT EXISTS `myTable` (`title` ENUM(\"A\", \"B\", \"C\"), `name` VARCHAR(255));"
      },
      {
        arguments: ['myTable', {title: 'VARCHAR(255)', name: 'VARCHAR(255)', id: 'INTEGER PRIMARY KEY'}],
        expectation: "CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255), `id` INTEGER PRIMARY KEY);"
      },
      {
        arguments: ['myTable', {title: 'VARCHAR(255)', name: 'VARCHAR(255)', otherId: 'INTEGER REFERENCES `otherTable` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION'}],
        expectation: "CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255), `otherId` INTEGER REFERENCES `otherTable` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION);"
      }
    ],

    insertQuery: [
      {
        arguments: ['myTable', { name: 'foo' }],
        expectation: "INSERT INTO `myTable` (`name`) VALUES ('foo');"
      }, {
        arguments: ['myTable', { name: "'bar'" }],
        expectation: "INSERT INTO `myTable` (`name`) VALUES ('''bar''');"
      }, {
        arguments: ['myTable', { name: "bar", value: null }],
        expectation: "INSERT INTO `myTable` (`name`,`value`) VALUES ('bar',NULL);"
      }, {
        arguments: ['myTable', { name: "bar", value: undefined }],
        expectation: "INSERT INTO `myTable` (`name`,`value`) VALUES ('bar',NULL);"
      }, {
        arguments: ['myTable', { name: "foo", value: true }],
        expectation: "INSERT INTO `myTable` (`name`,`value`) VALUES ('foo',1);"
      }, {
        arguments: ['myTable', { name: "foo", value: false }],
        expectation: "INSERT INTO `myTable` (`name`,`value`) VALUES ('foo',0);"
      }, {
        arguments: ['myTable', {name: 'foo', foo: 1, nullValue: null}],
        expectation: "INSERT INTO `myTable` (`name`,`foo`,`nullValue`) VALUES ('foo',1,NULL);"
      }, {
        arguments: ['myTable', {name: 'foo', foo: 1, nullValue: null}],
        expectation: "INSERT INTO `myTable` (`name`,`foo`,`nullValue`) VALUES ('foo',1,NULL);",
        context: {options: {omitNull: false}}
      }, {
        arguments: ['myTable', {name: 'foo', foo: 1, nullValue: null}],
        expectation: "INSERT INTO `myTable` (`name`,`foo`) VALUES ('foo',1);",
        context: {options: {omitNull: true}}
      }, {
        arguments: ['myTable', {name: 'foo', foo: 1, nullValue: undefined}],
        expectation: "INSERT INTO `myTable` (`name`,`foo`) VALUES ('foo',1);",
        context: {options: {omitNull: true}}
      }
    ],

    bulkInsertQuery: [
      {
        arguments: ['myTable', [{name: 'foo'}, {name: 'bar'}]],
        expectation: "INSERT INTO `myTable` (`name`) VALUES ('foo'),('bar');"
      }, {
        arguments: ['myTable', [{name: "'bar'"}, {name: 'foo'}]],
        expectation: "INSERT INTO `myTable` (`name`) VALUES ('''bar'''),('foo');"
      }, {
        arguments: ['myTable', [{name: "bar", value: null}, {name: 'foo', value: 1}]],
        expectation: "INSERT INTO `myTable` (`name`,`value`) VALUES ('bar',NULL),('foo',1);"
      }, {
        arguments: ['myTable', [{name: "bar", value: undefined}, {name: 'bar', value: 2}]],
        expectation: "INSERT INTO `myTable` (`name`,`value`) VALUES ('bar',NULL),('bar',2);"
      }, {
        arguments: ['myTable', [{name: "foo", value: true}, {name: 'bar', value: false}]],
        expectation: "INSERT INTO `myTable` (`name`,`value`) VALUES ('foo',1),('bar',0);"
      }, {
        arguments: ['myTable', [{name: "foo", value: false}, {name: 'bar', value: false}]],
        expectation: "INSERT INTO `myTable` (`name`,`value`) VALUES ('foo',0),('bar',0);"
      }, {
        arguments: ['myTable', [{name: 'foo', foo: 1, nullValue: null}, {name: 'bar', foo: 2, nullValue: null}]],
        expectation: "INSERT INTO `myTable` (`name`,`foo`,`nullValue`) VALUES ('foo',1,NULL),('bar',2,NULL);"
      }, {
        arguments: ['myTable', [{name: 'foo', foo: 1, nullValue: null}, {name: 'bar', foo: 2, nullValue: null}]],
        expectation: "INSERT INTO `myTable` (`name`,`foo`,`nullValue`) VALUES ('foo',1,NULL),('bar',2,NULL);",
        context: {options: {omitNull: false}}
      }, {
        arguments: ['myTable', [{name: 'foo', foo: 1, nullValue: null}, {name: 'bar', foo: 2, nullValue: null}]],
        expectation: "INSERT INTO `myTable` (`name`,`foo`,`nullValue`) VALUES ('foo',1,NULL),('bar',2,NULL);",
        context: {options: {omitNull: true}} // Note: We don't honour this because it makes little sense when some rows may have nulls and others not
      }, {
        arguments: ['myTable', [{name: 'foo', foo: 1, nullValue: null}, {name: 'bar', foo: 2, nullValue: null}]],
        expectation: "INSERT INTO `myTable` (`name`,`foo`,`nullValue`) VALUES ('foo',1,NULL),('bar',2,NULL);",
        context: {options: {omitNull: true}} // Note: As above
      }
    ],

    updateQuery: [
      {
        arguments: ['myTable', { name: 'foo' }, { id: 2 }],
        expectation: "UPDATE `myTable` SET `name`='foo' WHERE `id`=2"
      }, {
        arguments: ['myTable', { name: "'bar'" }, { id: 2 }],
        expectation: "UPDATE `myTable` SET `name`='''bar''' WHERE `id`=2"
      }, {
        arguments: ['myTable', { name: 'bar', value: null }, { id: 2 }],
        expectation: "UPDATE `myTable` SET `name`='bar',`value`=NULL WHERE `id`=2"
      }, {
        arguments: ['myTable', { name: 'bar', value: undefined }, { id: 2 }],
        expectation: "UPDATE `myTable` SET `name`='bar',`value`=NULL WHERE `id`=2"
      }, {
        arguments: ['myTable', { flag: true }, { id: 2 }],
        expectation: "UPDATE `myTable` SET `flag`=1 WHERE `id`=2"
      }, {
        arguments: ['myTable', { flag: false }, { id: 2 }],
        expectation: "UPDATE `myTable` SET `flag`=0 WHERE `id`=2"
      }, {
        arguments: ['myTable', {bar: 2, nullValue: null}, {name: 'foo'}],
        expectation: "UPDATE `myTable` SET `bar`=2,`nullValue`=NULL WHERE `name`='foo'"
      }, {
        arguments: ['myTable', {bar: 2, nullValue: null}, {name: 'foo'}],
        expectation: "UPDATE `myTable` SET `bar`=2,`nullValue`=NULL WHERE `name`='foo'",
        context: {options: {omitNull: false}}
      }, {
        arguments: ['myTable', {bar: 2, nullValue: null}, {name: 'foo'}],
        expectation: "UPDATE `myTable` SET `bar`=2 WHERE `name`='foo'",
        context: {options: {omitNull: true}}
      }
    ],

    deleteQuery: [
      {
        arguments: ['myTable', {name: 'foo'}],
        expectation: "DELETE FROM `myTable` WHERE `name`='foo'"
      }, {
        arguments: ['myTable', 1],
        expectation: "DELETE FROM `myTable` WHERE `id`=1"
      }, {
        arguments: ['myTable', 1, {truncate: true}],
        expectation: "DELETE FROM `myTable` WHERE `id`=1"
      }, {
        arguments: ['myTable', 1, {limit: 10}],
        expectation: "DELETE FROM `myTable` WHERE `id`=1"
      }, {
        arguments: ['myTable', {name: "foo';DROP TABLE myTable;"}, {limit: 10}],
        expectation: "DELETE FROM `myTable` WHERE `name`='foo'';DROP TABLE myTable;'"
      }, {
        arguments: ['myTable', {name: 'foo'}, {limit: null}],
        expectation: "DELETE FROM `myTable` WHERE `name`='foo'"
      }
    ]
  };

  Sequelize.Utils._.each(suites, function(tests, suiteTitle) {
    describe(suiteTitle, function() {
      tests.forEach(function(test) {
        var title = test.title || 'SQLite correctly returns ' + test.expectation + ' for ' + util.inspect(test.arguments)
        it(title, function() {
          // Options would normally be set by the query interface that instantiates the query-generator, but here we specify it explicitly
          var context = test.context || {options: {}};
          QueryGenerator.options = context.options
          var conditions = QueryGenerator[suiteTitle].apply(QueryGenerator, test.arguments)
          expect(conditions).toEqual(test.expectation)
        })
      })
    })
  })
});
