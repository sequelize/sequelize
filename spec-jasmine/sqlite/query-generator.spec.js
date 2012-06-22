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
    ]
  };

  Sequelize.Utils._.each(suites, function(tests, suiteTitle) {
    describe(suiteTitle, function() {
      tests.forEach(function(test) {
        var title = test.title || 'correctly returns ' + test.expectation + ' for ' + util.inspect(test.arguments)
        it(title, function() {
          // Options would normally be set by the query interface that instantiates the query-generator, but here we specify it explicitly
          var context = test.context || {options: {}};
          
          var conditions = QueryGenerator[suiteTitle].apply(context, test.arguments)
          expect(conditions).toEqual(test.expectation)
        })
      })
    })
  })
});
